import test from 'node:test';
import assert from 'node:assert/strict';

import {
    addMonthsToDate,
    calculateNextRenewalDate,
    getDaysUntilRenewal,
    calculateMonthlyEquivalent,
    normalizeSubscription,
    normalizeSubscriptionRegistry,
    migrateWorkanaToSubscriptions
} from '../subscription-utils.mjs';

test('addMonthsToDate: handles month-end boundaries and leap years correctly', () => {
    // End of January in non-leap year (2026) -> Feb 28
    assert.equal(addMonthsToDate('2026-01-31', 1), '2026-02-28');

    // End of January in leap year (2024) -> Feb 29
    assert.equal(addMonthsToDate('2024-01-31', 1), '2024-02-29');

    // Regular addition
    assert.equal(addMonthsToDate('2026-08-15', 3), '2026-11-15');
    assert.equal(addMonthsToDate('2026-11-01', 2), '2027-01-01');
});

test('calculateNextRenewalDate: rolls forward across elapsed periods', () => {
    // If started 6 months ago on 3-month cycle, renewal should be in the future
    const next = calculateNextRenewalDate('2026-01-10', 3, new Date('2026-08-20'));
    assert.equal(next, '2026-10-10');
});

test('calculateMonthlyEquivalent: divides cost accurately by period in months', () => {
    assert.equal(calculateMonthlyEquivalent(45, 3), 15);
    assert.equal(calculateMonthlyEquivalent(120, 12), 10);
    assert.equal(calculateMonthlyEquivalent(9.99, 1), 9.99);
});

test('normalizeSubscription: populates defaults and sanitizes values', () => {
    const sub = normalizeSubscription({
        name: 'GitHub Copilot',
        cost: 10,
        currency: 'USD',
        periodMonths: 1,
        startDate: '2026-05-01'
    });

    assert.equal(sub.name, 'GitHub Copilot');
    assert.equal(sub.cost, 10);
    assert.equal(sub.currency, 'USD');
    assert.equal(sub.periodMonths, 1);
    assert.equal(sub.category, 'otros');
    assert.equal(sub.autoRenew, true);
    assert.equal(sub.status, 'active');
    assert.deepEqual(sub.alert.times, ['09:00']);
});

test('migrateWorkanaToSubscriptions: migrates legacy projectPulseSubscription idempotently', () => {
    const legacy = {
        plan: 'Pro',
        cost: 35.5,
        cycle: 3,
        startDate: '2026-06-01'
    };

    const firstRun = migrateWorkanaToSubscriptions(legacy, []);
    assert.equal(firstRun.migrated, true);
    assert.equal(firstRun.subscriptions.length, 1);
    assert.match(firstRun.subscriptions[0].name, /Workana/);
    assert.equal(firstRun.subscriptions[0].cost, 35.5);
    assert.equal(firstRun.subscriptions[0].periodMonths, 3);

    // Second run must be idempotent and not create duplicate
    const secondRun = migrateWorkanaToSubscriptions(legacy, firstRun.subscriptions);
    assert.equal(secondRun.migrated, false);
    assert.equal(secondRun.subscriptions.length, 1);
});
