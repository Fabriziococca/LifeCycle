import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getPauseAdjustedDate, normalizePauseState, setEntityPaused } from '../pause-utils.mjs';
import { createCustomTracker, createEmptyCustomTrackerRegistry, getCustomTrackerState, normalizeCustomTrackerRegistry, normalizeCustomTrackerDayThresholds, appendCustomTrackerRecords } from '../custom-tracker-utils.mjs';
import { normalizeSubscription, normalizeSubscriptionRegistry, isPaidSubscription } from '../subscription-utils.mjs';
import { SubscriptionsModule } from '../modules/SubscriptionsModule.js';
import { NotificationsCenterModule } from '../modules/NotificationsCenterModule.js';
import { normalizeVehicleCatalog, getVehicleCardState } from '../vehicle-catalog-utils.mjs';
import { migrateRecurringReminderConfigs, upsertRecurringReminder } from '../recurring-reminder-utils.mjs';
import { formatProjectDeadline, isProjectDeliveryPending } from '../project-status-utils.mjs';
const require = createRequire(import.meta.url);
const { buildCustomTrackerNotification, buildVehicleCatalogNotification, getStateReminderEntries, getPendingVeryUrgentTasks, isPushRetryRelevant } = require('../notification-utils.js');
const date = day => new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`);
const tracker = (template = 'routine') => createCustomTracker({ section: 'hygiene', name: 'Seguimiento de prueba', actionLabel: 'Registrar', template, intervalDays: 30, alert: { enabled: true } }, { id: 'ct_pause_test', now: date(1) });

test('provider retries cannot resurrect paused cards, reminders or arbitration deliveries', () => {
    const paused = setEntityPaused(tracker(), true, date(10));
    const snapshot = { hygiene_tracker_data: { __trackers_v2: { trackers: [paused], histories: {} } }, alerts_config: { laundry: { enabled: true, paused: true } }, projectPulseData: [{ id: 'qa_project', isArbitration: true }] };
    assert.equal(isPushRetryRelevant(paused.alertKey + '@22:00', snapshot), false);
    assert.equal(isPushRetryRelevant('laundry', snapshot), false);
    assert.equal(isPushRetryRelevant('project_qa_project_red', snapshot), false);
    assert.equal(isPushRetryRelevant('custom_tracker:ct_deleted', snapshot), false);
    assert.equal(isPushRetryRelevant('unrelated', snapshot), true);
});

test('pausing freezes elapsed time, preserves history and excludes paused records and notifications', () => {
    const original = tracker();
    const history = [date(1).toISOString()];
    const paused = setEntityPaused(original, true, date(10));
    assert.equal(getCustomTrackerState(paused, history, date(20)).elapsedDays, 9);
    assert.equal(getCustomTrackerState(paused, history, date(20)).status, 'paused');
    const registry = createEmptyCustomTrackerRegistry();
    registry.trackers = [paused]; registry.histories[paused.id] = history;
    const recorded = appendCustomTrackerRecords(registry, [paused.id], date(20));
    assert.deepEqual(recorded.recordedIds, []);
    assert.deepEqual(recorded.registry.histories[paused.id], history);
    assert.equal(buildCustomTrackerNotification(paused.alertKey, { __trackers_v2: registry }, () => 100).shouldNotify, false);
    const bell = NotificationsCenterModule.prototype.getOverdueItems.call({ app: { customTrackers: { registry, getHistory: () => history } } });
    assert.deepEqual(bell, []);
    assert.equal(normalizeCustomTrackerRegistry(JSON.parse(JSON.stringify(registry))).trackers[0].paused, true);
});

test('multiple pauses resume from frozen progress without inventing completed actions', () => {
    let item = setEntityPaused(tracker(), true, date(10));
    item = setEntityPaused(item, false, date(20));
    assert.equal(getCustomTrackerState(item, [date(1).toISOString()], date(21)).elapsedDays, 10);
    item = setEntityPaused(item, true, date(22));
    item = setEntityPaused(item, false, date(25));
    assert.equal(getCustomTrackerState(item, [date(1).toISOString()], date(26)).elapsedDays, 12);
    // A real new action after the pauses starts a fresh cycle.
    assert.equal(getCustomTrackerState(item, [date(25).toISOString()], date(26)).elapsedDays, 1);
    assert.equal(item.pausePeriods.length, 2);
});

test('overlapping imported pauses cannot double-freeze time', () => {
    const item = { pausePeriods: [{ startedAt: date(5), endedAt: date(10) }, { startedAt: date(8), endedAt: date(12) }] };
    assert.equal(getPauseAdjustedDate(item, date(1).toISOString(), date(20)), date(8).toISOString());
    assert.equal(normalizePauseState({ pausePeriods: [{ startedAt: 'bad', endedAt: date(10) }] }).pausePeriods.length, 0);
});

test('the separate supplement tracker also suppresses the bell and provider retries while paused', () => {
    const tracking = setEntityPaused({}, true, date(10));
    const supplements = { vit_d_tracking: tracking, vit_d_history: [{ date: '2026-01-01' }], vit_d_days_interval: 45 };
    assert.deepEqual(NotificationsCenterModule.prototype.getOverdueItems.call({ app: { gym: { supplements } } }), []);
    assert.equal(isPushRetryRelevant('vitamina_d', { gym_supplements: supplements }), false);
    assert.equal(getPauseAdjustedDate(undefined, '2026-10-01', date(10)), date(1).toISOString());
});

test('pending-state reminders and monthly trackers freeze across pause and resume', () => {
    const active = { ...tracker('state-reminder'), state: { active: true, activatedAt: date(1).toISOString() } };
    const paused = setEntityPaused(active, true, date(2));
    const registry = { __trackers_v2: { trackers: [paused], histories: {} } };
    assert.equal(getStateReminderEntries(registry)[0].active, false);
    assert.equal(getCustomTrackerState(paused, [], date(10)).elapsedHours, 24);
    const resumed = setEntityPaused(paused, false, date(10));
    assert.equal(getCustomTrackerState(resumed, [], date(11)).elapsedHours, 48);
    const monthly = { ...tracker('medical'), cadence: { unit: 'months', value: 1 }, thresholds: { warningDays: 5 } };
    assert.equal(getCustomTrackerState(setEntityPaused(monthly, true, date(3)), [date(1).toISOString()], date(25)).elapsedDays, 2);
});

test('automatic progressive thresholds recalculate at 70/85%, including short periods, without changing old manual values', () => {
    assert.deepEqual(normalizeCustomTrackerDayThresholds({ mode: 'automatic', red: 400, yellow: 2, orange: 3 }).thresholds, { mode: 'automatic', red: 400, yellow: 280, orange: 340 });
    assert.equal(normalizeCustomTrackerDayThresholds({ mode: 'automatic', red: 90 }).thresholds.yellow, 63);
    assert.equal(normalizeCustomTrackerDayThresholds({ mode: 'automatic', red: 350 }).thresholds.yellow, 245);
    assert.deepEqual(normalizeCustomTrackerDayThresholds({ mode: 'automatic', red: 1 }).thresholds, { mode: 'automatic', red: 1, yellow: 1, orange: 1 });
    assert.deepEqual(normalizeCustomTrackerDayThresholds({ red: 400, yellow: 180, orange: 270 }).thresholds, { red: 400, yellow: 180, orange: 270 });
});

test('free and trial subscriptions preserve real price through sync but cannot create manual expenses', async () => {
    for (const billingMode of ['trial', 'free']) {
        const sub = normalizeSubscription({ id: 'sub_trial_test', name: 'Servicio de prueba', cost: 20, billingMode, nextRenewalDate: '2026-10-01', autoRecordExpense: true });
        const restored = normalizeSubscriptionRegistry(JSON.stringify({ subscriptions: [sub] })).subscriptions[0];
        assert.equal(restored.cost, 20); assert.equal(restored.billingMode, billingMode);
        assert.equal(isPaidSubscription(restored), false);
        let expenses = 0;
        const module = { subscriptions: [restored], app: { finanzas: { recordSubscriptionExpense: () => { expenses++; } }, auth: { user: {}, supabase: {} } }, recordExpense: SubscriptionsModule.prototype.recordExpense };
        assert.equal(await module.recordExpense(sub.id), false);
        assert.equal(expenses, 0);
        assert.equal(module.subscriptions[0].nextRenewalDate, '2026-10-01');
    }
    assert.equal(normalizeSubscription({ name: 'Anterior', cost: 5 }).billingMode, 'paid');
});

test('arbitration removes delivery and urgent project task warnings without hiding unrelated tasks', () => {
    const p = { id: 'qa', isArbitration: true, project: 'Proyecto de prueba', deadline: date(1), accepted: new Date('2026-09-01'), tasks: [{ id: 'qa_task', urgency: 'muy_urgente' }] };
    const bell = NotificationsCenterModule.prototype.getOverdueItems.call({ app: { projects: { projects: [p] } } });
    assert.deepEqual(bell, []);
    assert.equal(isProjectDeliveryPending(p), false);
    assert.equal(isProjectDeliveryPending({ ...p, isArbitration: false }), true);
    assert.deepEqual(getPendingVeryUrgentTasks({ projectPulseData: [p], tareas_list: [{ id: 'general', urgency: 'muy_urgente' }] }).map(t => t.id), ['general']);
    assert.match(formatProjectDeadline(date(9)), /viernes, 09\/10\/2026 a las \d{2}:00 h/);
});

test('recurring reminder pause and all daily times survive editor saves and cloud migration', () => {
    const configs = upsertRecurringReminder({}, { id: 'reminder_pause_test', name: 'Prueba', category: 'higiene', times: ['09:00', '22:00'] });
    configs.reminder_pause_test.paused = true;
    const edited = upsertRecurringReminder(configs, { id: 'reminder_pause_test', name: 'Prueba editada' });
    const restored = migrateRecurringReminderConfigs(JSON.parse(JSON.stringify(edited)));
    assert.equal(restored.reminder_pause_test.paused, true);
    assert.deepEqual(restored.reminder_pause_test.times, ['09:00', '22:00']);
});

test('vehicle maintenance freezes time and distance, while official document expiry is preserved', () => {
    const base = { id: 'vc_pause_test', name: 'Control', type: 'maintenance', intervalDays: 30, intervalKm: 1000 };
    const records = [{ id: 'qa', date: '2026-10-01', km: 10000 }];
    const paused = setEntityPaused(base, true, date(10), { currentKm: 10200 });
    const during = getVehicleCardState(paused, records, { now: date(20), currentKm: 11000 });
    assert.equal(during.remainingDays, 21); assert.equal(during.remainingKm, 800); assert.equal(during.shouldNotify, false);
    const resumed = setEntityPaused(paused, false, date(20), { currentKm: 11000 });
    const after = getVehicleCardState(resumed, records, { now: date(21), currentKm: 11100 });
    assert.equal(after.remainingDays, 20); assert.equal(after.remainingKm, 700);
    const catalog = normalizeVehicleCatalog({ cards: [resumed], records: { [base.id]: records } });
    assert.equal(catalog.cards[0].pausePeriods.length, 1);
    assert.equal(buildVehicleCatalogNotification(`vehicle_card:${base.id}`, { vehicleCatalog: { ...catalog, cards: [paused] } }, 20000, () => 100, () => -10).shouldNotify, false);
    const document = setEntityPaused({ ...base, type: 'document' }, true, date(10));
    const unpaused = setEntityPaused(document, false, date(20));
    assert.equal(getVehicleCardState(unpaused, [{ id: 'doc', date: '2026-10-15' }], { now: date(21) }).remainingDays, -6);
});
