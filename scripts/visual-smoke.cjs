const assert = require('node:assert/strict');
const { seedLegacyAudit } = require('./full-audit-smoke.cjs');

async function feedbackFits(card) {
    const overlap = await card.evaluate(root => {
        const badge = root.querySelector('.save-confirmation').getBoundingClientRect();
        return [...root.querySelectorAll('button')].some(button => {
            const b = button.getBoundingClientRect();
            return Math.min(badge.right,b.right)-Math.max(badge.left,b.left)>1 && Math.min(badge.bottom,b.bottom)-Math.max(badge.top,b.top)>1;
        });
    });
    assert.equal(overlap, false, 'Saved feedback must not cover an action');
}

// Only the isolated localhost fake cloud. Never run fixtures on the real origin.
exports.runVisualSmoke = async (page, { width, theme }) => {
    assert.match(page.url(), /^http:\/\/localhost:/);
    await seedLegacyAudit(page);
    await page.evaluate(async () => {
        const a = window.lifecycle_controller;
        const { createCustomTracker } = await import('/custom-tracker-utils.mjs');
        for (const [index, name] of ['Computadora · Pantalla', 'Computadora · Limpieza exterior', 'Auriculares'].entries()) {
            const t = createCustomTracker({ section: 'hygiene', subsection: 'tecnologia', name,
                template: 'routine', actionLabel: 'Registrar limpieza', intervalDays: index ? 21 : 7,
                icon: 'ph-laptop', alert: { enabled: false, time: '15:00' } }, { id: `ct_visual_${index}` });
            a.customTrackers.registry.trackers.push(t);
            a.customTrackers.registry.histories[t.id] = [new Date(Date.now() - (index ? 5 : 10) * 86400000).toISOString()];
        }
        a.customTrackers.persistRegistry();
        await a.auth.flushPendingKeySync();
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => window.lifecycle_controller.activateSection('higiene-section'));
    await page.locator('#tabs-container [data-category="tecnologia"]').click();
    assert.equal(await page.locator('.glow-orb').first().isVisible(), false);
    const tracker = page.locator('#tracker-container .custom-tracker-card').filter({ has: page.locator('.custom-tracker-record:not([disabled])') }).first();
    const trackerId = await tracker.getAttribute('data-tracker-id');
    const historyLength = await page.evaluate(id => window.lifecycle_controller.customTrackers.getHistory(id).length, trackerId);
    await page.evaluate(() => {
        const v = window.lifecycle_controller.visual, original = v.saved.bind(v);
        window.qaVisualFeedbackCalls = [];
        v.saved = selector => { const result = original(selector); window.qaVisualFeedbackCalls.push({selector, result}); return result; };
    });
    await tracker.locator('.custom-tracker-record').click();
    try { await tracker.locator('.save-confirmation').waitFor(); }
    catch (error) {
        console.log('Visual feedback diagnostics', await page.evaluate(id => ({calls:window.qaVisualFeedbackCalls,history:window.lifecycle_controller.customTrackers.getHistory(id).length,pending:[...window.lifecycle_controller.auth.pendingSyncKeys],ready:Boolean(window.lifecycle_controller.auth.readyUserId),feedback:document.querySelectorAll('.save-confirmation').length}),trackerId));
        await page.screenshot({path:'.tmp-sb/ui-smoke/visual-feedback-failure.png',fullPage:false});
        throw error;
    }
    assert.equal(await page.evaluate(id => window.lifecycle_controller.customTrackers.getHistory(id).length, trackerId), historyLength + 1);
    await feedbackFits(tracker);
    await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-visual-hygiene.png`, fullPage: false });

    // Reduced motion can be changed live, retains feedback and respects the OS.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
    await page.evaluate(() => window.lifecycle_controller.openProfileTab('preferencias'));
    await page.locator('#motion-preference').selectOption('reduced');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'reduced');
    await page.locator('#motion-preference').selectOption('system');
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'normal');

    // Projects expose active work before the optional form; both direct and Hoy
    // entry points open the real form and preserve keyboard focus.
    await page.evaluate(() => window.lifecycle_controller.activateSection('projects-section'));
    assert.equal(await page.locator('#project-create-panel').getAttribute('open'), null);
    assert.equal(await page.locator('#projectForm').isVisible(), false);
    await page.locator('#btn-new-project').press('Enter');
    assert.equal(await page.locator('#clientName').evaluate(e => e === document.activeElement), true);
    await page.locator('#clientName').fill('Visual QA');
    await page.locator('#projectName').fill('Proyecto visual');
    await page.locator('#acceptDate').fill('2026-10-18T12:00');
    await page.locator('#deliveryDays').fill('14');
    await page.locator('#budgetGross').fill('150');
    await page.locator('#projectForm [type="submit"]').click();
    const project = page.locator('#projectsList [data-project-id]').filter({ hasText: 'Proyecto visual' });
    await project.waitFor();
    await project.locator('.save-confirmation').waitFor();
    await feedbackFits(project);
    assert.equal(await page.locator('#projectForm').isVisible(), false);
    assert.equal(await page.locator('#btn-new-project').evaluate(e => e === document.activeElement), true);
    assert.equal(await page.locator('#projectsList').evaluate(e => Boolean(e.compareDocumentPosition(document.getElementById('project-create-panel')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    await project.getByRole('button', { name: 'Ver plan del proyecto', exact: true }).click();
    await page.locator('#proj-plan-tab-phases').click();
    await page.locator('#proj-plan-modal-close').click();
    await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-visual-projects.png`, fullPage: false });
    await page.evaluate(() => window.lifecycle_controller.today.executeQuickAction('new_project'));
    await page.locator('#clientName').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#clientName').evaluate(e => e === document.activeElement), true);

    // Workspace return stays immediate and does not navigate to a hidden module.
    await page.evaluate(() => window.lifecycle_controller.activateSection('higiene-section'));
    await page.locator('#workspace-switch').click();
    assert.equal(await page.locator('body').getAttribute('data-workspace'), 'work');
    await page.locator('#workspace-switch').click();
    assert.equal(await page.locator('body').getAttribute('data-workspace'), 'personal');

    await page.locator('#tabs-container [data-category="cargas"]').click();
    await page.locator('#charging-root [data-charge-action="edit"]').first().click();
    await page.locator('#planning-dialog [name="name"]').fill('Aspiradora · Visual QA');
    await page.locator('#planning-dialog [name="minutes"]').fill('180');
    await page.locator('#planning-dialog [name="notify"]').selectOption('no');
    await page.locator('#planning-dialog [type="submit"]').click();
    const charge = page.locator('#charging-root [data-charging-id]').first();
    await charge.locator('[data-charge-action="start"]').click();
    await charge.locator('.save-confirmation').waitFor();
    await feedbackFits(charge);
    assert.equal(await charge.getAttribute('data-charge-state'), 'active');
    assert.equal(await charge.locator('progress').getAttribute('max'), '180');
    await page.locator('.charging-guide summary').click();
    await page.evaluate(() => window.lifecycle_controller.charging.render());
    assert.notEqual(await page.locator('.charging-guide').getAttribute('open'), null);
    await page.screenshot({ path: `.tmp-sb/ui-smoke/${width}-${theme}-visual-charging.png`, fullPage: false });
    await charge.locator('[data-charge-action="stop"]').click();
    await page.waitForFunction(() => !document.querySelector('.charging-card[data-charge-state="active"]'));
    await page.waitForTimeout(1500);

    // Failed RPC: no active session and no success badge. The retry uses the
    // same normal UI; no optimistic success appears before confirmation.
    await page.evaluate(() => {
        const a = window.lifecycle_controller.auth;
        window.qaVisualOriginalRpc = a.supabase.rpc;
        a.supabase.rpc = (name, args) => name === 'save_lifecycle_planning'
            ? Promise.resolve({ data: null, error: { code: '503' } }) : window.qaVisualOriginalRpc(name, args);
    });
    await charge.locator('[data-charge-action="start"]').click();
    await page.waitForFunction(() => !window.lifecycle_controller.charging.store.busy);
    assert.equal(await charge.getAttribute('data-charge-state'), 'idle');
    assert.equal(await charge.locator('.save-confirmation').count(), 0);
    await page.evaluate(() => { window.lifecycle_controller.auth.supabase.rpc = window.qaVisualOriginalRpc; delete window.qaVisualOriginalRpc; });
    await charge.locator('[data-charge-action="start"]').click();
    await charge.locator('.save-confirmation').waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await charge.locator('[data-charge-action="stop"]').click();
    await charge.locator('.save-confirmation').waitFor();

    for (const id of ['hoy','higiene','cuidado','lentes','salud','vehiculo','gym','suscripciones','faculty','trading','tareas','work-summary','work-clients','work-followups','projects','finanzas']) {
        await page.evaluate(id => window.lifecycle_controller.activateSection(id + '-section'), id);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${id} overflow ${width}/${theme}`);
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId);
    assert.equal(await page.locator('#projectForm').isVisible(), false);
    assert.equal(await page.evaluate(() => window.lifecycle_controller.charging.store.value.devices[0].sessions.length), 2);
};
