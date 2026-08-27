import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    buildRecurringReminderDefinitions,
    createRecurringReminderId,
    DEFAULT_RECURRING_REMINDERS,
    describeRecurringSchedule,
    matchesRecurringSchedule,
    migrateRecurringReminderConfigs,
    normalizeRecurringSchedule,
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

test('monthly schedules use the last valid day when a month is shorter', () => {
    const schedule = normalizeRecurringSchedule({ type: 'monthly', day: 31 });

    assert.deepEqual(schedule, {
        type: 'monthly',
        day: 31,
        overflow: 'last-day'
    });
    assert.equal(matchesRecurringSchedule(schedule, {
        year: 2026,
        month: 2,
        day: 28,
        dayOfWeek: 6
    }), true);
    assert.equal(matchesRecurringSchedule(schedule, {
        year: 2026,
        month: 4,
        day: 30,
        dayOfWeek: 4
    }), true);
    assert.equal(matchesRecurringSchedule(schedule, {
        year: 2026,
        month: 4,
        day: 29,
        dayOfWeek: 3
    }), false);
    assert.match(describeRecurringSchedule(schedule), /Mensual · día 31/);
});

test('yearly schedules preserve leap-day intent without skipping non-leap years', () => {
    const schedule = normalizeRecurringSchedule({
        type: 'yearly',
        month: 2,
        day: 29
    });

    assert.equal(matchesRecurringSchedule(schedule, {
        year: 2028,
        month: 2,
        day: 29,
        dayOfWeek: 2
    }), true);
    assert.equal(matchesRecurringSchedule(schedule, {
        year: 2027,
        month: 2,
        day: 28,
        dayOfWeek: 0
    }), true);
    assert.equal(matchesRecurringSchedule(schedule, {
        year: 2027,
        month: 3,
        day: 1,
        dayOfWeek: 1
    }), false);
    assert.match(
        describeRecurringSchedule(schedule),
        /Anual · 29 de febrero \(o último día válido\)/
    );
});

test('monthly and yearly reminder schedules survive registry updates', () => {
    const monthly = upsertRecurringReminder({}, {
        id: 'reminder_cierre_mensual',
        name: 'Cierre mensual',
        category: 'otros',
        title: 'Cierre mensual',
        body: 'Revisar el cierre.',
        time: '20:00',
        schedule: { type: 'monthly', day: 31 }
    }, { now: new Date('2026-08-17T12:00:00Z') });
    const yearly = upsertRecurringReminder(monthly, {
        id: 'reminder_balances_q1',
        name: 'Temporada Q1',
        category: 'trading',
        title: 'Temporada de balances',
        body: 'Revisar balances.',
        time: '10:00',
        schedule: { type: 'yearly', month: 1, day: 15 }
    }, { now: new Date('2026-08-17T12:00:00Z') });

    assert.deepEqual(yearly.reminder_cierre_mensual.schedule, {
        type: 'monthly',
        day: 31,
        overflow: 'last-day'
    });
    assert.deepEqual(yearly.reminder_balances_q1.schedule, {
        type: 'yearly',
        month: 1,
        day: 15,
        overflow: 'last-day'
    });
    assert.deepEqual(yearly.reminder_balances_q1.days, []);
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
