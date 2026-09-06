import test from 'node:test';
import assert from 'node:assert/strict';
import { TranscriptionCloudService } from '../transcription-service.mjs';

test('el aviso de servidor sin Gemini conserva el trabajo en cola y no oculta el 503', async t => {
    const calls = [];
    const service = new TranscriptionCloudService({
        auth: {user:{id:'owner'}, supabase:{
            auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})},
            rpc:async name=>{calls.push(name);return {data:1,error:null};}
        }},
        transcriptions:{render:()=>calls.push('render')}
    });
    t.mock.method(globalThis, 'fetch', async ()=>new Response('{}',{status:503}));
    assert.equal(await service.enqueueSession('session'),1);
    assert.match(service.workerWakeWarning,/quedó en cola.*falta habilitar/);
    assert.deepEqual(calls,['enqueue_transcription_session','render']);
    globalThis.fetch = async ()=>new Response('{}',{status:202});
    assert.equal(await service.wakeWorker(),true);
    assert.equal(service.workerWakeWarning,'');
});
