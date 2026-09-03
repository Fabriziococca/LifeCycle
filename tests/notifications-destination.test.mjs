import test from 'node:test';
import assert from 'node:assert/strict';

import { NotificationsCenterModule } from '../modules/NotificationsCenterModule.js';

function createMockInstance(app) {
    return {
        app,
        panel: { classList: { add: () => {} } }
    };
}

// Ensure minimal browser globals exist for openItem
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((cb) => cb());
globalThis.window = globalThis.window || { scrollTo: () => {} };
globalThis.document = globalThis.document || {
    getElementById: () => null,
    querySelector: () => null
};

test('openItem for Vitamina D activates gym-section, switches to nutrition tab and targets vitd-timer-box', () => {
    let activatedSection = null;
    let activatedGymTab = null;

    const fakeApp = {
        activateSection: (sectionId) => {
            activatedSection = sectionId;
            return true;
        },
        gym: {
            activateGymTab: (tabId) => {
                activatedGymTab = tabId;
                return true;
            }
        }
    };

    const instance = createMockInstance(fakeApp);
    const item = {
        module: 'gym',
        id: 'vit_d',
        gymTab: 'nutrition',
        targetElementId: 'vitd-timer-box'
    };

    const result = NotificationsCenterModule.prototype.openItem.call(instance, item);

    assert.equal(result, true);
    assert.equal(activatedSection, 'gym-section');
    assert.equal(activatedGymTab, 'nutrition');
});

test('openItem for vehicle card activates vehiculo-section and switches to docs or maint tab', () => {
    let activatedSection = null;
    let activatedVehicleTab = null;

    const fakeApp = {
        activateSection: (sectionId) => {
            activatedSection = sectionId;
            return true;
        },
        vehicle: {
            activateVehicleTab: (tabId) => {
                activatedVehicleTab = tabId;
                return true;
            }
        }
    };

    const instance = createMockInstance(fakeApp);
    const item = {
        module: 'vehicle',
        id: 'v_seguro',
        vehicleTab: 'docs'
    };

    const result = NotificationsCenterModule.prototype.openItem.call(instance, item);

    assert.equal(result, true);
    assert.equal(activatedSection, 'vehiculo-section');
    assert.equal(activatedVehicleTab, 'docs');
});

test('openItem for task activates tareas-section and sets the correct category', () => {
    let activatedSection = null;

    const fakeApp = {
        activateSection: (sectionId) => {
            activatedSection = sectionId;
            return true;
        },
        tareas: {
            currentCategory: 'Personal',
            tasks: [{ id: 'task_123', category: 'Freelance' }]
        }
    };

    const instance = createMockInstance(fakeApp);
    const item = {
        module: 'tareas',
        id: 'task_123'
    };

    const result = NotificationsCenterModule.prototype.openItem.call(instance, item);

    assert.equal(result, true);
    assert.equal(activatedSection, 'tareas-section');
    assert.equal(fakeApp.tareas.currentCategory, 'Freelance');
});

test('openItem for custom tracker resolves the target section even if in gym, vehicle or health', () => {
    let activatedSection = null;

    const fakeApp = {
        activateSection: (sectionId) => {
            activatedSection = sectionId;
            return true;
        },
        customTrackers: {
            getTracker: (id) => {
                if (id === 'trk_salud_1') return { id: 'trk_salud_1', section: 'health' };
                if (id === 'trk_gym_1') return { id: 'trk_gym_1', section: 'gym' };
                if (id === 'trk_custom_mod') return { id: 'trk_custom_mod', section: 'cmod_finanzas_pro' };
                return null;
            }
        }
    };

    const instance = createMockInstance(fakeApp);

    assert.equal(NotificationsCenterModule.prototype.openItem.call(instance, { module: 'custom_tracker', id: 'trk_salud_1' }), true);
    assert.equal(activatedSection, 'salud-section');

    assert.equal(NotificationsCenterModule.prototype.openItem.call(instance, { module: 'custom_tracker', id: 'trk_gym_1' }), true);
    assert.equal(activatedSection, 'gym-section');

    assert.equal(NotificationsCenterModule.prototype.openItem.call(instance, { module: 'custom_tracker', id: 'trk_custom_mod' }), true);
    assert.equal(activatedSection, 'cmod_finanzas_pro');
});
