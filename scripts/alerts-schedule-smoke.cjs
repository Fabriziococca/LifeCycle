const assert = require('node:assert/strict');

// Real application/DOM interactions against the isolated cloud in ui-smoke.cjs.
// No personal reminders or production notifications are created.
async function runAlertsScheduleSmoke(page, { width, theme }) {
    const activate = locator => width < 500 ? locator.tap() : locator.click();
    await page.evaluate(() => window.lifecycle_controller.openProfileTab('alertas'));
    const categories = await page.locator('#alerts-category-tabs [data-category]').evaluateAll(
        buttons => buttons.map(button => button.dataset.category)
    );
    assert.ok(categories.length > 1);

    // Probe both reported regressions before asserting, so a missing editor
    // method cannot hide behind the first failing add-time assertion.
    const firstCard = page.locator('.alert-card-item').filter({ has: page.locator('.btn-add-extra-time:not([disabled])') }).first();
    const countBefore = await firstCard.locator('.alert-time-input').count();
    await activate(firstCard.locator('.btn-add-extra-time'));
    const added = await firstCard.locator('.alert-time-input').count() === countBefore + 1;
    await activate(page.locator('#btn-new-recurring-reminder'));
    const modal = page.locator('#recurring-reminder-modal');
    const opened = await modal.isVisible();
    assert.deepEqual({ added, opened }, { added: true, opened: true }, 'add-time and new-reminder buttons must both respond');

    await page.locator('#recurring-reminder-name').fill('QA recordatorio multihorario');
    await page.locator('#recurring-reminder-body').fill('Mensaje de prueba sin envío real');
    await page.locator('#recurring-reminder-category').selectOption('otros');
    await page.locator('#recurring-reminder-time').fill('07:30');
    const addReminderTime = page.locator('#btn-add-reminder-time');
    for (let i = 0; i < 5; i++) await activate(addReminderTime);
    assert.equal(await modal.locator('.recurring-extra-time-input').count(), 5);
    assert.equal(await addReminderTime.isDisabled(), true);
    const readReminderTimes = () => modal.locator('input[type=time]').evaluateAll(inputs => inputs.map(input => input.value));
    assert.equal(new Set(await readReminderTimes()).size, 6, 'suggestions must be unique');
    await activate(modal.locator('.btn-remove-reminder-extra-time').first());
    assert.equal(await addReminderTime.isEnabled(), true);
    await activate(addReminderTime);
    await modal.locator('.recurring-extra-time-input').last().fill('23:15');
    // Preserve an explicit weekly schedule across edits/reload.
    for (const day of [1, 2, 3, 4, 5, 6]) await activate(page.locator(`#recurring-reminder-days [data-day="${day}"]`));
    const expectedReminderTimes = (await readReminderTimes()).sort();
    await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-new-reminder.png`, fullPage: true, animations: 'disabled' });
    await activate(modal.locator('button[type=submit]'));
    await modal.waitFor({ state: 'hidden' });
    await page.evaluate(async () => {
        await window.lifecycle_controller.auth.flushPendingKeySync(true);
        await window.lifecycle_controller.auth.checkAndSyncData();
    });
    const reminder = await page.evaluate(() => window.lifecycle_controller.alerts.getRecurringReminderRegistry().reminders.find(item => item.name === 'QA recordatorio multihorario'));
    assert.ok(reminder?.id, 'new reminder saved in registry');
    const reminderCard = page.locator(`.alert-card-item[data-alert-key="${reminder.id}"]`);
    assert.deepEqual(await reminderCard.locator('.alert-time-input').evaluateAll(inputs => inputs.map(input => input.value)), expectedReminderTimes);
    assert.equal(await reminderCard.locator('.btn-add-extra-time').isDisabled(), true);
    await activate(reminderCard.locator('.btn-remove-extra-time').first());
    assert.equal(await reminderCard.locator('.btn-add-extra-time').isEnabled(), true, 'six saved slots must allow remove then add');
    await activate(reminderCard.locator('.btn-add-extra-time i'));
    assert.equal(await reminderCard.locator('.alert-time-input').count(), 6);

    // Exercise delegated clicks in every category, not just one screenshot.
    let checkedCategories = 0;
    for (const category of categories) {
        await activate(page.locator(`#alerts-category-tabs [data-category="${category}"]`));
        const card = page.locator('.alert-card-item').filter({ has: page.locator('.btn-add-extra-time:not([disabled])') }).first();
        if (!await card.count()) continue; // Interval-only categories have no +.
        const key = await card.getAttribute('data-alert-key');
        const prior = await card.locator('.alert-time-input').evaluateAll(inputs => inputs.map(input => input.value));
        const neighboringTimes = await page.locator(`.alert-card-item:not([data-alert-key="${key}"]) .alert-time-input`).evaluateAll(inputs => inputs.map(input => input.value));
        await activate(card.locator('.btn-add-extra-time i'));
        assert.equal(await card.locator('.alert-time-input').count(), prior.length + 1, category);
        assert.deepEqual(await page.locator(`.alert-card-item:not([data-alert-key="${key}"]) .alert-time-input`).evaluateAll(inputs => inputs.map(input => input.value)), neighboringTimes, 'adding a slot changed another card');
        await card.locator('.alert-extra-time-input').last().fill('19:45');
        await activate(page.locator('#btn-save-all-alerts'));
        await page.evaluate(async () => {
            await window.lifecycle_controller.auth.flushPendingKeySync(true);
            await window.lifecycle_controller.auth.checkAndSyncData();
        });
        assert.equal(await card.locator('.alert-time-input').evaluateAll(inputs => inputs.some(input => input.value === '19:45')), true);
        checkedCategories++;
    }
    assert.ok(checkedCategories > 1);

    await activate(page.locator('#alerts-category-tabs [data-category="otros"]'));
    await activate(reminderCard.locator('[data-recurring-reminder-action=edit] i'));
    await modal.waitFor({ state: 'visible' });
    assert.equal(await modal.locator('.recurring-extra-time-input').count(), 5, 'editing must restore extra times');
    assert.deepEqual(await page.locator('#recurring-reminder-days .active').evaluateAll(buttons => buttons.map(button => Number(button.dataset.day))), [0]);
    await page.locator('#recurring-reminder-name').fill('QA recordatorio editado');
    await activate(modal.locator('button[type=submit]'));
    await modal.waitFor({ state: 'hidden' });
    await page.evaluate(() => window.lifecycle_controller.auth.flushPendingKeySync(true));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alerts_config')));
    assert.deepEqual(await page.evaluate(() => {
        const data = window.qaCloudDocument().alerts_config;
        return typeof data === 'string' ? JSON.parse(data) : data;
    }), saved, 'UI edits must reach the fake cloud');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId);
    await page.evaluate(() => window.lifecycle_controller.openProfileTab('alertas'));
    const reloaded = await page.evaluate(() => JSON.parse(JSON.stringify(window.lifecycle_controller.alerts.configs)));
    for (const [key, config] of Object.entries(saved)) assert.deepEqual(reloaded[key], config, `reload lost ${key}`);
    assert.equal(await page.locator('.alert-card-title').filter({ hasText: 'QA recordatorio editado' }).count(), 1);
    await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-alerts-saved.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'alerts horizontal overflow');
}

module.exports = { runAlertsScheduleSmoke };
