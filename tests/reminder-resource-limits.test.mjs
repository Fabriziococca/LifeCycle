import test from 'node:test';
import assert from 'node:assert/strict';

import { AlertsModule } from '../modules/AlertsModule.js';
import { RECURRING_REMINDERS_FIELD } from '../recurring-reminder-utils.mjs';
import {
    evaluateResourceCapacity,
    normalizeResourcePolicy
} from '../resource-policy.mjs';

function createReminder(index) {
    return {
        id: `reminder_test_${index}`,
        name: `Recordatorio ${index}`,
        category: 'otros',
        title: `Aviso ${index}`,
        body: 'Mensaje de prueba.',
        defaultTime: '09:00',
        defaultDays: [1]
    };
}

function createHarness(policy, reminderCount) {
    const module = Object.create(AlertsModule.prototype);
    module.configs = {
        [RECURRING_REMINDERS_FIELD]: {
            version: 2,
            reminders: Array.from(
                { length: reminderCount },
                (_, index) => createReminder(index)
            )
        }
    };
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

test('friend policy blocks one or several reminders at the exact boundary', () => {
    const policy = normalizeResourcePolicy({
        tier: 'friend',
        unlimited: false,
        limits: { reminders: 2 }
    });
    const atLimit = createHarness(policy, 2);
    const oneRemaining = createHarness(policy, 1);
    const errorElement = {
        textContent: '',
        classList: { remove() {} }
    };

    assert.equal(atLimit.ensureRecurringReminderCreationCapacity(), false);
    assert.equal(oneRemaining.ensureRecurringReminderCreationCapacity({
        requestedCount: 2,
        errorElement
    }), false);
    assert.match(atLimit.messages[0].message, /hasta 2 recordatorios/i);
    assert.match(errorElement.textContent, /hasta 2 recordatorios/i);
});

test('owner policy keeps reminder creation unlimited', () => {
    const harness = createHarness(
        normalizeResourcePolicy({ tier: 'owner', unlimited: true }),
        1_000
    );

    assert.equal(harness.ensureRecurringReminderCreationCapacity({
        requestedCount: 4
    }), true);
    assert.deepEqual(harness.messages, []);
});
