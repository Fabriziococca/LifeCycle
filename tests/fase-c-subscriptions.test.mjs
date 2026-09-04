import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    advanceSubscriptionRenewal,
    calculateMonthlyEquivalent,
    calculateNextRenewalDate,
    getSubscriptionExpenseOccurrenceKey,
    migrateWorkanaToSubscriptions,
    normalizeSubscription
} from '../subscription-utils.mjs';
import { APP_MODULES } from '../custom-tracker-utils.mjs';

const ROOT = process.cwd();

test('subscription model preserves billing anchors, identity and monthly equivalents', () => {
    const sub = normalizeSubscription({
        id: 'sub_month_end',
        name: 'Servicio mensual',
        cost: 45,
        currency: 'USD',
        periodMonths: 1,
        startDate: '2026-01-31',
        nextRenewalDate: '2026-01-31'
    });

    assert.equal(sub.billingAnchorDay, 31);
    assert.equal(sub.billingAnchorIsMonthEnd, true);
    assert.equal(calculateMonthlyEquivalent(sub.cost, 3), 15);
    assert.equal(calculateNextRenewalDate('2026-01-31', 1, new Date('2026-01-01')), '2026-02-28');
    assert.equal(advanceSubscriptionRenewal(sub, '2026-01-31').nextRenewalDate, '2026-02-28');
    assert.equal(
        getSubscriptionExpenseOccurrenceKey(sub, '2026-01-31'),
        'subscription:sub_month_end:renewal:2026-01-31'
    );
});

test('subscriptions interface supports lifecycle status, multiple alert times and a creation guard', () => {
    const moduleSource = fs.readFileSync(path.join(ROOT, 'modules', 'SubscriptionsModule.js'), 'utf8');
    const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const styles = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

    assert.match(moduleSource, /async setStatus\(subscriptionId, status\)/);
    assert.match(moduleSource, /async recordExpense\(subscriptionId/);
    assert.match(moduleSource, /async deleteSubscription\(subscriptionId\)/);
    assert.match(moduleSource, /normalizeAlertTimes/);
    assert.match(moduleSource, /if \(capacity && !capacity\.allowed\)/);
    assert.match(moduleSource, /getResourceLimitMessage\(RESOURCE_KEYS\.SUBSCRIPTIONS, capacity\.limit\)/);
    assert.match(indexSource, /id="suscripciones-section"/);
    assert.match(indexSource, /id="subscription-modal"/);
    assert.match(indexSource, /id="btn-new-subscription"/);
    assert.match(indexSource, /id="subscriptions-list"/);
    assert.match(indexSource, /class="modal-content subscription-modal-content"/);
    assert.match(indexSource, /<label for="sub-name">/);
    assert.match(indexSource, /<label for="sub-alert-time">/);
    assert.match(indexSource, /class="subscription-form-row subscription-form-row--money"/);
    assert.match(styles, /#subscription-modal \.subscription-modal-content\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 2rem\)/);
    assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?#subscription-modal \.subscription-modal-content/);
});

test('subscription expenses use the authenticated atomic RPC and stable occurrence keys', () => {
    const finanzasSource = fs.readFileSync(path.join(ROOT, 'modules', 'FinanzasModule.js'), 'utf8');
    const migration = fs.readFileSync(path.join(
        ROOT,
        'supabase',
        'migrations',
        '20260904034548_lifecycle_subscriptions_and_transcription_foundation.sql'
    ), 'utf8');

    assert.match(finanzasSource, /recordSubscriptionExpense/);
    assert.match(finanzasSource, /subscriptionOccurrenceKey/);
    assert.match(finanzasSource, /rpc\(\s*'record_subscription_expense'/);
    assert.match(migration, /where row_data\.user_id = v_user_id\s+for update/i);
    assert.match(migration, /p_occurrence_key/i);
    assert.match(migration, /security definer[\s\S]+set search_path = pg_catalog, pg_temp/i);
});

test('Workana migrates once and legacy alerts and deep links converge on the new subscription', () => {
    const legacy = { plan: 'Plus', cost: 29.99, cycle: 3, startDate: '2026-05-10' };
    const first = migrateWorkanaToSubscriptions(legacy, []);
    const second = migrateWorkanaToSubscriptions(legacy, first.subscriptions);

    assert.equal(first.migrated, true);
    assert.equal(first.subscriptions[0].id, 'sub_workana_plan');
    assert.equal(second.migrated, false);
    assert.equal(second.subscriptions.length, 1);

    const moduleSource = fs.readFileSync(path.join(ROOT, 'modules', 'SubscriptionsModule.js'), 'utf8');
    const serverSource = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(moduleSource, /delete this\.app\.alerts\.configs\.workana/);
    assert.match(serverSource, /delete alertsConfig\.workana/);
    assert.match(serverSource, /open=subscription&id=sub_workana_plan/);
    assert.match(appSource, /targetElementId: 'subscription-sub_workana_plan'/);
});

test('Subscriptions is integrated into modules, search and overdue notifications', () => {
    assert.equal(APP_MODULES['suscripciones-section']?.label, 'Suscripciones');
    const searchSource = fs.readFileSync(path.join(ROOT, 'modules', 'GlobalSearchModule.js'), 'utf8');
    const notificationsSource = fs.readFileSync(path.join(ROOT, 'modules', 'NotificationsCenterModule.js'), 'utf8');
    assert.match(searchSource, /getSubscriptionItems/);
    assert.match(searchSource, /command:suscripciones/);
    assert.match(notificationsSource, /this\.app\.subscriptions/);
    assert.match(notificationsSource, /PROYECTOS ACTIVOS \(independiente de que haya suscripciones\)/);
});
