import test from 'node:test';
import assert from 'node:assert/strict';
import { removeSessionAudioObjects } from '../transcription-storage-utils.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const session = '22222222-2222-4222-8222-222222222222';

test('la limpieza incluye fragmentos huérfanos, pagina antes de borrar y limita rutas a la sesión', async () => {
    const files = Array.from({length: 105}, (_, i) => ({name: `prepared_${i}.m4a`, id: String(i)}));
    const calls = [];
    const bucket = {
        async list(prefix, options) {
            calls.push('list');
            assert.equal(prefix, `${owner}/${session}`);
            return {data: files.slice(options.offset, options.offset + options.limit)};
        },
        async remove(paths) {
            calls.push('remove');
            assert.ok(paths.every(p => p.startsWith(`${owner}/${session}/prepared_`)));
            return {error: null};
        }
    };
    assert.equal(await removeSessionAudioObjects(bucket, owner, session), 105);
    assert.deepEqual(calls, ['list', 'list', 'remove', 'remove']);
});

test('errores de inventario o rutas inválidas impiden borrar audio o marcar la limpieza correcta', async () => {
    const bucket = {async remove() { assert.fail('No debe borrar'); }};
    await assert.rejects(removeSessionAudioObjects(bucket, '', session), /válidas/);
    bucket.list = async () => ({error: new Error('offline')});
    await assert.rejects(removeSessionAudioObjects(bucket, owner, session), /offline/);
    bucket.list = async () => ({data: [{name:'../otro-audio.m4a'}]});
    await assert.rejects(removeSessionAudioObjects(bucket, owner, session), /inesperada/);
    bucket.list = async () => ({data: null});
    await assert.rejects(removeSessionAudioObjects(bucket, owner, session), /inventario/);
});
