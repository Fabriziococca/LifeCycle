import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivacyLock, parsePrivacyLock, privacyLockKey, verifyPrivacyLock } from '../privacy-lock.mjs';
import { CLOUD_SYNC_KEYS, CLOUD_LOCAL_CLEAR_KEYS } from '../sync-config.mjs';
import { PrivacyLockModule } from '../modules/PrivacyLockModule.js';

async function lockRequestFixture(t) {
    const previousStorage = globalThis.localStorage;
    const record = await createPrivacyLock('owner-a', 'synthetic-privacy-phrase');
    const values = new Map([[privacyLockKey('owner-a'), JSON.stringify(record)]]);
    globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    t.after(() => { globalThis.localStorage = previousStorage; });
    let confirm;
    let confirmations = 0;
    const lock = Object.assign(Object.create(PrivacyLockModule.prototype), {
        authenticated: true, ownerId: 'owner-a', busy: false, locked: false, confirmingLock: false,
        app: { confirmAction() { confirmations++; return new Promise(resolve => { confirm = resolve; }); } },
        error() {}, render() { this.locked = this.record?.locked === true; }
    });
    return { lock, values, decide: value => confirm(value), count: () => confirmations };
}

test('canceling a lock request leaves the app unlocked and preserves the local configuration', async t => {
    const {lock, values, decide} = await lockRequestFixture(t);
    const before = values.get(privacyLockKey('owner-a'));
    const pending = lock.requestLock();
    assert.equal(lock.locked, false);
    assert.equal(values.get(privacyLockKey('owner-a')), before);
    decide(false);
    await pending;
    assert.equal(values.get(privacyLockKey('owner-a')), before);
    assert.equal(lock.locked, false);
    assert.equal(lock.confirmingLock, false);
});

test('confirming locks once and preserves a verifier changed while the confirmation was open', async t => {
    const {lock, values, decide, count} = await lockRequestFixture(t);
    const pending = lock.requestLock();
    await lock.requestLock();
    assert.equal(count(), 1, 'rapid clicks queued duplicate confirmations');
    const newer = await createPrivacyLock('owner-a', 'a-new-synthetic-phrase');
    values.set(privacyLockKey('owner-a'), JSON.stringify(newer));
    decide(true);
    await pending;
    assert.equal(lock.locked, true);
    assert.deepEqual(JSON.parse(values.get(privacyLockKey('owner-a'))), { ...newer, locked: true });
    assert.equal(lock.confirmingLock, false);
});

test('a pending lock confirmation cannot write into a different account', async t => {
    const {lock, values, decide} = await lockRequestFixture(t);
    const before = values.get(privacyLockKey('owner-a'));
    const pending = lock.requestLock();
    lock.ownerId = 'owner-b';
    decide(true);
    await pending;
    assert.equal(values.get(privacyLockKey('owner-a')), before);
    assert.equal(values.has(privacyLockKey('owner-b')), false);
    assert.equal(lock.locked, false);
});

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
