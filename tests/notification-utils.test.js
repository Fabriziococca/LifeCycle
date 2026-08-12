'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    assertServerManagedUserDataPatch,
    buildCustomTrackerNotification,
    buildVehicleCatalogNotification,
    buildVehicleDocumentNotification,
    buildVehicleMaintenanceNotification,
    ensureCustomTrackerAlertConfigs,
    ensureVehicleCatalogAlertConfigs,
    formatExpiryStatus,
    getDuplicateSubscriptionRowIds,
    getLatestValidDate,
    getPendingVeryUrgentTasks,
    getStateReminderEntries,
    groupSubscriptionsByUser,
    isExpiredPushError,
    isIntervalReminderDue,
    normalizeIntervalHours,
    parseJsonValue
} = require('../notification-utils');

test('parseJsonValue accepts native values and JSON strings', () => {
    assert.deepEqual(parseJsonValue('[1,2]', []), [1, 2]);
    assert.deepEqual(parseJsonValue({ enabled: true }, {}), { enabled: true });
    assert.deepEqual(parseJsonValue('not-json', []), []);
});

test('getPendingVeryUrgentTasks reads the real cloud keys', () => {
    const snapshot = {
        tareas_list: JSON.stringify([
            { id: 'general-1', urgency: 'muy_urgente', completed: false },
            { id: 'general-2', urgency: 'urgente', completed: false },
            { id: 'general-3', urgency: 'muy_urgente', completed: true }
        ]),
        projectPulseData: [
            {
                id: 'project-1',
                tasks: [
                    { id: 'project-task-1', urgency: 'muy_urgente', completed: false }
                ]
            }
        ]
    };

    assert.deepEqual(
        getPendingVeryUrgentTasks(snapshot).map(task => task.id),
        ['general-1', 'project-task-1']
    );
});

test('getPendingVeryUrgentTasks ignores obsolete key names', () => {
    const snapshot = {
        tareas_tasks: [{ id: 'legacy-general', urgency: 'muy_urgente', completed: false }],
        project_pulse_data: [{
            tasks: [{ id: 'legacy-project', urgency: 'muy_urgente', completed: false }]
        }]
    };

    assert.deepEqual(getPendingVeryUrgentTasks(snapshot), []);
});

test('groupSubscriptionsByUser keeps the newest row for each endpoint', () => {
    const groups = groupSubscriptionsByUser([
        {
            id: 'old-phone',
            user_id: 'user-1',
            created_at: '2026-07-20T10:00:00Z',
            subscription: { endpoint: 'https://push.example/phone', keys: { auth: 'old' } }
        },
        {
            id: 'desktop',
            user_id: 'user-1',
            created_at: '2026-07-20T11:00:00Z',
            subscription: { endpoint: 'https://push.example/desktop' }
        },
        {
            id: 'new-phone',
            user_id: 'user-1',
            created_at: '2026-07-21T10:00:00Z',
            device_name: 'Celular principal',
            subscription: { endpoint: 'https://push.example/phone', keys: { auth: 'new' } }
        }
    ]);

    assert.equal(groups['user-1'].length, 2);

    const phone = groups['user-1'].find(item => item.endpoint.endsWith('/phone'));
    assert.equal(phone.activeRowId, 'new-phone');
    assert.equal(phone.subscription.keys.auth, 'new');
    assert.equal(phone.deviceName, 'Celular principal');
    assert.deepEqual(phone.duplicateRowIds, ['old-phone']);
    assert.deepEqual(getDuplicateSubscriptionRowIds(groups), ['old-phone']);
});

test('groupSubscriptionsByUser ignores malformed rows', () => {
    const groups = groupSubscriptionsByUser([
        { id: 'missing-subscription', user_id: 'user-1' },
        { id: 'missing-user', subscription: { endpoint: 'https://push.example/x' } }
    ]);

    assert.deepEqual(groups, {});
});

test('normalizeIntervalHours enforces the supported range', () => {
    assert.equal(normalizeIntervalHours('4', 6), 4);
    assert.equal(normalizeIntervalHours('0', 6), 1);
    assert.equal(normalizeIntervalHours('80', 6), 48);
    assert.equal(normalizeIntervalHours('invalid', 6), 6);
    assert.equal(normalizeIntervalHours('invalid', 'invalid'), 4);
});

test('interval reminders run every configured period without quiet hours', () => {
    const nowAtNight = new Date('2026-07-28T07:00:00.000Z'); // 04:00 in Argentina

    assert.equal(isIntervalReminderDue({
        now: nowAtNight,
        lastNotifiedAt: '2026-07-28T03:00:00.000Z',
        intervalHours: 4
    }), true);
    assert.equal(isIntervalReminderDue({
        now: nowAtNight,
        lastNotifiedAt: '2026-07-28T03:00:01.000Z',
        intervalHours: 4
    }), false);
    assert.equal(isIntervalReminderDue({
        now: nowAtNight,
        lastNotifiedAt: null,
        intervalHours: 4
    }), true);
});

test('interval reminders recover from future state and support forced checks', () => {
    const now = new Date('2026-07-28T12:00:00.000Z');

    assert.equal(isIntervalReminderDue({
        now,
        lastNotifiedAt: '2026-07-29T12:00:00.000Z',
        intervalHours: 4
    }), true);
    assert.equal(isIntervalReminderDue({
        now,
        lastNotifiedAt: '2026-07-28T11:59:59.000Z',
        intervalHours: 48,
        force: true
    }), true);
    assert.equal(isIntervalReminderDue({
        now: 'invalid',
        lastNotifiedAt: null,
        intervalHours: 4
    }), false);
});

test('getLatestValidDate keeps a new robot cycle from using an older server timestamp', () => {
    const latest = getLatestValidDate([
        '2026-07-20T10:00:00.000Z',
        '2026-07-27T05:00:00.000Z',
        null,
        'invalid'
    ]);

    assert.equal(latest.toISOString(), '2026-07-27T05:00:00.000Z');
    assert.equal(getLatestValidDate([null, undefined, 'invalid']), null);
});

test('isExpiredPushError recognizes gone push endpoints', () => {
    assert.equal(isExpiredPushError({ statusCode: 404 }), true);
    assert.equal(isExpiredPushError({ statusCode: 410 }), true);
    assert.equal(isExpiredPushError({ statusCode: 500 }), false);
});

test('assertServerManagedUserDataPatch protects user-owned module keys', () => {
    assert.doesNotThrow(() => assertServerManagedUserDataPatch({
        alerts_sent_log: { hygiene: '2026-07-27' },
        robot_last_notified_at: '2026-07-27T05:00:00.000Z',
        very_urgent_last_notified_at: '2026-07-27T05:00:00.000Z'
    }));

    assert.throws(
        () => assertServerManagedUserDataPatch({ tareas_list: '[]' }),
        /clave no permitida/
    );
    assert.throws(
        () => assertServerManagedUserDataPatch(null),
        /no es válida/
    );
});

test('formatExpiryStatus distinguishes future, today and expired dates', () => {
    assert.equal(formatExpiryStatus('El seguro', 2), 'El seguro vence en 2 días');
    assert.equal(formatExpiryStatus('El seguro', 1), 'El seguro vence mañana');
    assert.equal(formatExpiryStatus('El seguro', 0), 'El seguro vence hoy');
    assert.equal(formatExpiryStatus('El seguro', -3), 'El seguro venció hace 3 días');
});

test('vehicle document reminders aggregate every due or expired document', () => {
    const remainingDays = {
        '2026-08-10': 14,
        '2026-07-27': 0,
        '2026-07-20': -7,
        '2026-12-01': 127
    };
    const reminder = buildVehicleDocumentNotification({
        dniExpDate: '2026-08-10',
        licenseExpDate: '2026-07-27',
        insuranceExpDate: '2026-07-20',
        vtvExpDate: '2026-12-01'
    }, value => remainingDays[value]);

    assert.equal(reminder.title, '📄 Documentación del vehículo');
    assert.match(reminder.body, /DNI vence en 14 días/);
    assert.match(reminder.body, /registro vence hoy/);
    assert.match(reminder.body, /seguro venció hace 7 días/);
    assert.doesNotMatch(reminder.body, /VTV/);
});

test('vehicle maintenance reminders do not overwrite one another', () => {
    const elapsedDays = {
        '2026-01-01': 207,
        '2026-05-01': 87,
        '2026-07-01': 26
    };
    const remainingDays = {
        '2026-07-10': -17
    };
    const reminder = buildVehicleMaintenanceNotification({
        refrigeranteDate: '2026-01-01',
        sapitoDate: '2026-05-01',
        escobillasDate: '2026-07-01',
        extintorDate: '2026-07-10'
    }, {
        vehicle: {
            fluids: {
                refrigerante: { days: 90 },
                sapito: { days: 45 },
                escobillas: { days_orange: 240 },
                extintor: { days_until_expiry: 30 }
            }
        }
    }, value => elapsedDays[value], value => remainingDays[value]);

    assert.equal(reminder.title, '🚗 Mantenimiento del vehículo');
    assert.match(reminder.body, /Refrigerante: 207 días/);
    assert.match(reminder.body, /Líquido limpiavidrios: 87 días/);
    assert.match(reminder.body, /matafuegos venció hace 17 días/);
    assert.doesNotMatch(reminder.body, /Escobillas/);
});

test('vehicle catalog creates individual alert configs while preserving legacy choices', () => {
    const alertsConfig = {
        vehicle_fluids_check: {
            enabled: false,
            time: '08:30',
            days: []
        }
    };
    const trackerData = {
        vehicleCatalog: {
            cards: [{
                id: 'vc_coolant',
                name: 'Refrigerante',
                type: 'check',
                section: 'maintenance',
                intervalDays: 90,
                alertKey: 'vehicle_card:vc_coolant',
                legacyAlertGroup: 'vehicle_fluids_check',
                alert: { enabled: true, time: '09:00' }
            }],
            records: { vc_coolant: [] }
        }
    };

    assert.equal(ensureVehicleCatalogAlertConfigs(alertsConfig, trackerData), true);
    assert.deepEqual(alertsConfig['vehicle_card:vc_coolant'], {
        enabled: false,
        time: '08:30',
        days: []
    });
});

test('vehicle catalog notifications respect card type, archive and deprecated groups', () => {
    const trackerData = {
        vehicleCatalog: {
            cards: [
                {
                    id: 'vc_belt',
                    name: 'Correa auxiliar',
                    type: 'maintenance',
                    intervalKm: 30000,
                    alertKey: 'vehicle_card:vc_belt',
                    alert: { enabled: true, time: '23:00' }
                },
                {
                    id: 'vc_vtv',
                    name: 'VTV',
                    type: 'document',
                    warningDays: 30,
                    alertKey: 'vehicle_card:vc_vtv',
                    alert: { enabled: true, time: '09:00' }
                }
            ],
            records: {
                vc_belt: [{ id: 'r1', date: '2026-01-01', km: 10000 }],
                vc_vtv: [{ id: 'r2', date: '2026-08-20' }]
            }
        }
    };
    const elapsed = () => 212;
    const until = value => value === '2026-08-20' ? 19 : null;

    assert.equal(buildVehicleCatalogNotification(
        'vehicle_card:vc_belt',
        trackerData,
        40500,
        elapsed,
        until
    ).shouldNotify, true);
    assert.equal(buildVehicleCatalogNotification(
        'vehicle_card:vc_vtv',
        trackerData,
        40500,
        elapsed,
        until
    ).shouldNotify, true);
    assert.deepEqual(buildVehicleCatalogNotification(
        'vehicle_docs_check',
        trackerData,
        40500,
        elapsed,
        until
    ), { handled: true, shouldNotify: false });

    trackerData.vehicleCatalog.cards[0].archived = true;
    assert.equal(buildVehicleCatalogNotification(
        'vehicle_card:vc_belt',
        trackerData,
        40500,
        elapsed,
        until
    ).shouldNotify, false);
});

test('a removed legacy vehicle card cannot reactivate its old static alert', () => {
    const trackerData = {
        vehicleCatalog: {
            cards: [],
            records: {}
        }
    };

    assert.deepEqual(buildVehicleCatalogNotification(
        'vehicle_oil',
        trackerData,
        50000,
        () => 500,
        () => 0
    ), { handled: true, shouldNotify: false });
});

test('custom tracker alert defaults are recovered from the synced registry', () => {
    const alertsConfig = {};
    const changed = ensureCustomTrackerAlertConfigs(alertsConfig, {
        __trackers_v2: {
            version: 2,
            trackers: [{
                id: 'ct_sillones_1',
                name: 'Lavar sillones',
                intervalDays: 30,
                archived: false,
                alert: { enabled: true, time: '20:30' }
            }],
            histories: { ct_sillones_1: [] }
        }
    });

    assert.equal(changed, true);
    assert.deepEqual(alertsConfig['custom_tracker:ct_sillones_1'], {
        enabled: true,
        time: '20:30',
        days: []
    });
});

test('custom tracker notifications are emitted only when active and overdue', () => {
    const hygieneData = {
        __trackers_v2: {
            version: 2,
            trackers: [{
                id: 'ct_sillones_1',
                name: 'Lavar   sillones',
                intervalDays: 30,
                archived: false
            }],
            histories: {
                ct_sillones_1: ['2026-06-01T12:00:00.000Z']
            }
        }
    };

    const reminder = buildCustomTrackerNotification(
        'custom_tracker:ct_sillones_1',
        hygieneData,
        () => 57
    );
    assert.deepEqual(reminder, {
        handled: true,
        shouldNotify: true,
        title: '📅 Lavar sillones',
        body: 'El seguimiento está vencido: pasaron 57 de 30 días.'
    });

    assert.deepEqual(
        buildCustomTrackerNotification(
            'custom_tracker:ct_sillones_1',
            hygieneData,
            () => 20
        ),
        {
            handled: true,
            shouldNotify: false
        }
    );

    hygieneData.__trackers_v2.trackers[0].archived = true;
    assert.deepEqual(
        buildCustomTrackerNotification(
            'custom_tracker:ct_sillones_1',
            hygieneData,
            () => 57
        ),
        {
            handled: true,
            shouldNotify: false
        }
    );

    hygieneData.__trackers_v2.trackers[0].archived = false;
    hygieneData.__trackers_v2.trackers[0].deleted = true;
    assert.deepEqual(
        buildCustomTrackerNotification(
            'custom_tracker:ct_sillones_1',
            hygieneData,
            () => 57
        ),
        {
            handled: true,
            shouldNotify: false
        }
    );
});

test('state reminder cards use interval alerts and never enter the daily tracker engine', () => {
    const hygieneData = {
        __trackers_v2: {
            version: 2,
            trackers: [{
                id: 'ct_robot_001',
                name: '  Limpiar   robot  ',
                template: 'state-reminder',
                archived: false,
                alert: { enabled: true, time: '22:00' },
                behavior: { intervalHours: 8 },
                state: {
                    active: true,
                    activatedAt: '2026-08-11T08:00:00.000Z'
                }
            }],
            histories: { ct_robot_001: [] }
        }
    };
    const alertsConfig = {};

    assert.equal(ensureCustomTrackerAlertConfigs(alertsConfig, hygieneData), true);
    assert.deepEqual(alertsConfig['custom_tracker:ct_robot_001'], {
        enabled: true,
        time: '22:00',
        days: [],
        interval_hours: 8
    });
    assert.deepEqual(getStateReminderEntries(hygieneData), [{
        trackerId: 'ct_robot_001',
        alertKey: 'custom_tracker:ct_robot_001',
        name: 'Limpiar robot',
        active: true,
        activatedAt: '2026-08-11T08:00:00.000Z',
        intervalHours: 8
    }]);
    assert.deepEqual(
        buildCustomTrackerNotification(
            'custom_tracker:ct_robot_001',
            hygieneData,
            () => 99
        ),
        { handled: true, shouldNotify: false }
    );
});
