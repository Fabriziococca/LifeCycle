import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createCustomTracker,
    createEmptyCustomTrackerRegistry
} from '../custom-tracker-utils.mjs';
import { NotificationsCenterModule } from '../modules/NotificationsCenterModule.js';

test('the critical bell counts a unified card once even when legacy source data still exists', () => {
    const tracker = createCustomTracker({
        section: 'hygiene',
        subsection: 'tecnologia',
        name: 'Computadora (Teclado y Ext.)',
        actionLabel: 'Registrar limpieza',
        intervalDays: 15,
        icon: 'ph-laptop',
        alert: { enabled: true, time: '23:00' }
    }, {
        id: 'trk_hygiene_computadora',
        now: new Date('2026-06-01T12:00:00.000Z')
    });
    const registry = createEmptyCustomTrackerRegistry();
    registry.trackers.push(tracker);
    registry.histories[tracker.id] = ['2026-06-01T12:00:00.000Z'];

    const app = {
        customTrackers: {
            registry,
            getHistory: trackerId => registry.histories[trackerId] || []
        },
        hygiene: {
            data: { computadora: ['2026-06-01T12:00:00.000Z'] },
            getDaysElapsed: () => 78
        }
    };

    const items = NotificationsCenterModule.prototype.getOverdueItems.call({ app });

    assert.equal(items.length, 1);
    assert.equal(items[0].module, 'custom_tracker');
    assert.equal(items[0].id, tracker.id);
});
