import test from 'node:test';
import assert from 'node:assert/strict';

import {
    appendCustomTrackerRecords,
    buildCustomAlertDefinitions,
    createCustomTracker,
    createEmptyCustomTrackerRegistry,
    CUSTOM_TRACKER_FIELD,
    CUSTOM_TRACKER_SCHEMA_VERSION,
    DEFAULT_NAVIGATION_FAVORITES,
    getAppModules,
    getCustomAlertKey,
    getCustomTrackerSections,
    getCustomTrackerState,
    isMedicalStudyTracker,
    isSupportedCustomTrackerSchemaVersion,
    isUnifiedCustomTrackerRegistry,
    isStateReminderTracker,
    normalizeCustomTrackerDayThresholds,
    normalizeNavigationPreferences,
    normalizeCustomTrackerRegistry,
    validateCustomTrackerRegistry
} from '../custom-tracker-utils.mjs';

test('unified tracker detection keeps schema upgrades from re-enabling legacy cards', () => {
    const v2 = {
        ...createEmptyCustomTrackerRegistry(),
        version: 2
    };
    const current = createEmptyCustomTrackerRegistry();

    assert.equal(isUnifiedCustomTrackerRegistry(v2), true);
    assert.equal(isUnifiedCustomTrackerRegistry(current), true);
    assert.equal(isUnifiedCustomTrackerRegistry({ version: 3, trackers: [] }), false);
    assert.equal(isUnifiedCustomTrackerRegistry(null), false);
    assert.equal(isSupportedCustomTrackerSchemaVersion(1), false);
    assert.equal(isSupportedCustomTrackerSchemaVersion(2), true);
    assert.equal(isSupportedCustomTrackerSchemaVersion(CUSTOM_TRACKER_SCHEMA_VERSION), true);
    assert.equal(isSupportedCustomTrackerSchemaVersion(CUSTOM_TRACKER_SCHEMA_VERSION + 1), false);
});

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

test('custom modules become navigable tracker destinations without changing the card model', () => {
    const customModule = {
        id: 'cm_mascotas',
        name: 'Mascotas',
        description: 'Cuidados y controles de Robert.',
        icon: 'ph-paw-print',
        color: 'green',
        order: 0,
        archived: false,
        createdAt: '2026-08-17T12:00:00.000Z',
        updatedAt: '2026-08-17T12:00:00.000Z'
    };
    const tracker = createCustomTracker({
        section: customModule.id,
        subsection: 'general',
        name: 'Vacunación',
        actionLabel: 'Registrar vacuna',
        intervalDays: 365,
        icon: 'ph-first-aid',
        alert: { enabled: true, time: '20:30' }
    }, {
        id: 'ct_mascotas_vacuna',
        now: new Date('2026-08-17T12:00:00.000Z'),
        order: 0,
        customModules: [customModule]
    });
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        customModules: [customModule],
        trackers: [tracker],
        histories: { [tracker.id]: [] }
    });
    const sections = getCustomTrackerSections(registry.customModules);
    const modules = getAppModules(registry.customModules);

    assert.equal(registry.version, 3);
    assert.equal(sections.cm_mascotas.mainSectionId, 'cm_mascotas-section');
    assert.equal(sections.cm_mascotas.subsections.general.hostId, 'cm_mascotas-trackers');
    assert.equal(modules['cm_mascotas-section'].label, 'Mascotas');
    assert.equal(modules['cm_mascotas-section'].custom, true);
    assert.equal(registry.trackers[0].section, 'cm_mascotas');
    assert.equal(buildCustomAlertDefinitions(registry)[0].category, 'otros');
});

test('archiving a custom module preserves its cards but pauses their active alerts', () => {
    const customModule = {
        id: 'cm_hogar',
        name: 'Hogar',
        icon: 'ph-house',
        color: 'blue',
        order: 0,
        archived: true
    };
    const tracker = createCustomTracker({
        section: customModule.id,
        subsection: 'general',
        name: 'Cambiar filtro',
        actionLabel: 'Registrar cambio',
        intervalDays: 90,
        icon: 'ph-arrows-clockwise',
        alert: { enabled: true, time: '20:30' }
    }, {
        id: 'ct_hogar_filtro',
        customModules: [customModule]
    });
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        customModules: [customModule],
        trackers: [tracker],
        histories: { [tracker.id]: [] }
    });

    assert.equal(registry.trackers.length, 1);
    assert.equal(getAppModules(registry.customModules)['cm_hogar-section'], undefined);
    assert.deepEqual(buildCustomAlertDefinitions(registry), []);
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

test('reversed progressive thresholds are ordered instead of blocking card creation', () => {
    const normalized = normalizeCustomTrackerDayThresholds({
        yellow: 170,
        orange: 160,
        red: 180
    }, { strict: true });

    assert.deepEqual(normalized, {
        thresholds: { yellow: 160, orange: 170, red: 180 },
        reordered: true
    });

    const tracker = createTracker({
        cadence: { unit: 'days', value: 180 },
        intervalDays: 180,
        thresholds: { yellow: 170, orange: 160, red: 180 }
    });
    assert.deepEqual(tracker.thresholds, { yellow: 160, orange: 170, red: 180 });
});

test('progressive thresholds explain invalid user values without internal field names', () => {
    assert.throws(
        () => normalizeCustomTrackerDayThresholds({
            yellow: 190,
            orange: 170,
            red: 180
        }, { strict: true }),
        error => (
            error.name === 'CustomTrackerValidationError'
            && error.message === '"Próximo" debe ser un entero entre 1 y 180.'
            && !error.message.includes('thresholds.')
        )
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

test('state reminders remain inactive until started and expose repeat configuration', () => {
    const tracker = createTracker({
        id: 'ct_pending_001',
        template: 'state-reminder',
        behavior: {
            startActionLabel: 'Marcar como pendiente',
            intervalHours: 4
        },
        state: {
            active: true,
            activatedAt: '2026-07-28T08:00:00.000Z'
        }
    });
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        trackers: [tracker],
        histories: { [tracker.id]: [] },
        featuredBySection: { hygiene: tracker.id }
    });
    const state = getCustomTrackerState(
        registry.trackers[0],
        [],
        new Date('2026-07-28T13:30:00.000Z')
    );

    assert.equal(isStateReminderTracker(registry.trackers[0]), true);
    assert.equal(state.active, true);
    assert.equal(state.elapsedHours, 5);
    assert.equal(state.status, 'red');
    assert.equal(registry.featuredBySection.hygiene, tracker.id);
    assert.deepEqual(buildCustomAlertDefinitions(registry)[0], {
        key: 'custom_tracker:ct_pending_001',
        name: 'Lavar sillones',
        category: 'higiene',
        type: 'interval',
        defaultEnabled: true,
        defaultTime: '20:30',
        defaultDays: [],
        repeatWhileActive: true,
        intervalHours: 4
    });
});

test('medical study cards use the common cadence model and can be featured', () => {
    const tracker = createTracker({
        id: 'ct_study_001',
        section: 'health',
        subsection: 'controles',
        template: 'medical-study',
        name: 'Análisis anual',
        actionLabel: 'Agregar estudio',
        cadence: { unit: 'days', value: 360 },
        intervalDays: 360,
        thresholds: { yellow: 270, orange: 330, red: 360 },
        icon: 'ph-test-tube'
    });

    assert.equal(isMedicalStudyTracker(tracker), true);
    assert.equal(tracker.thresholds.red, 360);
    assert.equal(
        getCustomTrackerState(
            tracker,
            ['2025-08-03T12:00:00.000Z'],
            new Date('2026-08-11T12:00:00.000Z')
        ).status,
        'red'
    );
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

test('adaptive navigation keeps between one and four valid favorite modules', () => {
    assert.deepEqual(
        normalizeNavigationPreferences(undefined).favoriteModules,
        DEFAULT_NAVIGATION_FAVORITES
    );
    assert.deepEqual(
        normalizeNavigationPreferences({
            favoriteModules: [
                'projects-section',
                'projects-section',
                'tareas-section',
                'finanzas-section',
                'higiene-section',
                'unknown-section'
            ]
        }).favoriteModules,
        [
            'projects-section',
            'tareas-section',
            'finanzas-section',
            'higiene-section'
        ]
    );
    assert.deepEqual(
        normalizeNavigationPreferences({ favoriteModules: [] }).favoriteModules,
        DEFAULT_NAVIGATION_FAVORITES
    );
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
