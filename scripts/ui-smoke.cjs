const { chromium } = require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const httpServer = express().use(express.static(path.resolve(__dirname, '..'))).listen(0, '127.0.0.1');

function installFakeCloud() {
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'qa@example.invalid' };
    const cloudDocument = {};
    const tables = { transcription_folders: [], transcription_sessions: [], transcription_documents: [] };
    class Query {
        constructor(table) { this.table = table; this.one = false; }
        select() { return this; } eq() { return this; } order() { return this; }
        limit() { return this; } in() { return this; } is() { return this; }
        range() { return this; }
        single() { this.one = true; return this; }
        maybeSingle() { this.one = true; return this; }
        insert(value) { this.value = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...value }; (tables[this.table] ||= []).push(this.value); return this; }
        then(resolve) {
            const data = this.table === 'user_data' ? { user_id: user.id, data: cloudDocument, updated_at: '2026-09-05T00:00:00Z', revision: 1 }
                : this.one ? this.value || null : tables[this.table] || [];
            return Promise.resolve({ data, error: null }).then(resolve);
        }
    }
    window.supabase = { createClient: () => ({
        auth: { getSession: async () => ({ data: { session: { user, access_token: 'qa-session' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from: table => new Query(table),
        rpc: async (name, parameters) => {
            if (name === 'merge_user_data_keys') Object.assign(cloudDocument, parameters.p_updates || {});
            return { data: name === 'get_my_resource_policy' ? { tier: 'owner', unlimited: true, limits: {} } : new Date().toISOString(), error: null };
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
        removeChannel() {}
    }) };
}

(async () => {
    await fs.mkdir('.tmp-sb/ui-smoke', { recursive: true });
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        for (const width of [1440, 390]) for (const theme of ['dark', 'light']) {
            const context = await browser.newContext({ viewport: { width, height: 960 }, serviceWorkers: 'block', isMobile: width < 500, hasTouch: width < 500 });
            await context.addInitScript(() => {
                const registration = { active: {}, addEventListener() {}, pushManager: { getSubscription: async () => null } };
                Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => registration, ready: Promise.resolve(registration), getRegistration: async () => registration, addEventListener() {} } });
            });
            const page = await context.newPage();
            page.setDefaultTimeout(10000);
            const cdp = await context.newCDPSession(page);
            await cdp.send('Runtime.enable');
            cdp.on('Runtime.exceptionThrown', event => console.log('EXCEPTION LOCATION', JSON.stringify(event.exceptionDetails)));
            const errors = [];
            page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.stack); });
            page.on('console', msg => { if (msg.type() === 'error') console.log('Browser:', msg.text().slice(0, 300)); });
            await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({ contentType: 'application/javascript', body: `(${installFakeCloud.toString()})();` }));
            await context.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/api/config')
                ? { supabaseUrl: 'https://qa.invalid', supabaseAnonKey: 'qa', registrationEnabled: false }
                : { devices: [], events: [], deliveries: [], engine: {}, success: true } }));
            await page.goto(`http://localhost:${httpServer.address().port}/`, { waitUntil: 'networkidle' });
            try { await page.waitForFunction(() => window.lifecycle_controller?.transcriptions && window.lifecycle_controller.auth?.user, null, { timeout: 10000 }); }
            catch (error) { console.log({errors, body: (await page.locator('body').innerText()).slice(0, 1600)}); throw error; }
            await page.evaluate(theme => window.lifecycle_controller.theme.apply(theme), theme);
            await page.evaluate(() => window.lifecycle_controller.openProfileTab('preferencias'));
            await page.locator('#tab-preferencias').waitFor({ state: 'visible' });
            await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-preferences.png`, fullPage: true, animations: 'disabled' });
            assert.equal(await page.evaluate(() => window.lifecycle_controller.activateSection('suscripciones-section')), true);
            await page.locator('#btn-new-subscription').click();
            await page.locator('#subscription-modal').waitFor({ state: 'visible' });
            await page.locator('#sub-name').fill('Suscripción de prueba');
            await page.locator('#sub-cost').fill('12.50');
            await page.locator('#sub-alert-time').fill('14:00');
            await page.locator('#btn-add-subscription-alert-time').click();
            await page.locator('.sub-alert-extra-time').fill('21:00');
            await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-subscription.png`, fullPage: true, animations: 'disabled' });
            await page.locator('#subscription-form [type="submit"]').click();
            await page.locator('#subscription-modal').waitFor({ state: 'hidden' });
            const saved = await page.evaluate(() => window.lifecycle_controller.subscriptions.subscriptions[0]);
            assert.equal(saved.name, 'Suscripción de prueba');
            assert.deepEqual(saved.alert.times, ['14:00', '21:00']);
            await page.locator('#global-search-btn').click();
            await page.locator('#global-search-input').fill('Suscripción de prueba');
            await page.locator('.global-search-result').filter({hasText:'Suscripción de prueba'}).click();
            await page.locator('#subscription-modal').waitFor({state:'visible'});
            assert.equal(await page.locator('#sub-name').inputValue(), 'Suscripción de prueba');
            await page.locator('#subscription-modal [data-subscription-modal-close]').first().click();
            await page.evaluate(() => window.lifecycle_controller.activateSection('transcripciones-section'));
            await page.locator('#btn-toggle-record-voice').waitFor({ state: 'visible' });
            await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-transcriptions.png`, fullPage: true, animations: 'disabled' });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
            assert.equal(overflow, false, `horizontal overflow at ${width}/${theme}`);
            if (width < 500) {
                await page.locator('.adaptive-nav-more').click();
                await page.locator('[data-adaptive-nav-action="close"]').click();
                await page.waitForTimeout(650);
                const visibleTooltip = await page.locator('#lifecycle-tooltip[aria-hidden="false"]').count();
                assert.equal(visibleTooltip, 0, 'More tooltip remained after closing');
            }
            assert.deepEqual(errors, [], `uncaught errors at ${width}/${theme}`);
            console.log(JSON.stringify({width,theme,profile:true,subscriptionEditor:true,transcriptions:true,noOverflow:true,noUncaughtErrors:true}));
            await context.close();
        }
    } finally { await browser.close(); httpServer.close(); }
})().catch(error => { console.error(error); httpServer.close(); process.exitCode = 1; });
