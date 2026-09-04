import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    combineChunkTranscripts,
    exportAsMarkdown,
    exportAsPlainText,
    formatDuration,
    normalizeSessionRow,
    searchTranscriptions
} from '../transcription-utils.mjs';
import { validateMediaFile } from '../audio-importer.mjs';
import {
    TranscriptionCloudService,
    getResumableUploadEndpoint
} from '../transcription-service.mjs';
import { APP_MODULES } from '../custom-tracker-utils.mjs';

const ROOT = process.cwd();

test('transcription sessions normalize private database rows and derived documents', () => {
    const session = normalizeSessionRow({
        id: 'session-1',
        title: 'Entrevista técnica',
        source_type: 'recording',
        status: 'completed',
        language: 'es-AR',
        duration_ms: 125_000,
        expected_chunks: 2,
        completed_chunks: 2,
        created_at: '2026-09-04T01:00:00.000Z'
    }, [
        { session_id: 'session-1', kind: 'transcript', content: 'Texto completo', user_edited: false },
        { session_id: 'session-1', kind: 'summary', content: 'Resumen separado' }
    ]);

    assert.equal(session.durationSeconds, 125);
    assert.equal(session.transcript, 'Texto completo');
    assert.equal(session.summary, 'Resumen separado');
    assert.equal(session.expectedChunks, 2);
});

test('media validator accepts supported audio and video but enforces the import budget', () => {
    assert.deepEqual(
        validateMediaFile({ name: 'reunion.mp3', size: 5 * 1024 * 1024, type: 'audio/mpeg' }).valid,
        true
    );
    assert.deepEqual(
        validateMediaFile({ name: 'clase.mp4', size: 20 * 1024 * 1024, type: 'video/mp4' }).valid,
        true
    );
    assert.equal(
        validateMediaFile({ name: 'archivo.exe', size: 500, type: 'application/octet-stream' }).valid,
        false
    );
    const oversized = validateMediaFile({
        name: 'clase.wav',
        size: 50 * 1024 * 1024 + 1,
        type: 'audio/wav'
    });
    assert.equal(oversized.valid, false);
    assert.match(oversized.error, /supera 50 MB/);
});

test('cloud service refuses unauthenticated access before touching Supabase', () => {
    const service = new TranscriptionCloudService({ auth: { user: null, supabase: null } });
    assert.throws(() => service.assertReady(), /Supabase todavía no está disponible/);
});

test('large imports use the direct resumable Storage endpoint when available', () => {
    assert.equal(
        getResumableUploadEndpoint('https://kuxbdnsnuocvoaqehurn.supabase.co'),
        'https://kuxbdnsnuocvoaqehurn.storage.supabase.co/storage/v1/upload/resumable'
    );
    assert.equal(
        getResumableUploadEndpoint('http://127.0.0.1:54321'),
        'http://127.0.0.1:54321/storage/v1/upload/resumable'
    );
    const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const serviceSource = fs.readFileSync(path.join(ROOT, 'transcription-service.mjs'), 'utf8');
    assert.match(indexSource, /vendor\/tus\.min\.js\?v=4\.3\.1/);
    assert.match(serviceSource, /findPreviousUploads\(\)/);
    assert.match(serviceSource, /chunkSize: RESUMABLE_UPLOAD_CHUNK_BYTES/);
});

test('chunk transcripts are combined deterministically without AI rewriting', () => {
    const combined = combineChunkTranscripts([
        { sequence_number: 2, transcript_text: 'Tercero' },
        { sequence_number: 0, transcript_text: 'Primero' },
        { sequence_number: 1, transcript_text: 'Segundo' }
    ]);
    assert.equal(combined, 'Primero\n\nSegundo\n\nTercero');
});

test('search, duration and text exports preserve the complete transcript', () => {
    const sessions = [
        normalizeSessionRow({ id: '1', title: 'Reunión LifeCycle', status: 'completed' }, [
            { session_id: '1', kind: 'transcript', content: 'Hablamos del plan de fases' }
        ]),
        normalizeSessionRow({ id: '2', title: 'Compras', status: 'completed' }, [
            { session_id: '2', kind: 'transcript', content: 'Frutas y verduras' }
        ])
    ];

    assert.equal(searchTranscriptions(sessions, 'fases')[0].id, '1');
    assert.equal(formatDuration(65), '01:05');
    assert.equal(formatDuration(3600), '01:00:00');
    assert.match(exportAsPlainText(sessions[0]), /Hablamos del plan de fases/);
    assert.match(exportAsMarkdown(sessions[0]), /## Transcripción completa/);
});

test('persistent queue separates preparation, transcription and optional artifacts', () => {
    const migration = fs.readFileSync(path.join(
        ROOT,
        'supabase',
        'migrations',
        '20260904035623_transcription_pipeline.sql'
    ), 'utf8');
    const worker = fs.readFileSync(path.join(ROOT, 'transcription-worker.js'), 'utf8');

    assert.match(migration, /'prepare', 'transcribe', 'summary', 'notes'/);
    assert.match(migration, /reserve_transcription_provider_attempt/);
    assert.match(migration, /complete_transcription_prepare_job/);
    assert.match(migration, /complete_transcription_chunk_job/);
    assert.match(worker, /this\.ai\.interactions\.create/);
    assert.match(worker, /prepareMediaSegments/);
    assert.match(worker, /getProviderLanguageCodes\(session\.language\)/);
});

test('Transcriptions is integrated into navigation, search, recording and exports', () => {
    assert.equal(APP_MODULES['transcripciones-section']?.label, 'Transcripciones');
    const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const searchSource = fs.readFileSync(path.join(ROOT, 'modules', 'GlobalSearchModule.js'), 'utf8');
    assert.match(indexSource, /id="transcripciones-section"/);
    assert.match(indexSource, /id="transcription-detail-modal"/);
    assert.match(indexSource, /id="btn-toggle-record-voice"/);
    assert.match(indexSource, /accept="audio\/\*,video\/\*"/);
    assert.match(indexSource, /id="btn-generate-ai-summary"/);
    assert.match(indexSource, /id="btn-generate-ai-notes"/);
    assert.match(appSource, /this\.transcriptions = new TranscriptionsModule/);
    assert.match(searchSource, /getTranscriptionItems/);
    assert.match(searchSource, /command:transcripciones/);
});
