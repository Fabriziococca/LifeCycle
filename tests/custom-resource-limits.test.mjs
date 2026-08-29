import test from 'node:test';
import assert from 'node:assert/strict';

import { CustomTrackersModule } from '../modules/CustomTrackersModule.js';
import {
    createEmptyCustomTrackerRegistry,
    validateCustomTrackerRegistry
} from '../custom-tracker-utils.mjs';
import {
    RESOURCE_KEYS,
    evaluateResourceCapacity,
    normalizeResourcePolicy
} from '../resource-policy.mjs';

function createHarness(policy, registry) {
    const module = Object.create(CustomTrackersModule.prototype);
    module.registry = registry;
    module.messages = [];
    module.app = {
        auth: {
            canCreateResource(resourceKey, currentCount, requestedCount) {
                return evaluateResourceCapacity(
                    policy,
                    resourceKey,
                    currentCount,
                    requestedCount
                );
            }
        },
        async showMessage(message) {
            module.messages.push(message);
        }
    };
    return module;
}

test('friend policy blocks module and card creation at the exact boundary', () => {
    const policy = normalizeResourcePolicy({
        tier: 'friend',
        unlimited: false,
        limits: { custom_modules: 2, tracker_cards: 2 }
    });
    const harness = createHarness(policy, {
        customModules: [{ id: 'cm_one' }, { id: 'cm_two', archived: true }],
        trackers: [{ id: 'ct_one' }, { id: 'ct_two', archived: true }]
    });
    const errorElement = {
        textContent: '',
        classList: { remove() {} }
    };

    assert.equal(
        harness.ensureCreationCapacity(RESOURCE_KEYS.CUSTOM_MODULES),
        false
    );
    assert.equal(
        harness.ensureCreationCapacity(RESOURCE_KEYS.TRACKER_CARDS, { errorElement }),
        false
    );
    assert.match(harness.messages[0].message, /hasta 2 módulos personalizados/i);
    assert.match(errorElement.textContent, /hasta 2 tarjetas configurables/i);
});

test('owner policy keeps creation unlimited regardless of current registry size', () => {
    const harness = createHarness(
        normalizeResourcePolicy({ tier: 'owner', unlimited: true }),
        {
            customModules: Array.from({ length: 1_000 }, (_, index) => ({
                id: `cm_${index}`
            })),
            trackers: Array.from({ length: 10_000 }, (_, index) => ({
                id: `ct_${index}`
            }))
        }
    );

    assert.equal(
        harness.ensureCreationCapacity(RESOURCE_KEYS.CUSTOM_MODULES),
        true
    );
    assert.equal(
        harness.ensureCreationCapacity(RESOURCE_KEYS.TRACKER_CARDS),
        true
    );
    assert.deepEqual(harness.messages, []);
});

test('registry normalization no longer truncates the former friend quota', () => {
    const registry = createEmptyCustomTrackerRegistry();
    registry.customModules = Array.from({ length: 31 }, (_, index) => ({
        id: `cm_module_${index}`,
        name: `Módulo ${index + 1}`,
        description: '',
        icon: 'ph-house',
        color: 'blue',
        order: index,
        archived: false,
        createdAt: '2026-08-29T12:00:00.000Z',
        updatedAt: '2026-08-29T12:00:00.000Z'
    }));

    assert.equal(validateCustomTrackerRegistry(registry).customModules.length, 31);
});
