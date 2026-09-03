import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    GEMINI_CONFIG,
    AUDIO_CONSTRAINTS,
    TRANSCRIPTION_PRIVACY_NOTICE,
    evaluateQuotaUsage,
    buildTranscriptionPrompt
} from '../audio-transcription-config.mjs';

import { AudioRecorder } from '../audio-recorder.mjs';

const ROOT = process.cwd();

test('Tanda 16A: Gemini Free Tier limits and verbatim prompt formatting', () => {
    assert.equal(GEMINI_CONFIG.tier, 'free');
    assert.equal(GEMINI_CONFIG.maxRPM, 15);
    assert.equal(GEMINI_CONFIG.maxRPD, 1500);
    assert.equal(GEMINI_CONFIG.costPerMonthUSD, 0.00);

    assert.ok(TRANSCRIPTION_PRIVACY_NOTICE.required);
    assert.match(TRANSCRIPTION_PRIVACY_NOTICE.text, /Google Gemini/);

    const prompt = buildTranscriptionPrompt({ language: 'es-AR', context: 'Proyectos freelance' });
    assert.match(prompt, /fiel \(verbatim\)/);
    assert.match(prompt, /es-AR/);
    assert.match(prompt, /Proyectos freelance/);
});

test('Tanda 16B: quota evaluation returns warnings at 70%, 85% and pauses at 95%', () => {
    const okState = evaluateQuotaUsage(100, 2);
    assert.equal(okState.level, 'ok');
    assert.equal(okState.allowed, true);

    const warnState = evaluateQuotaUsage(1050, 5); // 70% of 1500
    assert.equal(warnState.level, 'warning_70');
    assert.equal(warnState.allowed, true);

    const restrictedState = evaluateQuotaUsage(1275, 5); // 85% of 1500
    assert.equal(restrictedState.level, 'restricted_85');
    assert.equal(restrictedState.allowed, true);

    const pausedDaily = evaluateQuotaUsage(1425, 5); // 95% of 1500
    assert.equal(pausedDaily.level, 'paused_95');
    assert.equal(pausedDaily.allowed, false);

    const pausedMinute = evaluateQuotaUsage(10, 15); // 100% of 15 RPM
    assert.equal(pausedMinute.level, 'paused_95');
    assert.equal(pausedMinute.allowed, false);
});

test('Tanda 17A, 17B, 17C: architecture documentation validates PWA decision and Android screen wake lock', () => {
    const archDoc = fs.readFileSync(path.join(ROOT, 'docs', 'ARQUITECTURA_AUDIO_ANDROID.md'), 'utf8');
    const budgetDoc = fs.readFileSync(path.join(ROOT, 'docs', 'PRESUPUESTO_OPERATIVO.md'), 'utf8');

    assert.match(archDoc, /PWA Pura/);
    assert.match(archDoc, /Screen Wake Lock API/);
    assert.match(archDoc, /audio\/webm;codecs=opus/);
    assert.match(archDoc, /32 kbps/);

    assert.match(budgetDoc, /Gemini/);
    assert.match(budgetDoc, /Supabase/);
    assert.match(budgetDoc, /Render/);
    assert.match(budgetDoc, /efímera/);
});

test('Tanda 18A & 18B: AudioRecorder chunking slices data accurately and respects constraints', () => {
    assert.equal(AUDIO_CONSTRAINTS.targetBitrate, 32000);
    assert.equal(AUDIO_CONSTRAINTS.maxDurationSeconds, 1800);
    assert.equal(AUDIO_CONSTRAINTS.chunkSizeBytes, 1024 * 1024);

    // Mocking Blob chunking
    const dummyBytes = new Uint8Array(2500000); // 2.5 MB
    const dummyBlob = new Blob([dummyBytes], { type: 'audio/webm' });

    const chunks = AudioRecorder.splitIntoChunks(dummyBlob, 1000000);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].size, 1000000);
    assert.equal(chunks[1].size, 1000000);
    assert.equal(chunks[2].size, 500000);
});