import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getAppModules } from '../custom-tracker-utils.mjs';
import { isProductModuleEnabled, TRANSCRIPTIONS_ENABLED } from '../product-features.mjs';
import { GlobalSearchModule } from '../modules/GlobalSearchModule.js';
const { TranscriptionWorker } = createRequire(import.meta.url)('../transcription-worker.js');

test('archived transcription worker never polls, processes or cleans up even with credentials', async () => {
    let calls = 0;
    const worker = new TranscriptionWorker({
        enabled: TRANSCRIPTIONS_ENABLED,
        supabase: { rpc() { calls++; throw new Error('Unexpected cloud call'); } },
        apiKey: 'test-not-a-real-key'
    });
    assert.equal(worker.ai, null);
    assert.equal(worker.start(), false);
    assert.equal(worker.kick(), false);
    assert.equal(await worker.runOnce(), false);
    assert.equal(worker.timer, null);
    assert.equal(calls, 0);
});

test('transcriptions remain in legacy registry but cannot be opened or offered in active navigation', () => {
    assert.equal(isProductModuleEnabled('transcripciones-section'), false);
    assert.equal(getAppModules()['transcripciones-section'], undefined);
    assert.equal(getAppModules([], { includeArchived: true })['transcripciones-section'].label, 'Transcripciones');
    assert.equal(isProductModuleEnabled('finanzas-section'), true);
    const search = Object.assign(Object.create(GlobalSearchModule.prototype), { app: {} });
    assert.equal(search.getCommandItems().some(item => item.id === 'command:transcripciones'), false);
});
