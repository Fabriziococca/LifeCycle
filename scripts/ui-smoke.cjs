const { chromium } = require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const httpServer = express().use(express.static(path.resolve(__dirname, '..'))).listen(0, '127.0.0.1');

function installFakeCloud() {
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'qa@example.invalid' };
    const cloudDocument = {};
    let revision = 1;
    const listeners = new Set();
    window.qaSyncMetrics = { writes: 0, realtimeEvents: 0, fullReads: 0, revisionReads: 0 };
    const tables = { transcription_folders: [], transcription_sessions: [], transcription_documents: [] };
    class Query {
        constructor(table) { this.table = table; this.one = false; }
        select(columns) { this.columns = columns; return this; } eq() { return this; } order() { return this; }
        limit() { return this; } in() { return this; } is() { return this; }
        range() { return this; }
        abortSignal() { return this; }
        single() { this.one = true; return this; }
        maybeSingle() { this.one = true; return this; }
        insert(value) { this.value = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...value }; (tables[this.table] ||= []).push(this.value); return this; }
        then(resolve) {
            if (this.table === 'user_data') {
                window.qaSyncMetrics[this.columns === 'revision' ? 'revisionReads' : 'fullReads'] += 1;
            }
            const data = this.table === 'user_data' ? { user_id: user.id, data: structuredClone(cloudDocument), updated_at: '2026-09-05T00:00:00Z', revision }
                : this.one ? this.value || null : tables[this.table] || [];
            return Promise.resolve({ data, error: null }).then(resolve);
        }
    }
    window.supabase = { createClient: () => ({
        auth: { getSession: async () => ({ data: { session: { user, access_token: 'qa-session' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from: table => new Query(table),
        rpc: async (name, parameters) => {
            if (name === 'merge_user_data_keys') {
                const previous = JSON.stringify(cloudDocument);
                (parameters.p_delete_keys || []).forEach(key => delete cloudDocument[key]);
                Object.assign(cloudDocument, parameters.p_updates || {});
                if (previous !== JSON.stringify(cloudDocument)) revision += 1;
                window.qaSyncMetrics.writes += 1;
                const payload = { new: { data: structuredClone(cloudDocument), revision } };
                // Deliberately model the OLD database: even a no-op emits a full
                // row. The client must not depend on the server guard to converge.
                setTimeout(() => listeners.forEach(listener => {
                    window.qaSyncMetrics.realtimeEvents += 1;
                    listener(payload);
                }), 20);
            }
            return { data: name === 'get_my_resource_policy' ? { tier: 'owner', unlimited: true, limits: {} } : new Date().toISOString(), error: null };
        },
        channel: () => ({ on(event, filter, callback) { this.callback = callback; return this; }, subscribe() { listeners.add(this.callback); return this; }, unsubscribe() { listeners.delete(this.callback); } }),
        removeChannel(channel) { channel.unsubscribe(); }
    }) };
}

(async () => {
    await fs.mkdir('.tmp-sb/ui-smoke', { recursive: true });
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        for (const width of [1440, 390]) for (const theme of ['dark', 'light']) {
            const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 768 }, serviceWorkers: 'block', isMobile: width < 500, hasTouch: width < 500 });
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
            await page.locator('#sub-name').fill('Workana de prueba');
            await page.locator('#sub-cost').fill('12.50');
            await page.locator('#sub-alert-time').fill('14:00');
            await page.locator('#btn-add-subscription-alert-time').click();
            await page.locator('.sub-alert-extra-time').fill('21:00');
            await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-subscription.png`, fullPage: true, animations: 'disabled' });
            await page.locator('#subscription-form [type="submit"]').click();
            await page.locator('#subscription-modal').waitFor({ state: 'hidden' });
            const saved = await page.evaluate(() => window.lifecycle_controller.subscriptions.subscriptions[0]);
            assert.equal(saved.name, 'Workana de prueba');
            assert.deepEqual(saved.alert.times, ['14:00', '21:00']);
            await page.locator('#global-search-btn').click();
            await page.locator('#global-search-input').fill('Workana de prueba');
            await page.locator('.global-search-result').filter({hasText:'Workana de prueba'}).click();
            await page.locator('#subscription-modal').waitFor({state:'visible'});
            assert.equal(await page.locator('#sub-name').inputValue(), 'Workana de prueba');
            await page.locator('#subscription-modal [data-subscription-modal-close]').first().click();
            await page.evaluate(() => window.lifecycle_controller.activateSection('transcripciones-section'));
            await page.locator('#btn-toggle-record-voice').waitFor({ state: 'visible' });
            await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-transcriptions.png`, fullPage: true, animations: 'disabled' });
            await page.evaluate(() => {
                const module = window.lifecycle_controller.transcriptions;
                module.sessions = [{ id: 'qa-modal', title: 'Clase de prueba', status: 'partial',
                    completedChunks: 1, expectedChunks: 2, totalBytes: 12345,
                    transcript: 'Transcripción completa de prueba.\n'.repeat(200),
                    notes: 'Apuntes de prueba.\n'.repeat(100) }];
                document.getElementById('btn-toggle-record-voice').focus();
                module.openDetailModal('qa-modal');
            });
            await page.locator('#transcription-detail-modal').waitFor({ state: 'visible' });
            const detailBounds = await page.evaluate(() => {
                const modal = document.getElementById('transcription-detail-modal');
                const content = modal.querySelector('.modal-content').getBoundingClientRect();
                const close = modal.querySelector('[data-transcription-modal-close]').getBoundingClientRect();
                const save = document.getElementById('btn-save-transcription-detail').getBoundingClientRect();
                const body = modal.querySelector('.transcription-detail-body');
                return { contained: content.top >= 0 && content.bottom <= innerHeight && content.left >= 0 && content.right <= innerWidth,
                    actionsVisible: close.top >= 0 && save.bottom <= innerHeight,
                    scrollable: body.scrollHeight > body.clientHeight,
                    focusInside: modal.contains(document.activeElement), width: content.width };
            });
            assert.equal(detailBounds.contained, true, 'transcription dialog outside viewport');
            assert.equal(detailBounds.actionsVisible, true, 'transcription actions clipped');
            assert.equal(detailBounds.scrollable, true, 'long transcript must scroll internally');
            assert.equal(detailBounds.focusInside, true);
            assert.ok(detailBounds.width >= (width < 500 ? 340 : 700), 'dialog is unnecessarily narrow');
            await page.keyboard.press('Shift+Tab');
            assert.equal(await page.locator('#btn-save-transcription-detail').evaluate(el => el === document.activeElement), true, 'focus must wrap inside dialog');
            await page.keyboard.press('Tab');
            assert.equal(await page.locator('#transcription-detail-modal [data-transcription-modal-close]').first().evaluate(el => el === document.activeElement), true);
            await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-transcription-detail.png`, animations: 'disabled' });
            await page.keyboard.press('Escape');
            await page.locator('#transcription-detail-modal').waitFor({ state: 'hidden' });
            assert.equal(await page.locator('#btn-toggle-record-voice').evaluate(el => el === document.activeElement), true, 'restore opener focus');
            assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'restore page scrolling');
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
            await page.waitForTimeout(3000);
            const beforeIdle = await page.evaluate(() => window.qaSyncMetrics.writes);
            await page.waitForTimeout(3000);
            assert.equal(await page.evaluate(() => window.qaSyncMetrics.writes), beforeIdle, 'idle Realtime feedback loop');
            assert.equal(await page.evaluate(() => Boolean(window.lifecycle_controller.alerts.configs.workana)), false, 'legacy Workana alert was recreated');
            assert.equal(await page.evaluate(() => window.lifecycle_controller.subscriptions.subscriptions[0]?.name), 'Workana de prueba', 'real edit lost after echo');
            const revisionChecks = await page.evaluate(async () => {
                await window.lifecycle_controller.auth.checkAndSyncData();
                const before = { ...window.qaSyncMetrics };
                for (let i = 0; i < 3; i++) await window.lifecycle_controller.auth.checkAndSyncData();
                return { fullReads: window.qaSyncMetrics.fullReads - before.fullReads,
                    revisionReads: window.qaSyncMetrics.revisionReads - before.revisionReads };
            });
            assert.deepEqual(revisionChecks, { fullReads: 0, revisionReads: 3 }, 'unchanged background checks must not transfer full documents');
            console.log(JSON.stringify({width,theme,profile:true,subscriptionEditor:true,transcriptions:true,noOverflow:true,noUncaughtErrors:true,idleSyncWrites:0}));
            await context.close();
        }
    } finally { await browser.close(); httpServer.close(); }
})().catch(error => { console.error(error); httpServer.close(); process.exitCode = 1; });
