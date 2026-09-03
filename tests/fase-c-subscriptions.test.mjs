import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    addMonthsToDate,
    calculateNextRenewalDate,
    calculateMonthlyEquivalent,
    normalizeSubscription,
    normalizeSubscriptionRegistry,
    migrateWorkanaToSubscriptions
} from '../subscription-utils.mjs';

import { APP_MODULES } from '../custom-tracker-utils.mjs';

const ROOT = process.cwd();

test('Tanda 11: subscription model validates fields, calculates renewals and monthly equivalents', () => {
    const sub = normalizeSubscription({
        id: 'sub_test_1',
        name: 'Spotify Familiar',
        cost: 12.99,
        currency: 'USD',
        periodMonths: 1,
        startDate: '2026-01-15'
    });

    assert.equal(sub.id, 'sub_test_1');
    assert.equal(sub.name, 'Spotify Familiar');
    assert.equal(sub.cost, 12.99);
    assert.equal(sub.currency, 'USD');
    assert.equal(sub.periodMonths, 1);
    assert.equal(sub.autoRenew, true);
    assert.equal(sub.status, 'active');
    assert.equal(calculateMonthlyEquivalent(sub.cost, sub.periodMonths), 12.99);

    // Quarterly calculation
    const quarterlySub = normalizeSubscription({
        name: 'Workana',
        cost: 45,
        currency: 'USD',
        periodMonths: 3,
        startDate: '2026-06-01'
    });
    assert.equal(calculateMonthlyEquivalent(quarterlySub.cost, quarterlySub.periodMonths), 15);
});

test('Tanda 12: SubscriptionsModule defines responsive interface, cards and status toggles', () => {
    const moduleSource = fs.readFileSync(path.join(ROOT, 'modules', 'SubscriptionsModule.js'), 'utf8');
    const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    assert.match(moduleSource, /class SubscriptionsModule/);
    assert.match(moduleSource, /toggleAutoRenew/);
    assert.match(moduleSource, /recordExpense/);
    assert.match(moduleSource, /deleteSubscription/);

    assert.match(indexSource, /id="suscripciones-section"/);
    assert.match(indexSource, /id="subscription-modal"/);
    assert.match(indexSource, /id="btn-new-subscription"/);
    assert.match(indexSource, /id="subscriptions-list"/);
});

test('Tanda 13: FinanzasModule records linked subscription expense and protects against duplicate period recordings', () => {
    const finanzasSource = fs.readFileSync(path.join(ROOT, 'modules', 'FinanzasModule.js'), 'utf8');

    assert.match(finanzasSource, /recordSubscriptionExpense/);
    assert.match(finanzasSource, /category:\s*'Suscripciones'/);
    assert.match(finanzasSource, /subscriptionId/);
});

test('Tanda 14: Workana legacy subscription is migrated idempotently and server dispatches subscription alerts', () => {
    const legacy = {
        plan: 'Plus',
        cost: 29.99,
        cycle: 3,
        startDate: '2026-05-10'
    };

    const firstMigration = migrateWorkanaToSubscriptions(legacy, []);
    assert.equal(firstMigration.migrated, true);
    assert.equal(firstMigration.subscriptions.length, 1);
    assert.match(firstMigration.subscriptions[0].name, /Workana/);

    // Idempotent re-run
    const secondMigration = migrateWorkanaToSubscriptions(legacy, firstMigration.subscriptions);
    assert.equal(secondMigration.migrated, false);
    assert.equal(secondMigration.subscriptions.length, 1);

    const serverSource = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    assert.match(serverSource, /key\.startsWith\('sub_'\)/);
    assert.match(serverSource, /\/\?open=suscripciones/);
});

test('Tanda 15: Subscriptions is integrated into APP_MODULES, global search and notifications center', () => {
    assert.ok(APP_MODULES['suscripciones-section']);
    assert.equal(APP_MODULES['suscripciones-section'].label, 'Suscripciones');

    const searchSource = fs.readFileSync(path.join(ROOT, 'modules', 'GlobalSearchModule.js'), 'utf8');
    assert.match(searchSource, /getSubscriptionItems/);
    assert.match(searchSource, /command:suscripciones/);

    const notifSource = fs.readFileSync(path.join(ROOT, 'modules', 'NotificationsCenterModule.js'), 'utf8');
    assert.match(notifSource, /this\.app\.subscriptions/);
    assert.match(notifSource, /suscripciones-section/);

    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(appSource, /SubscriptionsModule/);
    assert.match(appSource, /this\.subscriptions = new SubscriptionsModule/);
});
