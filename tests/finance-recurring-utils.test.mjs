import test from 'node:test';
import assert from 'node:assert/strict';

import {
    advanceFinanceRecurringRule,
    buildFinanceRecurringRule,
    getDueFinanceRecurringRules,
    getNextFinanceRecurringDate,
    hasRecordedFinanceOccurrence,
    normalizeFinanceRecurringRules,
    removeFinanceRecurringRule,
    upsertFinanceRecurringRule
} from '../finance-recurring-utils.mjs';

const baseRule = {
    id: 'spotify',
    type: 'expense',
    name: 'Spotify',
    category: 'servicios',
    description: 'Suscripción Spotify',
    amount: 10,
    currency: 'USD',
    intervalMonths: 1,
    anchorDay: 31,
    nextDueDate: '2026-01-31',
    active: true
};

test('normaliza reglas y descarta configuraciones que no pueden registrarse', () => {
    const rules = normalizeFinanceRecurringRules([
        baseRule,
        { ...baseRule, id: 'spotify', name: 'Duplicada' },
        { id: 'invalid', type: 'expense', name: '', amount: 0 }
    ]);

    assert.equal(rules.length, 1);
    assert.equal(rules[0].category, 'servicios');
    assert.equal(rules[0].anchorDay, 31);
});

test('construye y actualiza reglas recurrentes sin mutar la colección original', () => {
    const created = buildFinanceRecurringRule(baseRule, {
        id: 'spotify',
        now: '2026-01-01T00:00:00.000Z'
    });
    const original = [];
    const inserted = upsertFinanceRecurringRule(original, created);
    const updated = upsertFinanceRecurringRule(inserted, {
        ...created,
        amount: 12
    });
    const removed = removeFinanceRecurringRule(updated, 'spotify');

    assert.equal(original.length, 0);
    assert.equal(inserted[0].amount, 10);
    assert.equal(updated[0].amount, 12);
    assert.deepEqual(removed, []);
});

test('detecta vencimientos por fecha local y ordena los más antiguos primero', () => {
    const rules = getDueFinanceRecurringRules([
        { ...baseRule, id: 'future', nextDueDate: '2026-08-01' },
        { ...baseRule, id: 'today', name: 'Hoy', nextDueDate: '2026-07-29' },
        { ...baseRule, id: 'old', name: 'Anterior', nextDueDate: '2026-06-29' },
        { ...baseRule, id: 'paused', active: false, nextDueDate: '2026-05-01' }
    ], '2026-07-29');

    assert.deepEqual(rules.map(rule => rule.id), ['old', 'today']);
});

test('conserva el día ancla al avanzar entre meses cortos', () => {
    assert.equal(
        getNextFinanceRecurringDate('2026-01-31', 1, 31),
        '2026-02-28'
    );
    assert.equal(
        getNextFinanceRecurringDate('2026-02-28', 1, 31),
        '2026-03-31'
    );

    const advanced = advanceFinanceRecurringRule(baseRule, {
        occurrenceDate: '2026-01-31',
        now: '2026-01-31T12:00:00.000Z'
    });
    assert.equal(advanced.nextDueDate, '2026-02-28');
    assert.equal(advanced.anchorDay, 31);
});

test('impide registrar dos veces la misma ocurrencia', () => {
    const data = {
        entries: [],
        expenses: [{
            id: 1,
            recurringRuleId: 'spotify',
            recurringOccurrence: '2026-07-29'
        }]
    };

    assert.equal(
        hasRecordedFinanceOccurrence(data, 'spotify', '2026-07-29'),
        true
    );
    assert.equal(
        hasRecordedFinanceOccurrence(data, 'spotify', '2026-08-29'),
        false
    );
});
