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
