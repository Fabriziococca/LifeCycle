import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import {
    TRANSCRIPTION_PROVIDER,
    AUDIO_CONSTRAINTS,
    TRANSCRIPTION_PRIVACY_NOTICE,
    evaluateQuotaUsage,
    buildTranscriptionPrompt
} from '../audio-transcription-config.mjs';
import { AudioRecorder } from '../audio-recorder.mjs';

const ROOT = process.cwd();

test('Gemini starts behind a zero-cost safety budget and explicit privacy consent', () => {
    assert.equal(TRANSCRIPTION_PROVIDER.mode, 'google-ai-studio-free');
    assert.equal(TRANSCRIPTION_PROVIDER.transcriptionModel, 'gemini-3.5-transcribe');
    assert.equal(TRANSCRIPTION_PROVIDER.hardDailyJobLimit, 100);
    assert.equal(TRANSCRIPTION_PROVIDER.costPerMonthUSD, 0);
    assert.equal(TRANSCRIPTION_PRIVACY_NOTICE.required, true);
    assert.match(TRANSCRIPTION_PRIVACY_NOTICE.text, /Google Gemini/);
    assert.match(TRANSCRIPTION_PRIVACY_NOTICE.text, /24 horas/);

    const prompt = buildTranscriptionPrompt({ language: 'es-AR', context: 'Ingeniería de software' });
    assert.match(prompt, /completa, fiel/);
    assert.match(prompt, /no inventes palabras/i);
    assert.match(prompt, /Ingeniería de software/);
});

test('local provider budget warns at 80 percent and pauses before request 101', () => {
    assert.deepEqual(
        { level: evaluateQuotaUsage(79).level, allowed: evaluateQuotaUsage(79).allowed },
        { level: 'ok', allowed: true }
    );
    assert.deepEqual(
        { level: evaluateQuotaUsage(80).level, allowed: evaluateQuotaUsage(80).allowed },
        { level: 'warning', allowed: true }
    );
    assert.deepEqual(
        { level: evaluateQuotaUsage(100).level, allowed: evaluateQuotaUsage(100).allowed },
        { level: 'paused', allowed: false }
    );
});

test('capture constraints match the three-hour, five-minute-segment architecture', () => {
    assert.equal(AUDIO_CONSTRAINTS.targetBitrate, 48_000);
    assert.equal(AUDIO_CONSTRAINTS.sampleRate, 48_000);
    assert.equal(AUDIO_CONSTRAINTS.channels, 1);
    assert.equal(AUDIO_CONSTRAINTS.segmentDurationSeconds, 5 * 60);
    assert.equal(AUDIO_CONSTRAINTS.maxDurationSeconds, 3 * 60 * 60);
    assert.equal(AUDIO_CONSTRAINTS.maxChunkSizeBytes, 50 * 1024 * 1024);
    assert.equal(AUDIO_CONSTRAINTS.successfulAudioRetentionHours, 24);
});

test('web recorder closes a segment without waiting for its network upload', async () => {
    const recorder = new AudioRecorder();
    const listeners = new Map();
    recorder.mediaRecorder = {
        state: 'recording',
        mimeType: 'audio/webm;codecs=opus',
        addEventListener(name, callback) {
            const callbacks = listeners.get(name) || [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
        },
        stop() {
            this.state = 'inactive';
            for (const callback of listeners.get('stop') || []) callback();
        }
    };
    recorder.segmentStartedAt = Date.now() - 1000;
    recorder.segmentChunks = [new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })];
    recorder.callbacks.onSegment = () => new Promise(() => {});

    const result = await Promise.race([
        recorder._finishCurrentSegment(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('segment rotation waited for upload')), 100))
    ]);
    assert.equal(result.sequenceNumber, 0);
    assert.equal(result.byteSize, 3);
});

test('Android uses a microphone foreground service and partial wake lock', () => {
    const manifest = fs.readFileSync(path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
    const service = fs.readFileSync(path.join(
        ROOT,
        'android', 'app', 'src', 'main', 'java', 'com', 'fabriziococca', 'lifecycle',
        'LifeCycleAudioRecorderService.java'
    ), 'utf8');

    assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
    assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_MICROPHONE/);
    assert.match(manifest, /android\.permission\.WAKE_LOCK/);
    assert.match(manifest, /android:foregroundServiceType="microphone"/);
    assert.match(service, /FOREGROUND_SERVICE_TYPE_MICROPHONE/);
    assert.match(service, /PowerManager\.PARTIAL_WAKE_LOCK/);
    assert.match(service, /segmentDurationSeconds/);
});

test('Capacitor routes relative API calls to Render and preserves external URLs', async () => {
    const runtime = fs.readFileSync(path.join(ROOT, 'native-runtime.js'), 'utf8');
    const targets = [];
    const sandbox = {
        URL,
        window: {
            Capacitor: { isNativePlatform: () => true },
            location: { origin: 'https://lifecycle.local' },
            fetch: async (input) => {
                targets.push(input);
                return { ok: true };
            }
        }
    };

    vm.runInNewContext(runtime, sandbox);
    await sandbox.window.fetch('/api/config?source=native');
    await sandbox.window.fetch('https://storage.example.test/signed-object');

    assert.deepEqual(targets, [
        'https://lifecycle-ykn5.onrender.com/api/config?source=native',
        'https://storage.example.test/signed-object'
    ]);
    assert.equal(sandbox.window.__LIFECYCLE_IS_NATIVE__, true);
});

test('server grants API CORS only to the configured Capacitor origin', () => {
    const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const capacitorConfig = fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8');

    assert.match(server, /NATIVE_APP_ORIGINS[\s\S]+https:\/\/lifecycle\.local/);
    assert.match(server, /Access-Control-Allow-Origin/);
    assert.match(server, /Access-Control-Allow-Headers[^\n]+Authorization, Content-Type/);
    assert.match(capacitorConfig, /"hostname":\s*"lifecycle\.local"/);
});
