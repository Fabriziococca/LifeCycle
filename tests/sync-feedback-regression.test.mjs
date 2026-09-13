import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthSyncModule } from '../modules/AuthSyncModule.js';
import { AlertsModule } from '../modules/AlertsModule.js';
import { SubscriptionsModule } from '../modules/SubscriptionsModule.js';
import { normalizeSubscription } from '../subscription-utils.mjs';

function storage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

function fixture(t) {
    const previous = { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
    globalThis.localStorage = storage();
    globalThis.sessionStorage = storage();
    const app = {};
    const auth = Object.assign(Object.create(AuthSyncModule.prototype), {
        app, user: { id: 'fixture-user' }, pendingSyncKeys: new Set(), syncGeneration: 0,
        isRestoring: false, isSyncing: false, activeSyncPromise: null,
        cloudRevision: null, knownCloudData: null, resourcePolicy: { unlimited: true },
        appliedCloudRevision: null, activePullPromise: null, localEditGeneration: 0,
        updateSyncBadge() {}
    });
    app.auth = auth;
    app.triggerDataSync = key => auth.queueKeySync(key);
    app.alerts = Object.assign(Object.create(AlertsModule.prototype), { app, configs: {}, render() {} });
    app.subscriptions = Object.assign(Object.create(SubscriptionsModule.prototype), {
        app, subscriptions: [], render() {}, processDueAutomaticRenewals() {}
    });
    t.after(() => {
        clearTimeout(auth.syncFlushTimer);
        clearTimeout(auth.syncRetryTimer);
        clearTimeout(auth.realtimeRefreshTimer);
        Object.assign(globalThis, previous);
    });
    return { app, auth };
}

function cloudFixture(t) {
    const { auth } = fixture(t);
    const state = { row: { revision: 10, data: { tareas_list: '[{"id":"remote"}]' } }, requests: [], writes: 0 };
    auth.supabase = {
        from: () => ({
            select(columns) { this.columns = columns; return this; },
            eq(key, value) { this.userId = value; return this; },
            abortSignal(signal) { state.signal = signal; return this; },
            async maybeSingle() {
                state.requests.push({ columns: this.columns, userId: this.userId });
                const data = structuredClone(state.row);
                if (data && this.columns === 'revision') delete data.data;
                const result = state.missingRevision && this.columns.includes('revision')
                    ? { error: { code: '42703', message: 'user_data revision missing' } }
                    : { data, error: null };
                if (state.pause) await state.pause(this.columns);
                return result;
            }
        }),
        async rpc(name, parameters) {
            state.writes += 1;
            if (state.onWrite) return state.onWrite(parameters);
            Object.assign(state.row.data, parameters.p_updates || {});
            for (const key of parameters.p_delete_keys || []) delete state.row.data[key];
            state.row.revision += 1;
            return { data: new Date().toISOString(), error: null };
        },
        channel: () => ({ on(event, filter, listener) { state.listener = listener; return this; }, subscribe() { return this; } }),
        removeChannel() {}
    };
    return { auth, state };
}

function gate() {
    let release;
    const promise = new Promise(resolve => { release = resolve; });
    return { promise, release };
}

test('unchanged sync checks fetch only revision; changed data is still restored immediately', async t => {
    const { auth, state } = cloudFixture(t);
    assert.equal(await auth.checkAndSyncData(), true);
    assert.equal(auth.appliedCloudRevision, 10);
    for (let i = 0; i < 3; i++) assert.equal(await auth.checkAndSyncData(), true);
    assert.deepEqual(state.requests.map(r => r.columns), ['data, updated_at, revision', 'revision', 'revision', 'revision']);
    state.row = { revision: 11, data: { tareas_list: '[{"id":"other-device"}]' } };
    assert.equal(await auth.checkAndSyncData(), true);
    assert.equal(localStorage.getItem('tareas_list'), state.row.data.tareas_list);
    assert.equal(auth.appliedCloudRevision, 11);
    assert.equal(state.writes, 0);
});

test('simultaneous focus and visibility share a single cloud request', async t => {
    const { auth, state } = cloudFixture(t);
    const pending = gate();
    state.pause = () => pending.promise;
    const first = auth.checkAndSyncData();
    const second = auth.checkAndSyncData();
    assert.equal(first, second);
    assert.equal(state.requests.length, 1);
    pending.release();
    assert.equal(await first, true);
    assert.equal(auth.activePullPromise, null);
});

test('a local edit made and saved during a read is never overwritten by its stale response', async t => {
    const { auth, state } = cloudFixture(t);
    const pending = gate();
    state.pause = () => pending.promise;
    const read = auth.checkAndSyncData();
    localStorage.setItem('tareas_list', '[{"id":"local-edit"}]');
    auth.queueKeySync('tareas_list');
    assert.equal(await auth.flushPendingKeySync(), true);
    pending.release();
    assert.equal(await read, false);
    assert.equal(localStorage.getItem('tareas_list'), '[{"id":"local-edit"}]');
    state.pause = null;
    assert.equal(await auth.checkAndSyncData(), true);
    assert.equal(localStorage.getItem('tareas_list'), '[{"id":"local-edit"}]');
});

test('logout detaches pending reads and prevents cross-account restoration', async t => {
    const { auth, state } = cloudFixture(t);
    const pending = gate();
    state.pause = () => pending.promise;
    const read = auth.checkAndSyncData();
    auth.clearLocalUserData();
    auth.user = { id: 'another-user' };
    pending.release();
    assert.equal(await read, false);
    assert.equal(localStorage.getItem('tareas_list'), null);
    assert.equal(auth.appliedCloudRevision, null);
});

test('Realtime marks only applied snapshots and a late HTTP response cannot roll them back', async t => {
    const { auth, state } = cloudFixture(t);
    auth.setupRealtimeSubscription();
    const pending = gate();
    state.pause = () => pending.promise;
    const read = auth.checkAndSyncData();
    state.listener({ new: { revision: 11, data: { tareas_list: '[{"id":"newer"}]' } } });
    assert.equal(auth.appliedCloudRevision, 11);
    pending.release();
    assert.equal(await read, true);
    assert.equal(localStorage.getItem('tareas_list'), '[{"id":"newer"}]');
    auth.pendingSyncKeys.add('tareas_list');
    state.listener({ new: { revision: 12, data: { tareas_list: '[]' } } });
    assert.equal(auth.appliedCloudRevision, 11, 'an unapplied event cannot be treated as cached');
});

test('legacy revision-less schemas still read full documents and restore updates', async t => {
    const { auth, state } = cloudFixture(t);
    state.missingRevision = true;
    assert.equal(await auth.checkAndSyncData(), true);
    assert.equal(auth.appliedCloudRevision, null);
    state.row.data.tareas_list = '[]';
    assert.equal(await auth.checkAndSyncData(), true);
    assert.equal(localStorage.getItem('tareas_list'), '[]');
});

test('first-login row creation rereads data created concurrently on another device', async t => {
    const { auth, state } = cloudFixture(t);
    state.row = null;
    state.onWrite = async () => {
        state.row = { revision: 1, data: { tareas_list: '[{"id":"concurrent-device"}]' } };
        return { error: null };
    };
    assert.equal(await auth.checkAndSyncData(), true);
    assert.equal(localStorage.getItem('tareas_list'), state.row.data.tareas_list);
    assert.equal(state.writes, 1);
});

test('a blocked read times out and does not permanently block future synchronization', async t => {
    const { auth, state } = cloudFixture(t);
    t.mock.method(console, 'error', () => {});
    t.mock.timers.enable({ apis: ['setTimeout'] });
    state.pause = () => new Promise((resolve, reject) => state.signal.addEventListener('abort', () => reject(state.signal.reason)));
    const read = auth.checkAndSyncData();
    t.mock.timers.tick(15_000);
    assert.equal(await read, false);
    assert.equal(auth.activePullPromise, null);
    state.pause = null;
    assert.equal(await auth.checkAndSyncData(), true);
});

test('remote restores cannot enqueue writes through explicit module sync calls', t => {
    const { auth } = fixture(t);
    auth.isRestoring = true;
    auth.queueKeySync('alerts_config');
    assert.equal(auth.pendingSyncKeys.size, 0);
    auth.isRestoring = false;
    localStorage.setItem('tareas_list', '[{"id":"real-edit"}]');
    auth.queueKeySync('tareas_list');
    assert.deepEqual([...auth.pendingSyncKeys], ['tareas_list']);
});

test('Workana subscription hydration converges without a save/Realtime feedback loop', t => {
    const { app, auth } = fixture(t);
    const subscription = normalizeSubscription({
        id: 'sub_workana_plan', name: 'Workana', cost: 10, currency: 'USD',
        startDate: '2099-01-01', nextRenewalDate: '2099-02-01', expenseMode: 'manual'
    });
    localStorage.setItem('lifecycle_subscriptions', JSON.stringify({ version: 1, subscriptions: [subscription] }));
    app.alerts.loadData();
    const cloud = auth.gatherLocalData();
    for (let cycle = 0; cycle < 4; cycle += 1) {
        auth.restoreDataLocally(cloud);
        assert.equal(auth.pendingSyncKeys.size, 0, `restore ${cycle} queued an echo write`);
        assert.equal(app.alerts.configs.workana, undefined, 'legacy alert was resurrected');
        assert.ok(app.alerts.configs.sub_sub_workana_plan, `subscription alert was lost: ${JSON.stringify({ cycle, subscriptions: app.subscriptions.subscriptions.map(s => s.id), keys: Object.keys(app.alerts.configs) })}`);
    }
});
