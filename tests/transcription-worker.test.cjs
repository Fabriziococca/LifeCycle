const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const { OperationTimeoutError } = require('../operational-resilience.js');

const {
    DailyQuotaError,
    TranscriptionWorker,
    getProviderCustomVocabulary,
    getProviderHttpOptions,
    getProviderLanguageCodes,
    getNextUtcQuotaWindow,
    getNextPacificQuotaWindow,
    getQuotaResumeAt,
    isRetryableError,
    normalizeProviderTimeout,
    prepareMediaSegments
} = require('../transcription-worker.js');

function retentionFixture() {
    const userId = '11111111-1111-4111-8111-111111111111';
    const sessions = ['completed', 'partial', 'failed', 'canceled', 'completed'].map((status, index) => ({
        id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
        user_id: userId, status, audio_deleted_at: null, audio_delete_after: '2020-01-01T00:00:00Z'
    }));
    const removed = [], updates = [], selects = [];
    const state = { documentError: null };
    class Query {
        constructor(table) { this.table = table; this.filters = []; }
        select(columns) { selects.push({ table: this.table, columns }); return this; }
        eq(key, value) { this.filters.push(row => row[key] === value); return this; }
        is(key, value) { return this.eq(key, value); }
        in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
        lte(key, value) { this.filters.push(row => row[key] <= value); return this; }
        neq(key, value) { this.filters.push(row => row[key] !== value); return this; }
        limit() { return this; }
        maybeSingle() { this.single = true; return this; }
        update(value) { this.value = value; return this; }
        then(resolve) {
            if (this.value) {
                updates.push({ table: this.table, value: this.value });
                return Promise.resolve({ error: null }).then(resolve);
            }
            if (this.table === 'transcription_documents' && state.documentError) {
                return Promise.resolve({ error: state.documentError }).then(resolve);
            }
            const rows = this.table === 'transcription_sessions' ? sessions : [{
                id: 'document', user_id: userId, session_id: sessions[0].id, kind: 'transcript', content: 'Texto durable'
            }];
            const filtered = rows.filter(row => this.filters.every(filter => filter(row)));
            return Promise.resolve({ data: this.single ? filtered[0] || null : filtered, error: null }).then(resolve);
        }
    }
    const worker = new TranscriptionWorker({ apiKey: '', supabase: {
        from: table => new Query(table), storage: { from: () => ({
            list: async () => ({ data: [{ name: 'audio.m4a', id: 'object' }], error: null }),
            remove: async paths => { removed.push(...paths); return { error: null }; }
        }) }
    } });
    return { worker, sessions, removed, updates, selects, state };
}

test('audio cleanup preserves failed/partial originals, source text and completed sessions without a durable document', async () => {
    const { worker, sessions, removed, updates, selects } = retentionFixture();
    assert.equal(await worker.cleanupExpiredAudioIfDue(true), 1);
    assert.deepEqual(removed, [`${sessions[0].user_id}/${sessions[0].id}/audio.m4a`]);
    assert.equal(updates.length, 2);
    const chunkUpdate = updates.find(update => update.table === 'transcription_chunks').value;
    assert.equal(Object.hasOwn(chunkUpdate, 'transcript_text'), false, 'expiry cannot erase the source transcript');
    assert.ok(selects.filter(query => query.table === 'transcription_documents').every(query => query.columns === 'id'));
    assert.equal(await worker.cleanupExpiredAudioIfDue(), 0, 'successful cleanup is throttled');
});

test('a failed document check preserves audio and leaves cleanup retryable', async () => {
    const { worker, state, removed } = retentionFixture();
    state.documentError = new Error('temporary database timeout');
    await assert.rejects(worker.cleanupExpiredAudioIfDue(), /database timeout/);
    assert.deepEqual(removed, []);
    assert.equal(worker.lastCleanupAt, 0);
    state.documentError = null;
    assert.equal(await worker.cleanupExpiredAudioIfDue(), 1);
});

test('prepara audio importado en fragmentos AAC reproducibles de cinco minutos lógicos', async t => {
    assert.ok(ffmpegPath && fs.existsSync(ffmpegPath), 'ffmpeg-static debe incluir un ejecutable');
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lifecycle-worker-test-'));
    t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
    const sourcePath = path.join(directory, 'source.wav');
    const generated = spawnSync(ffmpegPath, [
        '-y', '-nostdin', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000',
        '-t', '12', '-ac', '1', sourcePath
    ], { windowsHide: true, timeout: 30_000 });
    assert.equal(generated.status, 0, String(generated.stderr || ''));

    const segments = await prepareMediaSegments({
        inputPath: sourcePath,
        outputDirectory: path.join(directory, 'prepared'),
        segmentDurationSeconds: 5
    });
    assert.equal(segments.length, 3);
    for (const segment of segments) {
        assert.equal(path.extname(segment), '.m4a');
        assert.ok((await fs.promises.stat(segment)).size > 0);
    }
});

test('la pausa diaria se reanuda a las 00:05 UTC del día siguiente', () => {
    const next = getNextUtcQuotaWindow(new Date('2026-09-04T23:59:59.000Z'));
    assert.equal(next.toISOString(), '2026-09-05T00:05:00.000Z');
    const error = new DailyQuotaError();
    assert.equal(error.code, 'daily_safety_limit');
});

test('una respuesta SQL perdida no borra fragmentos que otro intento puede haber confirmado', async t => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lifecycle-prepare-retry-test-'));
    t.after(() => fs.promises.rm(directory, {recursive:true,force:true}));
    const source = path.join(directory, 'source.wav');
    const generated = spawnSync(ffmpegPath, ['-y','-nostdin','-hide_banner','-loglevel','error',
        '-f','lavfi','-i','sine=frequency=880:sample_rate=48000','-t','1','-ac','1',source],
        {windowsHide:true,timeout:30000});
    assert.equal(generated.status,0,String(generated.stderr || ''));
    const audio = new Blob([await fs.promises.readFile(source)]);
    const uploaded = [];
    const chunk = {media_role:'import_source',storage_path:'owner/session/original.wav',byte_size:audio.size,
        user_id:'owner',session_id:'session',duration_ms:1000};
    const worker = new TranscriptionWorker({supabase:{
        from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:chunk})}),
        storage:{from:()=>({
            download:async()=>({data:audio}),
            upload:async name=>{uploaded.push(name);return {error:null};},
            remove:async()=>assert.fail('No se puede borrar tras una respuesta SQL ambigua')
        })},
        rpc:async()=>({error:new Error('lost SQL response')})
    }});
    worker.loadSession = async()=>({duration_ms:1000});
    await assert.rejects(worker.processPreparationJob({id:'job',session_id:'session',chunk_id:'chunk'}),/lost SQL response/);
    assert.ok(uploaded.length > 0);
});

test('el locale argentino se envía como el código latinoamericano admitido por Gemini', () => {
    assert.deepEqual(getProviderLanguageCodes('es-AR'), ['es-419']);
    assert.deepEqual(getProviderLanguageCodes('en-US'), ['en-US']);
    assert.deepEqual(getProviderLanguageCodes(''), []);
});

test('el contexto se convierte en vocabulario acotado para mejorar nombres y tecnicismos', () => {
    assert.deepEqual(
        getProviderCustomVocabulary('Ingeniería de software; LifeCycle, Supabase\nLifeCycle'),
        ['Ingeniería de software', 'LifeCycle', 'Supabase']
    );
    assert.equal(getProviderCustomVocabulary('x').length, 0);
    assert.equal(getProviderCustomVocabulary('a'.repeat(101)).length, 0);
});

test('las llamadas al proveedor tienen timeout y no duplican reintentos del worker', () => {
    assert.equal(normalizeProviderTimeout('60000', 10_000), 60_000);
    assert.equal(normalizeProviderTimeout('0', 10_000), 10_000);
    assert.deepEqual(getProviderHttpOptions(60_000), {
        timeout: 60_000,
        retryOptions: { attempts: 1 }
    });
    assert.equal(isRetryableError(new Error('La operación superó el timeout')), true);
    assert.equal(isRetryableError(new OperationTimeoutError('Gemini', 1000)), true);
    assert.equal(isRetryableError({ status: 400, message: 'Invalid audio' }), false);
});

test('la cuota diaria de Google se reanuda en horario del Pacífico y respeta DST', () => {
    assert.equal(getNextPacificQuotaWindow(new Date('2026-09-05T18:00:00Z')).toISOString(), '2026-09-06T07:05:00.000Z');
    assert.equal(getNextPacificQuotaWindow(new Date('2026-12-05T18:00:00Z')).toISOString(), '2026-12-06T08:05:00.000Z');
    assert.equal(getNextPacificQuotaWindow(new Date('2026-03-08T07:30:00Z')).toISOString(), '2026-03-08T08:05:00.000Z');
});

test('las pausas 429 usan backoff persistente, Retry-After y RetryInfo sin adelantar al proveedor', () => {
    const now = new Date('2026-09-05T18:00:00Z');
    assert.equal(getQuotaResumeAt({}, 0, now).toISOString(), '2026-09-05T18:01:00.000Z');
    assert.equal(getQuotaResumeAt({}, 6, now).toISOString(), '2026-09-05T19:00:00.000Z');
    assert.equal(getQuotaResumeAt({ headers: new Headers({ 'retry-after': '125' }) }, 0, now).toISOString(), '2026-09-05T18:02:05.000Z');
    assert.equal(getQuotaResumeAt({ headers: { 'retry-after': 'Sat, 05 Sep 2026 20:00:00 GMT' } }, 0, now).toISOString(), '2026-09-05T20:00:00.000Z');
    assert.equal(getQuotaResumeAt({ message: JSON.stringify({ error: { details: [{ retryDelay: '90.5s' }] } }) }, 0, now).toISOString(), '2026-09-05T18:01:30.500Z');
    const dailyError = { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] };
    assert.equal(getQuotaResumeAt(dailyError, 0, now).toISOString(), '2026-09-06T07:05:00.000Z');
});

test('un 429 no agota reintentos, no cuenta como fallo y queda en espera con la reserva del worker', async () => {
    const calls = [];
    const worker = new TranscriptionWorker({ supabase: { rpc: async (name, parameters) => {
        calls.push({ name, parameters });
        return { data: true, error: null };
    } } });
    worker.processTranscriptionJob = async () => { throw Object.assign(new Error('Quota exceeded'), { status: 429 }); };
    await worker.processJob({ id: 'quota-job', job_type: 'transcribe', attempts: 3, max_attempts: 3, quota_waits: 20 });
    assert.equal(calls[0].name, 'fail_transcription_job');
    assert.equal(calls[0].parameters.p_status, 'waiting_quota');
    assert.equal(calls[0].parameters.p_worker_id, worker.workerId);
    assert.equal(calls[0].parameters.p_error_code, '429');
    assert.equal(worker.runtime.quotaPauses, 1);
    assert.equal(worker.runtime.failedJobs, 0);
});

test('los fallos temporales reales siguen acotados y no se ocultan errores al persistir la cola', async () => {
    const calls = [];
    const worker = new TranscriptionWorker({ supabase: { rpc: async (_, parameters) => {
        calls.push(parameters);
        return { error: null };
    } } });
    const job = { id: 'retry-job', attempts: 1, max_attempts: 3 };
    await worker.failJob(job, new OperationTimeoutError('Gemini', 1000));
    await worker.failJob({ ...job, attempts: 3 }, new OperationTimeoutError('Gemini', 1000));
    assert.deepEqual(calls.map(call => call.p_status), ['queued', 'failed']);
    worker.supabase.rpc = async () => ({ error: new Error('database offline') });
    await assert.rejects(worker.failJob(job, { status: 429 }), /database offline/);
});

test('un resumen truncado no se guarda como documento terminado', async () => {
    const worker = new TranscriptionWorker({ supabase: {
        from: () => ({ select() { return this; }, eq() { return this; }, async single() { return { data: { content: 'Texto original completo' } }; } }),
        rpc: async () => assert.fail('no debe guardar el resultado incompleto')
    } });
    worker.reserveProviderAttempt = async () => {};
    worker.ai = { models: { generateContent: async () => ({ text: 'Texto cortado', candidates: [{ finishReason: 'MAX_TOKENS' }] }) } };
    await assert.rejects(worker.processArtifactJob({ session_id: 's', job_type: 'summary' }), /incompleto/);
});

test('resumen y apuntes usan el modelo vigente sin modificar la transcripción fuente', async () => {
    const source = 'Texto original completo e inmutable';
    const saved = [];
    const requests = [];
    const worker = new TranscriptionWorker({ apiKey: '', supabase: {
        from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { content: source } }) }),
        rpc: async (name, parameters) => {
            if (name === 'reserve_transcription_provider_attempt') return { data: true };
            assert.equal(name, 'complete_transcription_artifact_job');
            saved.push(parameters);
            return { error: null };
        }
    } });
    assert.equal(worker.artifactModel, 'gemini-3.6-flash');
    assert.equal(new TranscriptionWorker({ apiKey: '', artifactModel: 'configured-model' }).artifactModel, 'configured-model');
    worker.ai = { models: { generateContent: async request => {
        requests.push(request);
        return { text: 'Documento derivado', candidates: [{ finishReason: 'STOP' }] };
    } } };
    for (const kind of ['summary', 'notes']) {
        await worker.processArtifactJob({ id: `job-${kind}`, session_id: 's', job_type: kind });
    }
    assert.equal(worker.runtime.providerAttempts, 2);
    assert.deepEqual(saved.map(item => item.p_job_id), ['job-summary', 'job-notes']);
    assert.ok(saved.every(item => item.p_content === 'Documento derivado'));
    assert.match(requests[0].contents, /resumen fiel/);
    assert.match(requests[1].contents, /apuntes ordenados/);
    for (const request of requests) {
        assert.equal(request.model, 'gemini-3.6-flash');
        assert.ok(request.contents.endsWith(source));
        assert.equal(request.config.httpOptions.retryOptions.attempts, 1);
        assert.equal(request.config.httpOptions.timeout, worker.providerRequestTimeoutMs);
        assert.ok(request.config.abortSignal instanceof AbortSignal);
    }
});
