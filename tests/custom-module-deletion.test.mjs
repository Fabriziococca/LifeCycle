import test from 'node:test';
import assert from 'node:assert/strict';

import { CustomTrackersModule } from '../modules/CustomTrackersModule.js';
import {
    createCustomTracker,
    createEmptyCustomTrackerRegistry,
    CUSTOM_MODULE_CARD_RESOLUTIONS,
    normalizeCustomTrackerRegistry,
    validateCustomTrackerRegistry
} from '../custom-tracker-utils.mjs';

function createModule(overrides = {}) {
    return {
        id: 'cm_origen',
        name: 'Origen',
        description: '',
        icon: 'ph-house',
        color: 'blue',
        order: 0,
        archived: true,
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-20T12:00:00.000Z',
        ...overrides
    };
}

function createTracker(customModules, overrides = {}) {
    return createCustomTracker({
        section: 'cm_origen',
        subsection: 'general',
        name: 'Tarjeta de origen',
        actionLabel: 'Registrar',
        intervalDays: 30,
        icon: 'ph-check-circle',
        alert: { enabled: true, time: '22:00' },
        ...overrides
    }, {
        id: overrides.id || 'ct_module_source',
        order: overrides.order || 0,
        customModules
    });
}

function createHarness(registry, app = {}) {
    const module = Object.create(CustomTrackersModule.prototype);
    module.registry = registry;
    module.app = app;
    module.pendingDeleteIds = new Set();
    module.historyDialogTrackerId = null;
    module.instructionsDialogTrackerId = null;
    module.clearPendingHistoryDeletes = () => {};
    module.persistCount = 0;
    module.persistRegistry = () => {
        module.persistCount += 1;
        module.registry = normalizeCustomTrackerRegistry(module.registry);
    };
    module.feedback = [];
    module.showCustomModulesFeedback = message => module.feedback.push(message);
    return module;
}

test('module deletion orchestration moves cards without invoking destructive cleanup', async () => {
    const sourceModule = createModule();
    const targetModule = createModule({
        id: 'cm_destino',
        name: 'Destino',
        archived: false,
        order: 1
    });
    const customModules = [sourceModule, targetModule];
    const tracker = createTracker(customModules);
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        customModules,
        trackers: [tracker],
        histories: { [tracker.id]: ['2026-08-21T12:00:00.000Z'] }
    });
    const harness = createHarness(registry);
    harness.clearLegacyTracker = () => assert.fail('moving must preserve legacy data');
    harness.removeAlertConfigsForTrackers = () => assert.fail('moving must preserve alerts');

    const result = await harness.executeCustomModuleDeletion(sourceModule.id, {
        cardResolution: CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE,
        targetSection: targetModule.id,
        targetSubsection: 'general'
    });

    assert.equal(harness.persistCount, 1);
    assert.equal(result.movedTrackers.length, 1);
    assert.equal(harness.registry.trackers[0].section, targetModule.id);
    assert.deepEqual(harness.registry.histories[tracker.id], ['2026-08-21T12:00:00.000Z']);
    assert.equal(registry.trackers[0].section, sourceModule.id);
    assert.match(harness.feedback[0], /fueron movidas|fue movida/);
});

test('module deletion orchestration cleans medical files before legacy data and persistence', async () => {
    const sourceModule = createModule();
    const medical = createTracker([sourceModule], {
        id: 'ct_module_study',
        template: 'medical-study',
        icon: 'ph-test-tube'
    });
    const legacy = createTracker([sourceModule], {
        id: 'ct_module_legacy',
        order: 1,
        legacySource: { kind: 'hygiene', key: 'legacy_card', mode: 'single' }
    });
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        customModules: [sourceModule],
        trackers: [medical, legacy],
        histories: { [medical.id]: [], [legacy.id]: [] }
    });
    const calls = [];
    const harness = createHarness(registry, {
        health: {
            async deleteStudyEntriesForTrackers(trackerIds) {
                calls.push(['medical', trackerIds]);
                return { deletedEntries: 2, deletedFiles: 1 };
            }
        }
    });
    harness.clearLegacyTracker = tracker => calls.push(['legacy', tracker.id]);
    harness.removeAlertConfigsForTrackers = trackers => {
        calls.push(['alerts', trackers.map(tracker => tracker.id)]);
    };
    const basePersist = harness.persistRegistry;
    harness.persistRegistry = () => {
        calls.push(['persist']);
        basePersist();
    };

    const result = await harness.executeCustomModuleDeletion(sourceModule.id, {
        cardResolution: CUSTOM_MODULE_CARD_RESOLUTIONS.DELETE
    });

    assert.deepEqual(calls[0], ['medical', [medical.id]]);
    assert.deepEqual(calls.at(-1), ['persist']);
    assert.equal(calls.findIndex(call => call[0] === 'legacy') > 0, true);
    assert.equal(calls.findIndex(call => call[0] === 'alerts') > 0, true);
    assert.deepEqual(result.studyCleanup, { deletedEntries: 2, deletedFiles: 1 });
    assert.equal(harness.registry.customModules.length, 0);
    assert.equal(harness.registry.trackers.length, 0);
    assert.deepEqual(harness.registry.deletedTrackerIds, [medical.id, legacy.id]);
});

test('failed medical storage cleanup keeps the registry and other data untouched', async () => {
    const sourceModule = createModule();
    const medical = createTracker([sourceModule], {
        id: 'ct_module_study_failure',
        template: 'medical-study',
        icon: 'ph-test-tube'
    });
    const registry = validateCustomTrackerRegistry({
        ...createEmptyCustomTrackerRegistry(),
        customModules: [sourceModule],
        trackers: [medical],
        histories: { [medical.id]: ['2026-08-21T12:00:00.000Z'] }
    });
    const harness = createHarness(registry, {
        health: {
            async deleteStudyEntriesForTrackers() {
                throw new Error('storage unavailable');
            }
        }
    });
    harness.clearLegacyTracker = () => assert.fail('legacy cleanup must not run');
    harness.removeAlertConfigsForTrackers = () => assert.fail('alert cleanup must not run');

    await assert.rejects(
        () => harness.executeCustomModuleDeletion(sourceModule.id, {
            cardResolution: CUSTOM_MODULE_CARD_RESOLUTIONS.DELETE
        }),
        /storage unavailable/
    );

    assert.equal(harness.persistCount, 0);
    assert.equal(harness.registry, registry);
    assert.equal(harness.registry.trackers.length, 1);
    assert.equal(harness.registry.customModules.length, 1);
});
