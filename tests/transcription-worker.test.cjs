const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

const {
    DailyQuotaError,
    getProviderCustomVocabulary,
    getProviderHttpOptions,
    getProviderLanguageCodes,
    getNextUtcQuotaWindow,
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
});
