const { chromium } = require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const express = require('express');
const { runFinanceWorkspaceSmoke } = require('./finance-workspace-smoke.cjs');
const { runAlertsScheduleSmoke } = require('./alerts-schedule-smoke.cjs');
const { runPlanningSmoke } = require('./planning-smoke.cjs');
const { runWorkSmoke } = require('./work-smoke.cjs');
const { runCareSmoke } = require('./care-smoke.cjs');
const { runRetainerSmoke } = require('./retainer-smoke.cjs');
const { runOrganizationSmoke } = require('./organization-smoke.cjs');
const { runChargingSmoke } = require('./charging-smoke.cjs');
const { runLifecycleImprovementsSmoke } = require('./lifecycle-improvements-smoke.cjs');
const { runVisualSmoke } = require('./visual-smoke.cjs');
const { runNavigationVisualSmoke } = require('./navigation-visual-smoke.cjs');
const { runSchedulesRenewalsSmoke } = require('./schedules-renewals-smoke.cjs');
const path = require('node:path');
const httpServer = express().use(express.static(path.resolve(__dirname, '..'))).listen(0, '127.0.0.1');

const { installFakeCloud } = require('./qa-cloud.cjs');
const { runFullAuditSmoke } = require('./full-audit-smoke.cjs');
const { runActiveModulesSmoke } = require('./active-modules-smoke.cjs');
const { runPrivacyLockSmoke } = require('./privacy-lock-smoke.cjs');
const { runRecoverySmoke } = require('./recovery-legacy-smoke.cjs');

(async () => {
    await fs.mkdir('.tmp-sb/ui-smoke', { recursive: true });
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        for (const width of (process.env.LIFECYCLE_UI_WIDTH ? [Number(process.env.LIFECYCLE_UI_WIDTH)] : process.env.LIFECYCLE_UI_SMOKE_ONLY === 'audit' ? [1920,1440,1024,768,714,390,360] : [1440,390])) for (const theme of ['dark', 'light']) {
            const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 768 }, serviceWorkers: 'block', isMobile: width < 500, hasTouch: width < 500 });
            if(process.env.LIFECYCLE_UI_SMOKE_ONLY==='work') {
                // Reproduce an existing account with Hoy hidden before login,
                // rather than changing preferences during startup hydration.
                await context.addInitScript(()=>{
                    if(!sessionStorage.getItem('qa-cloud-document'))sessionStorage.setItem('qa-cloud-document',JSON.stringify({
                        hygiene_tracker_data:JSON.stringify({__trackers_v2:{version:3,customModules:[],trackers:[],histories:{},modulePreferences:{'hoy-section':{visible:false}}}})
                    }));
                });
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'recovery') {
                await context.addInitScript(() => {
                    if (!sessionStorage.getItem('qa-cloud-document')) sessionStorage.setItem('qa-cloud-document',JSON.stringify({
                        hygiene_tracker_data:JSON.stringify({listerine:{status:'paused',startDate:null}})
                    }));
                });
            }
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
                : { devices: [], events: [], deliveries: [], entries: [], available: true, engine: {}, success: true } }));
            await page.goto(`http://localhost:${httpServer.address().port}/`, { waitUntil: 'networkidle' });
            try { await page.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId && window.qaAuthListeners.length, null, { timeout: 10000 }); }
            catch (error) { console.log({errors, body: (await page.locator('body').innerText()).slice(0, 1600)}); throw error; }
            await page.evaluate(theme => window.lifecycle_controller.theme.apply(theme), theme);
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'clients') {
                await runRetainerSmoke(page,{width,theme});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,theme,clients:true}));await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'care') {
                await runCareSmoke(page,{width,theme});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,theme,care:true}));await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'organization') {
                await runOrganizationSmoke(page,{width,theme});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,theme,organization:true}));await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'renewals') {
                await runSchedulesRenewalsSmoke(page,{width,theme}); assert.deepEqual(errors,[]);
                console.log(JSON.stringify({width,theme,tradingTimes:true,reload:true,browserRenewalsDisabled:true}));
                await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'navigation') {
                await runNavigationVisualSmoke(page,{width,theme}); assert.deepEqual(errors,[]);
                console.log(JSON.stringify({width,theme,navigationOpaque:true,logoContrast:true}));
                await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'visual') {
                await runVisualSmoke(page, {width, theme}); assert.deepEqual(errors, []);
                console.log(JSON.stringify({width, theme, visual:true, reducedMotion:true, failureRecovery:true}));
                await context.close(); continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'work') {
                await runWorkSmoke(page,{width,theme});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,theme,work:true}));await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'charging') {
                await runChargingSmoke(page,{width,theme});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,theme,charging:true}));await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'recovery') {
                await runRecoverySmoke(page, {width,theme}); assert.deepEqual(errors,[]);
                console.log(JSON.stringify({width,theme,recoveryLegacy:true})); await context.close(); continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'privacy') {
                await runPrivacyLockSmoke(page, { width, theme }); assert.deepEqual(errors, []);
                console.log(JSON.stringify({width,theme,privacyLock:true})); await context.close(); continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'audit') {
                await runFullAuditSmoke(page,{width,theme});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,theme,fullAudit:true}));await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'modules') {
                await runActiveModulesSmoke(page); assert.deepEqual(errors,[]); console.log(JSON.stringify({width,theme,activeModules:true})); await context.close(); continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'planning') {
                await runPlanningSmoke(page,{width,theme});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,theme,planning:true}));await context.close();continue;
            }
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'improvements') {
                await runLifecycleImprovementsSmoke(page, { width, theme });
                assert.deepEqual(errors, [], `uncaught improvement errors at ${width}/${theme}`);
                console.log(JSON.stringify({ width, theme, arbitration: true, exactDeadline: true, freeSubscriptions: true, pauses: true, automaticThresholds: true }));
                await context.close();
                continue;
            }
            await runAlertsScheduleSmoke(page, { width, theme });
            assert.deepEqual(errors, [], `uncaught alerts errors at ${width}/${theme}`);
            if (process.env.LIFECYCLE_UI_SMOKE_ONLY === 'alerts') {
                console.log(JSON.stringify({ width, theme, alertSchedules: true, recurringReminderEditor: true, cloudReload: true }));
                await context.close();
                continue;
            }
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
            await page.evaluate(async()=>{
                const module=window.lifecycle_controller.subscriptions;
                const item=module.subscriptions[0];
                item.status='canceled'; item.nextRenewalDate='2025-01-01';
                module.saveData();
                await module.setStatus(item.id,'active');
            });
            assert.equal(await page.locator('#subscription-modal-title').textContent(),'Reactivar suscripción');
            assert.equal(await page.locator('#sub-renewal-date').inputValue(),'');
            await page.locator('#subscription-modal [data-subscription-modal-close]').first().click();
            assert.equal(await page.evaluate(()=>window.lifecycle_controller.subscriptions.subscriptions[0].status),'canceled');
            await page.evaluate(()=>{ const module=window.lifecycle_controller.subscriptions; return module.setStatus(module.subscriptions[0].id,'active'); });
            await page.locator('#sub-renewal-date').fill('2025-01-01');
            await page.evaluate(()=>window.lifecycle_controller.subscriptions.saveSubscriptionFromModal());
            await page.locator('#subscription-form-error').filter({hasText:'No uses una fecha vencida'}).waitFor();
            const renewal=await page.evaluate(async()=>{const {getLocalISODate}=await import('/utils.js');const date=new Date();date.setDate(date.getDate()+7);return getLocalISODate(date);});
            await page.locator('#sub-renewal-date').fill(renewal);
            await page.locator('#subscription-form [type=submit]').click();
            await page.locator('#subscription-modal').waitFor({state:'hidden'});
            assert.equal(await page.evaluate(()=>window.lifecycle_controller.subscriptions.subscriptions[0].status),'active');
            assert.equal(await page.evaluate(()=>window.lifecycle_controller.subscriptions.subscriptions[0].nextRenewalDate),renewal);
            assert.equal(await page.evaluate(()=>window.lifecycle_controller.finanzas.data.expenses.length),0,'reactivation backfilled inactive periods');
            assert.equal(await page.evaluate(() => window.lifecycle_controller.activateSection('transcripciones-section')), false);
            assert.equal(await page.locator('#main-nav [data-section="transcripciones-section"]').isVisible(), false);
            assert.equal(await page.evaluate(() => Boolean(window.lifecycle_controller.transcriptions)), false);
            const reconfirmed = await page.evaluate(async () => {
                const auth = window.lifecycle_controller.auth;
                let overlays = 0;
                const original = auth.setAccessGateState.bind(auth);
                auth.setAccessGateState = (state, ...args) => { if (state !== 'authenticated') overlays++; return original(state, ...args); };
                for (let i = 0; i < 5; i++) { window.qaReconfirmSession(); window.dispatchEvent(new Event('focus')); await auth.checkAndSyncData(); }
                auth.setAccessGateState = original;
                return overlays;
            });
            assert.equal(reconfirmed, 0, 'same-session focus must not cover the application');
            await page.evaluate(() => {
                const app = window.lifecycle_controller;
                const data = app.auth.gatherLocalData();
                data.projectPulseData = JSON.stringify([{ id: 'qa-project', client: 'Cliente QA', project: 'Proyecto de prueba',
                    accepted: '2026-09-01', deadline: '2026-12-01', budgetNet: 100, budgetGross: 110, timerStart: null, totalTime: 0 }]);
                app.auth.restoreDataLocally(data);
                app.activateSection('projects-section');
                window.qaProjectCard = document.querySelector('#projectsList [data-project-id="qa-project"]');
                window.qaProjectCard.querySelector('.btn-options').click();
                // A change to another module must not recreate project cards.
                for (let i = 0; i < 5; i++) app.auth.restoreDataLocally({ ...data, tareas_list: JSON.stringify([{ id: `task-${i}`, text: 'QA' }]) });
            });
            assert.equal(await page.evaluate(() => window.qaProjectCard === document.querySelector('#projectsList [data-project-id="qa-project"]')), true, 'unrelated sync replaced project card');
            assert.equal(await page.locator('#projectsList .dropdown-menu-content').isVisible(), true, 'sync closed project menu');
            await page.locator('#projectsList .btn-options').click();
            await page.locator('#projectsList .card').hover();
            await page.waitForTimeout(400);
            assert.equal(await page.locator('#projectsList .card').evaluate(el => getComputedStyle(el).transform), 'none', 'project hover must not move its hit box');
            await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-projects.png`, fullPage: true, animations: 'disabled' });
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
            await page.evaluate(() => {
                // Restore a schema-valid fixture after the intentionally minimal
                // task used above to exercise unrelated document updates.
                localStorage.setItem('tareas_list', '[]');
                window.lifecycle_controller.openProfileTab('backup');
            });
            await page.locator('#recovery-password').fill('qa-local-long-password');
            await page.locator('#recovery-password-confirm').fill('qa-local-long-password');
            await page.locator('#recovery-setup button').click();
            try { await page.locator('#recovery-setup').waitFor({ state: 'hidden' }); }
            catch (error) { console.log('Recovery status:', await page.locator('#recovery-status').textContent()); throw error; }
            assert.match(await page.locator('#recovery-status').textContent(), /Copia cifrada local/);
            const recovered = await page.evaluate(async () => {
                const app = window.lifecycle_controller;
                const { readRecoveryVault, decryptRecoverySnapshot } = await import('/recovery-vault.mjs');
                const { parseAndValidateBackupText } = await import('/backup-utils.mjs');
                localStorage.setItem('lensDate', '2026-09-20');
                await app.auth.flushPendingKeySync(true);
                await app.recovery.capture();
                const vault = await readRecoveryVault(app.auth.readyUserId);
                const payload = await decryptRecoverySnapshot(vault, 'qa-local-long-password');
                const { appName, backupVersion, exportDate, data } = payload;
                parseAndValidateBackupText(JSON.stringify({ appName, backupVersion, exportDate, data }));
                return { lensDate: data.lensDate, subscription: data.lifecycle_subscriptions.subscriptions[0].name,
                    passwordCleared: !document.getElementById('recovery-password').value,
                    plaintextPersisted: JSON.stringify(vault).includes('Workana de prueba') };
            });
            assert.deepEqual(recovered, { lensDate: '2026-09-20', subscription: 'Workana de prueba', passwordCleared: true, plaintextPersisted: false });
            assert.equal(await page.evaluate(() => window.qaSyncMetrics.transcriptionReads), 0);
            await runFinanceWorkspaceSmoke(page, { width, theme });
            assert.deepEqual(errors, [], `uncaught finance errors at ${width}/${theme}`);
            console.log(JSON.stringify({width,theme,profile:true,subscriptionEditor:true,transcriptionsArchived:true,sessionFocus:true,stableProjectCards:true,noOverflow:true,noUncaughtErrors:true,idleSyncWrites:0}));
            await context.close();
        }
    } finally { await browser.close(); httpServer.close(); }
})().catch(error => { console.error(error); httpServer.close(); process.exitCode = 1; });
