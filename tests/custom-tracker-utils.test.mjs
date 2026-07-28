import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCustomAlertDefinitions,
    createCustomTracker,
    CUSTOM_TRACKER_FIELD,
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
        version: 1,
        trackers: [tracker],
        histories: {
            [tracker.id]: [
                '2026-07-01T12:00:00.000Z',
                '2026-07-25T12:00:00.000Z'
            ]
        }
    });

    assert.equal(CUSTOM_TRACKER_FIELD, '__custom_trackers_v1');
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
            version: 1,
            trackers: [{ ...createTracker(), intervalDays: 0 }],
            histories: {}
        }),
        /intervalDays/
    );
    assert.throws(
        () => validateCustomTrackerRegistry({
            version: 1,
            trackers: [{ ...createTracker(), section: 'unknown' }],
            histories: {}
        }),
        /sección/
    );
    assert.throws(
        () => validateCustomTrackerRegistry({
            version: 1,
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
        version: 1,
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
        name: 'Control clínico'
    });
    const definitions = buildCustomAlertDefinitions({
        version: 1,
        trackers: [tracker],
        histories: { [tracker.id]: [] }
    });

    assert.equal(getCustomAlertKey(tracker.id), 'custom_tracker:ct_salud_001');
    assert.deepEqual(definitions[0], {
        key: 'custom_tracker:ct_salud_001',
        name: 'Control clínico',
        category: 'salud',
        type: 'interval',
        defaultTime: '20:30',
        defaultDays: []
    });
});

test('defensive normalization ignores broken optional entries', () => {
    const normalized = normalizeCustomTrackerRegistry({
        version: 1,
        trackers: [
            createTracker(),
            { id: 'broken' }
        ],
        histories: {}
    });
    assert.equal(normalized.trackers.length, 1);
});
