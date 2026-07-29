import test from 'node:test';
import assert from 'node:assert/strict';

import {
    appendCustomTrackerRecords,
    buildCustomAlertDefinitions,
    createCustomTracker,
    createEmptyCustomTrackerRegistry,
    CUSTOM_TRACKER_FIELD,
    CUSTOM_TRACKER_SCHEMA_VERSION,
    getCustomAlertKey,
    getCustomTrackerState,
    normalizeCustomTrackerRegistry,
    validateCustomTrackerRegistry
} from '../custom-tracker-utils.mjs';

function createTracker(overrides = {}) {
    return createCustomTracker({
        section: 'hygiene',
        name: 'Lavar sillones',
        actionLabel: 'Registrar limpieza',
        intervalDays: 30,
        icon: 'ph-sparkle',
        instructions: 'Aspirar y limpiar con producto apto.',
        alert: { enabled: true, time: '20:30' },
        ...overrides
    }, {
        id: overrides.id || 'ct_sillones_1',
        now: new Date('2026-07-28T12:00:00.000Z'),
        order: overrides.order ?? 0
    });
}

test('custom tracker registry normalizes trackers and their histories', () => {
    const tracker = createTracker();
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [tracker],
        histories: {
            [tracker.id]: [
                '2026-07-01T12:00:00.000Z',
                '2026-07-25T12:00:00.000Z'
            ]
        }
    });

    assert.equal(CUSTOM_TRACKER_FIELD, '__trackers_v2');
    assert.equal(registry.version, CUSTOM_TRACKER_SCHEMA_VERSION);
    assert.equal(registry.trackers[0].name, 'Lavar sillones');
    assert.equal(registry.trackers[0].subsection, 'tecnologia');
    assert.equal(
        registry.histories[tracker.id][0],
        '2026-07-25T12:00:00.000Z'
    );
});

test('strict custom tracker validation rejects unsafe or malformed data', () => {
    assert.throws(
        () => validateCustomTrackerRegistry({
            ...createEmptyCustomTrackerRegistry(),
            trackers: [{
                ...createTracker(),
                cadence: { unit: 'days', value: 0 }
            }],
            histories: {}
        }),
        /intervalDays/
    );
    assert.throws(
        () => validateCustomTrackerRegistry({
            ...createEmptyCustomTrackerRegistry(),
            trackers: [{ ...createTracker(), section: 'unknown' }],
            histories: {}
        }),
        /sección/
    );
    assert.throws(
        () => validateCustomTrackerRegistry({
            ...createEmptyCustomTrackerRegistry(),
            trackers: [{
                ...createTracker(),
                subsection: 'ubicacion_inexistente'
            }],
            histories: {}
        }),
        /ubicación/
    );
});

test('legacy cards gain a safe default location and new cards keep their destination', () => {
    const legacyTracker = { ...createTracker() };
    delete legacyTracker.subsection;
    const migrated = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [legacyTracker],
        histories: { [legacyTracker.id]: [] }
    });
    assert.equal(migrated.trackers[0].subsection, 'tecnologia');

    const groomingTracker = createTracker({
        id: 'ct_herramienta_01',
        section: 'grooming',
        subsection: 'herramientas'
    });
    assert.equal(groomingTracker.subsection, 'herramientas');
});

test('custom tracker status progresses from new to overdue', () => {
    const tracker = createTracker({ intervalDays: 10 });

    assert.equal(
        getCustomTrackerState(tracker, [], new Date('2026-07-28T12:00:00Z')).status,
        'new'
    );
    assert.equal(
        getCustomTrackerState(
            tracker,
            ['2026-07-20T12:00:00.000Z'],
            new Date('2026-07-28T12:00:00Z')
        ).status,
        'orange'
    );
    assert.equal(
        getCustomTrackerState(
            tracker,
            ['2026-07-18T12:00:00.000Z'],
            new Date('2026-07-28T12:00:00Z')
        ).status,
        'red'
    );
});

test('custom tracker alerts use stable unique keys and section categories', () => {
    const tracker = createTracker({
        id: 'ct_salud_001',
        section: 'health',
        name: 'Control clínico',
        template: 'medical',
        cadence: { unit: 'months', value: 6 },
        thresholds: { warningDays: 30 }
    });
    const definitions = buildCustomAlertDefinitions({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [tracker],
        histories: { [tracker.id]: [] }
    });

    assert.equal(getCustomAlertKey(tracker.id), 'custom_tracker:ct_salud_001');
    assert.deepEqual(definitions[0], {
        key: 'custom_tracker:ct_salud_001',
        name: 'Control clínico',
        category: 'salud',
        type: 'interval',
        defaultEnabled: true,
        defaultTime: '20:30',
        defaultDays: []
    });
});

test('defensive normalization ignores broken optional entries', () => {
    const normalized = normalizeCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [
            createTracker(),
            { id: 'broken' }
        ],
        histories: {}
    });
    assert.equal(normalized.trackers.length, 1);
});

test('archived and deleted cards keep their identity but expose no active alert', () => {
    const archived = {
        ...createTracker({ id: 'ct_archived_001' }),
        archived: true
    };
    const deleted = {
        ...createTracker({ id: 'ct_deleted_001' }),
        archived: true,
        deleted: true,
        deletedAt: '2026-07-28T13:00:00.000Z'
    };
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [archived, deleted],
        histories: {
            [archived.id]: [],
            [deleted.id]: []
        }
    });

    assert.equal(registry.trackers[1].deleted, true);
    assert.equal(registry.trackers[1].deletedAt, '2026-07-28T13:00:00.000Z');
    assert.deepEqual(buildCustomAlertDefinitions(registry), []);
});

test('module visibility defaults to visible and preserves explicit hidden modules', () => {
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        modulePreferences: {
            'higiene-section': { visible: false }
        }
    });

    assert.equal(registry.modulePreferences['higiene-section'].visible, false);
    assert.equal(registry.modulePreferences['projects-section'].visible, true);
});

test('tracker registry keeps synchronized Today quick-action preferences', () => {
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        todayPreferences: {
            quickActions: ['add_expense', 'new_tracker']
        }
    });

    assert.deepEqual(registry.todayPreferences.quickActions, [
        'add_expense',
        'new_tracker'
    ]);
});

test('multiple tracker records are applied atomically to active unique cards', () => {
    const active = createTracker({ id: 'ct_active_001' });
    const second = createTracker({
        id: 'ct_active_002',
        name: 'Lavar almohadas',
        order: 1
    });
    const archived = {
        ...createTracker({
            id: 'ct_archived_002',
            name: 'Tarjeta archivada',
            order: 2
        }),
        archived: true
    };
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [active, second, archived],
        histories: {
            [active.id]: ['2026-07-20T12:00:00.000Z'],
            [second.id]: [],
            [archived.id]: []
        },
        todayPreferences: {
            quickActions: ['add_expense', 'new_tracker']
        }
    });

    const result = appendCustomTrackerRecords(
        registry,
        [active.id, active.id, second.id, archived.id, 'ct_missing_001'],
        new Date('2026-07-29T15:00:00.000Z')
    );

    assert.deepEqual(result.recordedIds, [active.id, second.id]);
    assert.deepEqual(result.registry.histories[active.id], [
        '2026-07-29T15:00:00.000Z',
        '2026-07-20T12:00:00.000Z'
    ]);
    assert.deepEqual(result.registry.histories[second.id], [
        '2026-07-29T15:00:00.000Z'
    ]);
    assert.deepEqual(result.registry.histories[archived.id], []);
    assert.deepEqual(result.registry.todayPreferences.quickActions, [
        'add_expense',
        'new_tracker'
    ]);
});

test('multiple tracker records reject invalid dates without mutating the source', () => {
    const tracker = createTracker({ id: 'ct_immutable_001' });
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [tracker],
        histories: { [tracker.id]: [] }
    });

    assert.throws(
        () => appendCustomTrackerRecords(registry, [tracker.id], 'fecha-invalida'),
        /fecha del registro/
    );
    assert.deepEqual(registry.histories[tracker.id], []);
});
