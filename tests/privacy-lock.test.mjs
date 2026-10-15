import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivacyLock, parsePrivacyLock, privacyLockKey, verifyPrivacyLock } from '../privacy-lock.mjs';
import { CLOUD_SYNC_KEYS, CLOUD_LOCAL_CLEAR_KEYS } from '../sync-config.mjs';

test('privacy verifier is salted, scoped to its owner and contains no password', async () => {
    const phrase = 'synthetic-privacy-phrase';
    const a = await createPrivacyLock('owner-a', phrase);
    const b = await createPrivacyLock('owner-a', phrase);
    assert.notEqual(a.salt, b.salt);
    assert.notEqual(a.verifier, b.verifier);
    assert.equal(JSON.stringify(a).includes(phrase), false);
    assert.equal(await verifyPrivacyLock('owner-a', phrase, a), true);
    assert.equal(await verifyPrivacyLock('owner-a', 'incorrect-password', a), false);
    assert.equal(await verifyPrivacyLock('owner-b', phrase, a), false);
    assert.deepEqual(parsePrivacyLock(JSON.stringify({ ...a, locked: true })), { ...a, locked: true });
    assert.equal(CLOUD_SYNC_KEYS.includes(privacyLockKey('owner-a')), false);
    assert.equal(CLOUD_LOCAL_CLEAR_KEYS.includes(privacyLockKey('owner-a')), false);
});

test('invalid lock data fails closed instead of silently removing protection', async () => {
    assert.equal(parsePrivacyLock(null), null);
    for (const raw of ['', '{}', 'null', '{"locked":false}', '{invalid']) assert.throws(() => parsePrivacyLock(raw));
    const a = await createPrivacyLock('owner', 'long-test-password');
    for (const change of [{ iterations: 1 }, { version: 2 }, { salt: 'AAAA' }, { verifier: 'AAAA' }, { locked: 'false' }]) {
        assert.throws(() => parsePrivacyLock(JSON.stringify({ ...a, ...change })));
    }
    await assert.rejects(createPrivacyLock('', 'long-test-password'));
    await assert.rejects(createPrivacyLock('owner', 'short'));
    await assert.rejects(createPrivacyLock('owner', 'x'.repeat(257)));
});
