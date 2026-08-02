import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    buildRecurringReminderDefinitions,
    createRecurringReminderId,
    DEFAULT_RECURRING_REMINDERS,
    migrateRecurringReminderConfigs,
    RECURRING_REMINDERS_FIELD,
    removeRecurringReminder,
    upsertRecurringReminder
} from '../recurring-reminder-utils.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('legacy recurring reminders migrate into one configurable registry', () => {
    const configs = migrateRecurringReminderConfigs({
        trading: { enabled: true, time: '11:15', days: [1, 3, 5] }
    });
    const definitions = buildRecurringReminderDefinitions(configs);

    assert.ok(definitions.some(definition => definition.key === 'trading'));
    assert.equal(configs.trading.time, '11:15');
    assert.deepEqual(configs.trading.days, [1, 3, 5]);
    assert.ok(Array.isArray(configs[RECURRING_REMINDERS_FIELD].reminders));
});

test('custom recurring reminders can be created, edited and removed', () => {
    const id = createRecurringReminderId('Tomar agua', ['reminder_tomar_agua']);
    assert.equal(id, 'reminder_tomar_agua_2');

    const created = upsertRecurringReminder({}, {
        id,
        name: 'Tomar agua',
        category: 'salud',
        title: '💧 Hidratación',
        body: 'Recordá tomar agua.',
        time: '14:30',
        days: [1, 2, 3, 4, 5]
    }, { now: new Date('2026-08-01T12:00:00Z') });
    assert.equal(created[id].time, '14:30');
    assert.deepEqual(created[id].days, [1, 2, 3, 4, 5]);
    const createdReminder = created[RECURRING_REMINDERS_FIELD].reminders
        .find(reminder => reminder.id === id);
    assert.equal(createdReminder.defaultTime, '14:30');
    assert.deepEqual(createdReminder.defaultDays, [1, 2, 3, 4, 5]);
    assert.ok(buildRecurringReminderDefinitions(created).some(definition => definition.key === id));

    const removed = removeRecurringReminder(created, id);
    assert.equal(removed[id], undefined);
    assert.equal(buildRecurringReminderDefinitions(removed).some(definition => definition.key === id), false);
});

test('the backend sends the same configurable recurring catalog, including Trading', async () => {
    const serverSource = await readFile(`${ROOT}/server.js`, 'utf8');
    assert.match(serverSource, /RECURRING_REMINDERS_FIELD = '__recurring_reminders'/);
    assert.match(serverSource, /ensureRecurringReminderConfigs\(/);
    assert.match(serverSource, /recurringReminderMap\.has\(key\)/);
    assert.match(serverSource, /title = recurringReminder\.title/);
    assert.match(serverSource, /body = recurringReminder\.body/);

    DEFAULT_RECURRING_REMINDERS.forEach(reminder => {
        assert.match(serverSource, new RegExp(`id: '${reminder.id}'`));
    });
});
