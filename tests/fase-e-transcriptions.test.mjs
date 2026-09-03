import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    normalizeTranscription,
    normalizeTranscriptionRegistry,
    searchTranscriptions,
    exportAsPlainText,
    exportAsMarkdown,
    formatDuration,
    MAX_STORED_TRANSCRIPTIONS
} from '../transcription-utils.mjs';

import { validateAudioFile } from '../audio-importer.mjs';
import { transcribeAudio, generateSummary } from '../transcription-service.mjs';
import { APP_MODULES } from '../custom-tracker-utils.mjs';

const ROOT = process.cwd();

test('Tanda 19: transcription data model normalizes fields and caps storage count', () => {
    const item = normalizeTranscription({
        title: 'Entrevista técnica',
        durationSeconds: 125,
        rawText: 'Transcripción original de prueba',
        tags: ['entrevista', 'react']
    });

    assert.equal(item.title, 'Entrevista técnica');
    assert.equal(item.durationSeconds, 125);
    assert.equal(item.rawText, 'Transcripción original de prueba');
    assert.equal(item.status, 'completed');
    assert.deepEqual(item.tags, ['entrevista', 'react']);

    // Capping overflow test
    const fakeItems = Array.from({ length: 120 }, (_, i) => ({
        id: `trans_${i}`,
        title: `Nota ${i}`,
        rawText: 'Contenido'
    }));
    const registry = normalizeTranscriptionRegistry({ transcriptions: fakeItems });
    assert.equal(registry.transcriptions.length, MAX_STORED_TRANSCRIPTIONS);
});

test('Tanda 20B: audio validator allows valid formats and rejects oversized files', () => {
    const validMp3 = { name: 'reunion.mp3', size: 5 * 1024 * 1024, type: 'audio/mpeg' };
    assert.equal(validateAudioFile(validMp3).valid, true);

    const validWebm = { name: 'nota.webm', size: 1 * 1024 * 1024, type: 'audio/webm' };
    assert.equal(validateAudioFile(validWebm).valid, true);

    const invalidExt = { name: 'documento.exe', size: 500, type: 'application/octet-stream' };
    assert.equal(validateAudioFile(invalidExt).valid, false);

    const oversized = { name: 'pesado.wav', size: 30 * 1024 * 1024, type: 'audio/wav' }; // 30 MB > 25 MB
    const resultOversized = validateAudioFile(oversized);
    assert.equal(resultOversized.valid, false);
    assert.match(resultOversized.error, /supera el límite/);
});

test('Tanda 21 & 22: transcription service validates audio input and builds structured requests', async () => {
    const noAudio = await transcribeAudio({ audioBase64: '' });
    assert.equal(noAudio.success, false);
    assert.match(noAudio.error, /No se suministró contenido/);

    // Missing API key handled gracefully without crashing
    const withAudio = await transcribeAudio({ audioBase64: 'AAAA', apiKey: '' });
    assert.equal(withAudio.success, false);
    assert.match(withAudio.error, /Clave de API/);
});

test('Tanda 23: search, duration formatting and multi-format exports (.txt, .md)', () => {
    const transcriptions = [
        normalizeTranscription({ id: '1', title: 'Reunión LifeCycle', rawText: 'Hablamos del plan de fases' }),
        normalizeTranscription({ id: '2', title: 'Compras supermercado', rawText: 'Comprar frutas y verduras' })
    ];

    const search1 = searchTranscriptions(transcriptions, 'fases');
    assert.equal(search1.length, 1);
    assert.equal(search1[0].id, '1');

    const search2 = searchTranscriptions(transcriptions, 'super');
    assert.equal(search2.length, 1);
    assert.equal(search2[0].id, '2');

    assert.equal(formatDuration(65), '01:05');
    assert.equal(formatDuration(3600), '60:00');

    const plainTxt = exportAsPlainText(transcriptions[0]);
    assert.match(plainTxt, /Título: Reunión LifeCycle/);
    assert.match(plainTxt, /Hablamos del plan de fases/);

    const md = exportAsMarkdown(transcriptions[0]);
    assert.match(md, /# Reunión LifeCycle/);
    assert.match(md, /## Transcripción Completa/);
});

test('Tanda 24 & 25: TranscriptionsModule is registered in navigation, search and AI summaries', () => {
    assert.ok(APP_MODULES['transcripciones-section']);
    assert.equal(APP_MODULES['transcripciones-section'].label, 'Transcripciones');

    const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.match(indexSource, /id="transcripciones-section"/);
    assert.match(indexSource, /id="transcription-detail-modal"/);
    assert.match(indexSource, /id="btn-toggle-record-voice"/);
    assert.match(indexSource, /id="btn-import-audio-file"/);
    assert.match(indexSource, /id="btn-generate-ai-summary"/);

    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(appSource, /TranscriptionsModule/);
    assert.match(appSource, /this\.transcriptions = new TranscriptionsModule/);

    const searchSource = fs.readFileSync(path.join(ROOT, 'modules', 'GlobalSearchModule.js'), 'utf8');
    assert.match(searchSource, /getTranscriptionItems/);
    assert.match(searchSource, /command:transcripciones/);
});