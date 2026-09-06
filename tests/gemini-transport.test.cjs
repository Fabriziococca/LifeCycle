'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { GoogleGenAI } = require('@google/genai');
const { TranscriptionWorker, getProviderHttpOptions } = require('../transcription-worker.js');

for (const providerStatus of [200, 404, 429]) {
    test(`el SDK conserva el protocolo de subida y limpia el audio tras transcribir (HTTP ${providerStatus})`, { timeout: 15_000 }, async t => {
        const audioBytes = Buffer.from('synthetic transport fixture; no real audio or credentials');
        const requests = [];
        let baseUrl;
        const server = http.createServer(async (request, response) => {
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            const body = Buffer.concat(chunks);
            const url = new URL(request.url, baseUrl);
            const call = { method: request.method, path: url.pathname, headers: request.headers, body };
            requests.push(call);
            response.setHeader('Content-Type', 'application/json');
            if (request.method === 'POST' && url.pathname === '/upload/v1beta/files') {
                if (!url.searchParams.has('upload_id')) {
                    response.setHeader('x-goog-upload-url', `${baseUrl}/upload/v1beta/files?upload_id=fixture`);
                    response.end('{}');
                } else {
                    response.setHeader('x-goog-upload-status', 'final');
                    response.end(JSON.stringify({ file: {
                        name: 'files/fixture', uri: `${baseUrl}/v1beta/files/fixture`,
                        mimeType: 'audio/wav', state: 'ACTIVE'
                    } }));
                }
            } else if (request.method === 'POST' && url.pathname === '/v1beta/interactions') {
                response.statusCode = providerStatus;
                response.end(JSON.stringify(providerStatus === 200 ? {
                    id: 'fixture-interaction', status: 'completed',
                    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Transcripción completa de prueba.' }] }]
                } : { error: { code: providerStatus, message: 'Synthetic provider error' } }));
            } else if (request.method === 'DELETE' && url.pathname === '/v1beta/files/fixture') {
                response.end('{}');
            } else {
                response.statusCode = 404;
                response.end(JSON.stringify({ error: { code: 404, message: 'Unexpected SDK request path' } }));
            }
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

        const session = { id: 'session', language: 'es-AR', context: '' };
        const chunk = { mime_type: 'audio/wav', byte_size: audioBytes.length, storage_path: 'fixture/audio.wav', sequence_number: 0 };
        const completions = [];
        const worker = new TranscriptionWorker({ apiKey: 'test-key-not-a-credential', supabase: {
            from: table => ({
                select() { return this; }, eq() { return this; },
                single: async () => ({ data: table === 'transcription_sessions' ? session : chunk })
            }),
            storage: { from: () => ({ download: async () => ({ data: new Blob([audioBytes]) }) }) },
            rpc: async (name, parameters) => {
                if (name === 'reserve_transcription_provider_attempt') return { data: true };
                assert.equal(name, 'complete_transcription_chunk_job');
                completions.push(parameters);
                return { error: null };
            }
        } });
        // Exercise the installed SDK's transport, not a mock of files.upload.
        // Only the external HTTP service and database are replaced.
        worker.ai = new GoogleGenAI({
            apiKey: 'test-key-not-a-credential', vertexai: false,
            httpOptions: { ...getProviderHttpOptions(worker.providerRequestTimeoutMs), baseUrl }
        });
        const operation = worker.processTranscriptionJob({ id: 'job', session_id: session.id, chunk_id: 'chunk' });
        if (providerStatus === 200) await operation;
        else await assert.rejects(operation, error => error.status === providerStatus);

        assert.deepEqual(requests.map(request => `${request.method} ${request.path}`), [
            'POST /upload/v1beta/files', 'POST /upload/v1beta/files',
            'POST /v1beta/interactions', 'DELETE /v1beta/files/fixture'
        ]);
        assert.equal(requests[0].headers['x-goog-upload-protocol'], 'resumable');
        assert.equal(requests[0].headers['x-goog-upload-command'], 'start');
        assert.equal(requests[0].headers['x-goog-upload-header-content-length'], String(audioBytes.length));
        assert.equal(requests[0].headers['x-goog-upload-header-content-type'], 'audio/wav');
        assert.deepEqual(requests[1].body, audioBytes);
        const interaction = JSON.parse(requests[2].body);
        assert.equal(interaction.model, 'gemini-3.5-transcribe');
        assert.equal(interaction.store, false);
        assert.deepEqual(interaction.generation_config.transcription_config.language_codes, ['es-419']);
        assert.deepEqual(interaction.generation_config.transcription_config.mode, { type: 'verbatim' });
        assert.equal(completions.length, providerStatus === 200 ? 1 : 0);
        if (providerStatus === 200) assert.equal(completions[0].p_transcript, 'Transcripción completa de prueba.');
    });
}
