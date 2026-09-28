import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthSyncModule } from '../modules/AuthSyncModule.js';

function deferred() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
}

function fixture(t) {
    const previousWindow = globalThis.window;
    const events = [];
    globalThis.window = { dispatchEvent: event => events.push(event.detail.user?.id || null) };
    t.after(() => { globalThis.window = previousWindow; });
    const calls = { gates: [], pulls: 0, policy: 0, push: 0, channels: 0, cleared: 0 };
    const auth = Object.assign(Object.create(AuthSyncModule.prototype), {
        user: null, readyUserId: null, authGeneration: 0, activeAuthInitialization: null,
        supabase: { removeChannel() {} },
        pushManagement: { async refreshAll() { calls.push++; }, clear() {} },
        async checkAndSyncData() { calls.pulls++; return true; },
        async loadResourcePolicy() { calls.policy++; },
        async checkPushSubscriptionStatus() { calls.push++; },
        setupRealtimeSubscription() { calls.channels++; },
        clearLocalUserData() { calls.cleared++; },
        setLoading() {},
        setAccessGateState(state) { calls.gates.push(state); }
    });
    return { auth, calls, events };
}

test('same-user reconfirmation syncs silently without reinitializing session or Push', async t => {
    const { auth, calls, events } = fixture(t);
    const user = { id: 'first', email: 'test@example.invalid' };
    await auth.handleAuthStateChange(user);
    for (let i = 0; i < 5; i++) await auth.handleAuthStateChange({ ...user });
    assert.deepEqual(calls.gates, ['loading', 'authenticated']);
    assert.equal(calls.pulls, 6);
    assert.equal(calls.policy, 1);
    assert.equal(calls.channels, 1);
    assert.equal(calls.push, 2);
    assert.deepEqual(events, ['first']);
    auth.checkAndSyncData = async () => false;
    await auth.handleAuthStateChange(user);
    assert.equal(calls.gates.at(-1), 'authenticated');
});

test('duplicate sign-in events share initialization; sign-out cannot be undone by an old pull', async t => {
    const { auth, calls, events } = fixture(t);
    const gate = deferred();
    auth.checkAndSyncData = async () => { calls.pulls++; return gate.promise; };
    const first = auth.handleAuthStateChange({ id: 'first' });
    const second = auth.handleAuthStateChange({ id: 'first' });
    assert.equal(calls.pulls, 1);
    await auth.handleAuthStateChange(null);
    gate.resolve(true);
    await Promise.all([first, second]);
    assert.deepEqual(calls.gates, ['loading', 'logged-out']);
    assert.equal(auth.readyUserId, null);
    assert.equal(calls.policy, 0);
    assert.deepEqual(events, [null]);
});

test('a different account is gated and clears old account state', async t => {
    const { auth, calls, events } = fixture(t);
    await auth.handleAuthStateChange({ id: 'first' });
    await auth.handleAuthStateChange({ id: 'second' });
    assert.deepEqual(calls.gates, ['loading', 'authenticated', 'loading', 'authenticated']);
    assert.equal(calls.cleared, 1);
    assert.equal(auth.readyUserId, 'second');
    assert.deepEqual(events, ['first', 'second']);
});

test('late policy response cannot unlock a signed-out session', async t => {
    const { auth, calls } = fixture(t);
    const policy = deferred();
    auth.loadResourcePolicy = () => policy.promise;
    const first = auth.handleAuthStateChange({ id: 'first' });
    await Promise.resolve();
    await auth.handleAuthStateChange(null);
    policy.resolve(true);
    await first;
    assert.equal(calls.gates.at(-1), 'logged-out');
    assert.equal(calls.channels, 0);
});

test('initial failed cloud load does not reveal an authenticated view', async t => {
    const { auth, calls } = fixture(t);
    auth.checkAndSyncData = async () => false;
    await assert.rejects(auth.handleAuthStateChange({ id: 'first' }), /Supabase/);
    assert.deepEqual(calls.gates, ['loading']);
    assert.equal(auth.readyUserId, null);
});
