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
