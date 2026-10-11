const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

// Runs only in ui-smoke's isolated browser and synthetic cloud.
async function runLifecycleImprovementsSmoke(page, { width, theme }) {
    const stamp = await page.evaluate(() => {
        const today = new Date();
        today.setDate(today.getDate() + 7);
        return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    });
    await page.evaluate(() => {
        const app = window.lifecycle_controller;
        app.openProfileTab('seguimientos');
        app.customTrackers.openEditor('hygiene');
    });
    await page.locator('#custom-tracker-name').fill('QA pausa y porcentajes');
    await page.locator('#custom-tracker-interval').fill('90');
    assert.equal(await page.locator('#custom-tracker-yellow').inputValue(), '63');
    assert.equal(await page.locator('#custom-tracker-orange').inputValue(), '76');
    await page.locator('#custom-tracker-interval').fill('400');
    assert.equal(await page.locator('#custom-tracker-yellow').inputValue(), '280');
    assert.equal(await page.locator('#custom-tracker-orange').inputValue(), '340');
    assert.equal(await page.locator('#custom-tracker-yellow').getAttribute('readonly'), '');
    await page.locator('#custom-tracker-threshold-mode').selectOption('manual');
    await page.locator('#custom-tracker-yellow').fill('180');
    await page.locator('#custom-tracker-orange').fill('270');
    await page.locator('#custom-tracker-form button[type="submit"]').click();
    const trackerId = await page.evaluate(() => window.lifecycle_controller.customTrackers.registry.trackers.find(t => t.name === 'QA pausa y porcentajes').id);
    await page.evaluate(id => window.lifecycle_controller.customTrackers.openEditor('hygiene', id), trackerId);
    assert.equal(await page.locator('#custom-tracker-threshold-mode').inputValue(), 'manual');
    await page.locator('#custom-tracker-threshold-mode').selectOption('automatic');
    await page.locator('#custom-tracker-interval').fill('30');
    assert.equal(await page.locator('#custom-tracker-yellow').inputValue(), '21');
    assert.equal(await page.locator('#custom-tracker-orange').inputValue(), '25');
    await page.locator('#custom-tracker-form button[type="submit"]').click();
    const before = await page.evaluate(id => {
        const app = window.lifecycle_controller;
        const last = new Date(Date.now() - 10 * 86400000).toISOString();
        app.customTrackers.registry.histories[id] = [last];
        app.customTrackers.persistRegistry();
        app.adaptiveNavigation.closeMore({ restoreFocus: false });
        app.activateSection('higiene-section');
        return app.customTrackers.getHistory(id);
    }, trackerId);
    let card = page.locator(`.custom-tracker-card[data-tracker-id="${trackerId}"]`);
    await card.getByRole('button', { name: 'Pausar', exact: true }).click();
    await card.locator('.custom-tracker-status').filter({ hasText: 'Pausada' }).waitFor();
    assert.equal(await card.locator('.custom-tracker-record').isDisabled(), true);
    const pausedMetric = await card.locator('.custom-tracker-metric strong').textContent();
    await page.evaluate(async () => window.lifecycle_controller.auth.flushPendingKeySync(true));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId);
    await page.evaluate(theme => window.lifecycle_controller.theme.apply(theme), theme);
    await page.evaluate(() => window.lifecycle_controller.activateSection('higiene-section'));
    card = page.locator(`.custom-tracker-card[data-tracker-id="${trackerId}"]`);
    assert.equal(await card.locator('.custom-tracker-metric strong').textContent(), pausedMetric);
    assert.equal(await page.evaluate(id => window.lifecycle_controller.notificationsCenter.getOverdueItems().some(i => i.id === id), trackerId), false);
    await fs.mkdir('.tmp-sb/ui-smoke', { recursive: true });
    await card.screenshot({ path: `.tmp-sb/ui-smoke/improvements-paused-${width}-${theme}.png` });
    await card.getByRole('button', { name: 'Reanudar', exact: true }).click();
    assert.deepEqual(await page.evaluate(id => window.lifecycle_controller.customTrackers.getHistory(id), trackerId), before);

    await page.evaluate(() => window.lifecycle_controller.activateSection('suscripciones-section'));
    const monthlyBefore = await page.locator('#subs-summary-monthly-usd').textContent();
    await page.locator('#btn-new-subscription').click();
    await page.locator('#sub-name').fill('QA prueba gratuita');
    await page.locator('#sub-cost').fill('20');
    await page.locator('#sub-auto-record-expense').check();
    await page.locator('#sub-billing-mode').selectOption('trial');
    assert.equal(await page.locator('#sub-auto-record-expense').isDisabled(), true);
    await page.locator('#sub-renewal-date').fill(stamp);
    await page.locator('#subscription-form button[type="submit"]').click();
    assert.equal(await page.locator('#subs-summary-monthly-usd').textContent(), monthlyBefore);
    const subscriptionId = await page.evaluate(() => window.lifecycle_controller.subscriptions.subscriptions.find(s => s.name === 'QA prueba gratuita').id);
    const sub = page.locator(`#subscription-${subscriptionId}`);
    assert.match(await sub.textContent(), /Gratis ahora/);
    assert.match(await sub.textContent(), /Precio si pagás: \$20.00/);
    assert.equal(await sub.locator('[data-subscription-action="expense"]').count(), 0);
    await page.locator('[data-subscription-filter="free"]').click();
    await sub.waitFor();
    await sub.screenshot({ path: `.tmp-sb/ui-smoke/improvements-free-${width}-${theme}.png` });
    await sub.locator('[data-subscription-action="convert-paid"]').click();
    await page.locator('#sub-renewal-date').fill(stamp);
    await page.locator('#subscription-form button[type="submit"]').click();
    await page.locator('[data-subscription-filter="active"]').click();
    await sub.waitFor();
    assert.equal(await page.evaluate(id => window.lifecycle_controller.subscriptions.subscriptions.find(s => s.id === id).billingMode, subscriptionId), 'paid');
    assert.equal(await page.evaluate(() => window.lifecycle_controller.finanzas.data.expenses.length), 0);
    await page.evaluate(id => window.lifecycle_controller.subscriptions.openModal(id), subscriptionId);
    await page.locator('#sub-billing-mode').selectOption('trial');
    await page.locator('#subscription-form button[type="submit"]').click();
    await page.locator('[data-subscription-filter="free"]').click();
    await sub.locator('[data-subscription-action="decline"]').click();
    await page.getByRole('button', { name: 'Marcar cancelada', exact: true }).click();
    assert.equal(await page.evaluate(id => window.lifecycle_controller.subscriptions.subscriptions.find(s => s.id === id).status, subscriptionId), 'canceled');

    await page.evaluate(async () => {
        const { upsertRecurringReminder } = await import('/recurring-reminder-utils.mjs');
        const app = window.lifecycle_controller;
        app.alerts.configs = upsertRecurringReminder(app.alerts.configs, { id: 'reminder_qa_pause', name: 'QA recordatorio pausa', category: 'higiene', times: ['09:00', '22:00'] });
        app.alerts.saveData(); app.openProfileTab('alertas'); app.alerts.activeCategory = 'higiene'; app.alerts.render();
    });
    const reminder = page.locator('.alert-card-item[data-alert-key="reminder_qa_pause"]');
    await reminder.locator('[data-recurring-reminder-action="toggle-pause"]').click();
    assert.match(await reminder.textContent(), /Pausado/);
    await reminder.locator('[data-recurring-reminder-action="edit"]').click();
    await page.locator('#recurring-reminder-name').fill('QA recordatorio pausa editado');
    await page.locator('#recurring-reminder-form button[type="submit"]').click();
    assert.equal(await page.evaluate(() => window.lifecycle_controller.alerts.configs.reminder_qa_pause.paused), true);
    await reminder.locator('[data-recurring-reminder-action="toggle-pause"]').click();
    assert.equal(await page.evaluate(() => window.lifecycle_controller.alerts.configs.reminder_qa_pause.paused), false);

    await page.evaluate(() => {
        const app = window.lifecycle_controller;
        app.projects.projects = [{ id: 'qa-arbitration', client: 'Cliente QA', project: 'Proyecto QA en arbitraje', accepted: '2026-09-01T12:00:00Z', deadline: '2026-10-09T23:00:00-03:00', isArbitration: true, budgetGross: 100, timerStart: null, totalTime: 0 }];
        app.projects.saveData(); app.activateSection('projects-section');
        app.adaptiveNavigation.closeMore({ restoreFocus: false });
    });
    assert.equal(await page.evaluate(() => window.lifecycle_controller.notificationsCenter.getOverdueItems().some(i => i.id === 'qa-arbitration')), false);
    assert.match(await page.locator('[data-project-id="qa-arbitration"] .project-exact-deadline').textContent(), /viernes, 09\/10\/2026 a las 23:00 h/);
    await page.locator('[data-project-id="qa-arbitration"]').screenshot({ path: `.tmp-sb/ui-smoke/improvements-project-${width}-${theme}.png` });

    await page.evaluate(async () => {
        const { createVehicleCard } = await import('/vehicle-catalog-utils.mjs');
        const app = window.lifecycle_controller;
        const cards = app.vehicle.cards;
        const created = createVehicleCard({ name: 'QA vehículo pausado', type: 'check', intervalDays: 30 });
        cards.catalog.cards.push(created); cards.catalog.records[created.id] = [];
        cards.persist(); app.activateSection('vehiculo-section');
    });
    const vehicle = page.locator('.vehicle-dynamic-card').filter({ hasText: 'QA vehículo pausado' });
    await vehicle.getByRole('button', { name: 'Pausar', exact: true }).click();
    assert.match(await vehicle.textContent(), /Pausada/);
    assert.equal(await vehicle.locator('[data-vehicle-card-action="record"]').isDisabled(), true);
    await vehicle.getByRole('button', { name: 'Reanudar', exact: true }).click();
    assert.equal(await vehicle.locator('[data-vehicle-card-action="record"]').isDisabled(), false);
    await page.evaluate(() => {
        const app = window.lifecycle_controller;
        app.activateSection('gym-section'); app.gym.activateGymTab('nutrition');
    });
    await page.locator('#btn-vitd-pause').click();
    assert.equal(await page.locator('#vitd-badge').textContent(), 'Pausada');
    assert.equal(await page.locator('#btn-vitd-log-toggle').isDisabled(), true);
    await page.locator('#btn-vitd-pause').click();
    assert.equal(await page.locator('#btn-vitd-log-toggle').isDisabled(), false);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, `horizontal overflow at ${width}/${theme}`);
}
module.exports = { runLifecycleImprovementsSmoke };
