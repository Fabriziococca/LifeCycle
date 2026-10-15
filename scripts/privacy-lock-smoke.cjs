const assert = require('node:assert/strict');

async function runPrivacyLockSmoke(page, { width, theme }) {
    const phrase = 'local-synthetic-lock-key';
    const nextPhrase = 'changed-synthetic-lock-key';
    const gate = page.locator('#privacy-lock-gate');
    const settings = page.locator('#privacy-lock-settings');
    const lock = page.locator('#privacy-lock-btn');
    const confirmation = page.locator('#app-feedback-dialog');
    const requestLock = async () => {
        await lock.click();
        await confirmation.waitFor({ state: 'visible' });
        await page.locator('#app-feedback-dialog [data-feedback-confirm]').click();
        await gate.waitFor({ state: 'visible' });
    };
    const unlock = async (password = phrase) => {
        await page.locator('#privacy-unlock-password').fill(password);
        await page.locator('#privacy-unlock-submit').click();
        await gate.waitFor({ state: 'hidden' });
    };
    await lock.click();
    await settings.waitFor({ state: 'visible' });
    await page.locator('#privacy-lock-new').fill(phrase);
    await page.locator('#privacy-lock-confirm').fill('does-not-match');
    await page.locator('#privacy-lock-save').click();
    await page.locator('#privacy-lock-error').filter({ hasText: 'no coinciden' }).waitFor();
    await page.locator('#privacy-lock-confirm').fill(phrase);
    await page.locator('#privacy-lock-save').click();
    await gate.waitFor({ state: 'visible' });
    assert.equal(await page.locator('main.container').isVisible(), false);
    await page.evaluate(() => window.lifecycle_controller.privacyLock.onAccessState(true, 'other-synthetic-account'));
    assert.equal(await gate.isVisible(), false, 'a different account inherited this local lock');
    await page.evaluate(() => window.lifecycle_controller.privacyLock.onAccessState(true, window.lifecycle_controller.auth.readyUserId));
    await gate.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.querySelector('main').inert), true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+n');
    await page.keyboard.press('Control+k');
    assert.equal(await gate.isVisible(), true);
    assert.equal(await page.locator('#global-search-modal').isVisible(), false);
    await page.locator('#privacy-unlock-password').fill('wrong-key');
    await page.locator('#privacy-unlock-submit').click();
    await page.locator('#privacy-unlock-error').filter({ hasText: 'incorrecta' }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId);
    await gate.waitFor({ state: 'visible' });
    await page.evaluate(() => window.qaReconfirmSession());
    assert.equal(await gate.isVisible(), true, 'session refresh bypassed lock');
    await page.context().setOffline(true);
    await unlock();
    await page.context().setOffline(false);
    // An accidental click, Cancel or Escape must leave the app usable and
    // preserve the configured verifier. Only the explicit second click locks.
    await lock.click();
    await confirmation.waitFor({ state: 'visible' });
    assert.match(await confirmation.innerText(), /¿Seguro que querés bloquear la aplicación\?/);
    assert.equal(await gate.isVisible(), false);
    await page.screenshot({ path: `.tmp-sb/ui-smoke/privacy-confirm-${width}-${theme}.png` });
    await page.locator('#app-feedback-dialog [data-feedback-cancel]').click();
    await confirmation.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('main.container').isVisible(), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lifecycle_privacy_lock:11111111-1111-4111-8111-111111111111')).locked), false);
    await lock.click();
    await confirmation.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await confirmation.waitFor({ state: 'hidden' });
    assert.equal(await gate.isVisible(), false);
    const stored = await page.evaluate(async () => {
        const { createBackupPayload } = await import('/backup-utils.mjs');
        return { raw: localStorage.getItem('lifecycle_privacy_lock:11111111-1111-4111-8111-111111111111'),
            backup: JSON.stringify(createBackupPayload(key => localStorage.getItem(key))), cloud: JSON.stringify(window.qaCloudDocument()) };
    });
    assert.equal(stored.raw.includes(phrase), false);
    assert.equal(stored.backup.includes('lifecycle_privacy_lock:'), false);
    assert.equal(stored.cloud.includes('lifecycle_privacy_lock:'), false);

    // A second tab for the same account must hide its content immediately too.
    const second = await page.context().newPage();
    await second.goto(page.url(), { waitUntil: 'networkidle' });
    await second.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId);
    await second.evaluate(() => window.lifecycle_controller.privacyLock.configure());
    await second.locator('#privacy-lock-settings').waitFor({ state: 'visible' });
    await requestLock();
    await second.locator('#privacy-lock-gate').waitFor({ state: 'visible' });
    assert.equal(await second.locator('#privacy-lock-settings').isVisible(), false, 'native dialog covers privacy screen');
    await unlock();
    await second.locator('#privacy-lock-gate').waitFor({ state: 'hidden' });
    await second.locator('#privacy-lock-settings').waitFor({ state: 'visible' });
    await second.locator('#privacy-lock-cancel').click();
    await second.close();

    await page.evaluate(() => window.lifecycle_controller.openProfileTab('preferencias'));
    await page.locator('#privacy-lock-configure').click();
    await page.locator('#privacy-lock-current').fill('incorrect-key');
    await page.locator('#privacy-lock-new').fill(nextPhrase);
    await page.locator('#privacy-lock-confirm').fill(nextPhrase);
    await page.locator('#privacy-lock-save').click();
    await page.locator('#privacy-lock-error').filter({ hasText: 'actual no es correcta' }).waitFor();
    await page.locator('#privacy-lock-current').fill(phrase);
    await page.locator('#privacy-lock-save').click();
    await settings.waitFor({ state: 'hidden' });
    await requestLock();
    await unlock(nextPhrase);

    await requestLock();
    await page.screenshot({ path: `.tmp-sb/ui-smoke/privacy-locked-${width}-${theme}.png` });
    await unlock(nextPhrase);
    await page.locator('#privacy-lock-configure').click();
    assert.equal(await settings.isVisible(), true);
    await page.locator('#privacy-lock-cancel').click();
    assert.equal(await page.locator('#privacy-lock-current').inputValue(), '');

    await requestLock();
    await page.locator('#privacy-lock-signout').click();
    await page.locator('#access-gate-form').waitFor({ state: 'visible' });
    await page.locator('#access-email').fill('qa@example.invalid');
    await page.locator('#access-password').fill('wrong-account-password');
    await page.locator('#access-gate-form [type=submit]').click();
    await page.locator('#access-gate-error').filter({ hasText: 'incorrectos' }).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lifecycle_privacy_lock:11111111-1111-4111-8111-111111111111')).locked), true);
    await page.locator('#access-password').fill('qa-account-password');
    await page.locator('#access-gate-form [type=submit]').click();
    await page.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId);
    await page.locator('main.container').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#access-password').inputValue(), '', 'account password retained in hidden form after login');
    assert.equal(await gate.isVisible(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('lifecycle_privacy_lock:11111111-1111-4111-8111-111111111111')), null);
}
module.exports = { runPrivacyLockSmoke };
