const { chromium } = require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const server = express().use(express.static(path.resolve(__dirname, '..'))).listen(0, '127.0.0.1');

(async () => {
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const base = `http://127.0.0.1:${server.address().port}`;
        await page.goto(`${base}/recovery.html`);
        await page.waitForFunction(() => document.getElementById('recovery-message').textContent.includes('todavía'));
        // Seed synthetic data through the real crypto/IndexedDB implementation.
        await page.evaluate(async () => {
            const { createRecoveryVault, encryptRecoverySnapshot, saveRecoveryVault } = await import('/recovery-vault.mjs');
            const vault = await createRecoveryVault('qa-owner', 'qa-local-long-password');
            const makePayload = (date, lensDate) => ({ appName: 'LifeCycle', backupVersion: 2, ownerId: 'qa-owner', exportDate: date,
                pendingCloudChanges: true, data: { lensDate, tareas_list: [{ text: '<img src=x onerror=alert(1)>', completed: true }] } });
            const first = await encryptRecoverySnapshot(vault, makePayload('2026-09-27T20:00:00Z', '2026-08-01'));
            await saveRecoveryVault(vault, first, { initial: true });
            const second = await encryptRecoverySnapshot(vault, makePayload('2026-09-27T21:00:00Z', '2026-09-20'));
            await saveRecoveryVault(vault, second);
            // An older tab's delayed write must not replace the current version.
            await saveRecoveryVault(vault, first);
            await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
        });
        await page.reload();
        await page.locator('#vault-select option').waitFor({ state: 'attached' });
        assert.equal(await page.locator('#snapshot-select option').count(), 2);
        await page.locator('#vault-password').fill('wrong-password');
        await page.locator('#unlock-form button').click();
        await page.getByText('Clave incorrecta o copia dañada.', { exact: false }).waitFor();
        assert.equal(await page.locator('#read-view').isVisible(), false);
        await page.locator('#vault-password').fill('qa-local-long-password');
        await page.locator('#unlock-form button').click();
        await page.locator('#read-view').waitFor({ state: 'visible' });
        assert.match(await page.locator('#recovery-data').textContent(), /2026-09-20/);
        assert.equal(await page.locator('#recovery-data img').count(), 0);
        assert.match(await page.locator('#snapshot-info').textContent(), /pendientes/);
        await page.locator('#lock-vault').click();
        assert.equal(await page.locator('#recovery-data').textContent(), '');
        // Test a real cached reload with network unavailable, not a mocked API.
        await context.setOffline(true);
        await page.goto(`${base}/`);
        await page.locator('#vault-select option').waitFor({ state: 'attached' });
        await page.locator('#vault-password').fill('qa-local-long-password');
        await page.locator('#unlock-form button').click();
        await page.locator('#read-view').waitFor({ state: 'visible' });
        assert.match(await page.locator('#recovery-data').textContent(), /2026-09-20/);
        await fs.mkdir('.tmp-sb/ui-smoke', { recursive: true });
        await page.screenshot({ path: '.tmp-sb/ui-smoke/recovery-offline-mobile.png', fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
        assert.deepEqual(errors, []);
        console.log('Recovery: encrypted IDB, wrong password, tampering-safe rendering, versions, stale-write guard and real offline root reload passed.');
        await context.close();
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
