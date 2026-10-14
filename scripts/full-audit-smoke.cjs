const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

// Synthetic fixtures only. Never point this runner at the production origin.
async function seedLegacyAudit(page) {
    assert.match(page.url(), /^http:\/\/localhost:/);
    await page.evaluate(async () => {
        const app = window.lifecycle_controller;
        await app.auth.flushPendingKeySync(true);
        const { migrateLegacyTrackerRegistry } = await import('/tracker-migration.mjs');
        const { migrateVehicleCatalog, createVehicleCard } = await import('/vehicle-catalog-utils.mjs');
        const stamp = new Date(); stamp.setDate(stamp.getDate() - 35);
        const date = stamp.toISOString().slice(0, 10);
        const registry = migrateLegacyTrackerRegistry({ hasLegacyAccountData: true, hygieneData: {}, now: new Date() }).registry;
        registry.trackers.forEach(t => { if (t.template !== 'state-reminder') registry.histories[t.id] = [stamp.toISOString()]; });
        const catalog = migrateVehicleCatalog({ hasLegacyData: true, now: new Date() }).catalog;
        catalog.cards.forEach(c => { catalog.records[c.id] = [{ id: `vcr_audit_${c.id}`, date, ...(c.intervalKm ? { km: 95000 } : {}), details: {} }]; });
        const tire = createVehicleCard({ name: 'Presión de neumáticos (en frío)', type: 'check', intervalDays: 30, warningDays: 7 }, { id: 'vc_audit_pressure' });
        catalog.cards.push(tire); catalog.records[tire.id] = [];
        const doc = app.auth.gatherLocalData();
        doc.hygiene_tracker_data = JSON.stringify({ __trackers_v2: registry });
        doc.vehicle_tracker_data = JSON.stringify({ vehicleCatalog: catalog });
        doc.vehicle_odometer = '106000';
        app.auth.restoreDataLocally(doc);
        for (const key of ['hygiene_tracker_data','vehicle_tracker_data','vehicle_odometer']) app.auth.queueKeySync(key);
        await app.auth.flushPendingKeySync(true);
    });
    await page.waitForFunction(() => JSON.parse(window.qaCloudDocument().vehicle_tracker_data).vehicleCatalog.cards.length >= 13);
}
async function runFullAuditSmoke(page, { width, theme }) {
    const results = [];
    await fs.mkdir('.tmp-sb/audit-ui', { recursive: true });
    await page.addStyleTag({content:'*,*::before,*::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }'});
    await page.evaluate(() => document.fonts.ready);
    await seedLegacyAudit(page);
    const inspect = async (label) => {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const issues = await page.evaluate(() => {
            const visible = e => e.checkVisibility() && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
            const issues = [];
            for (const card of document.querySelectorAll('.main-section:not(.hidden) .card, .main-section:not(.hidden) .vehicle-info-card')) {
                if (!visible(card)) continue;
                if (card.scrollWidth > card.clientWidth + 3) issues.push({ type: 'card-overflow', id: card.id, classes: card.className, extra: card.scrollWidth - card.clientWidth });
            }
            for (const controls of document.querySelectorAll('.main-section:not(.hidden) .vehicle-card-controls, .main-section:not(.hidden) .vehicle-dynamic-card-header-actions')) {
                if (!visible(controls)) continue;
                const card = controls.closest('.card,.vehicle-info-card'); if (!card) continue;
                const outer = card.getBoundingClientRect();
                const buttons = [...controls.querySelectorAll('button')].filter(visible);
                for (const b of buttons) { const r = b.getBoundingClientRect(); if (r.right > outer.right + 3 || r.left < outer.left - 3) { const s=getComputedStyle(b),p=getComputedStyle(controls);issues.push({ type: 'button-outside-card', id: card.id, label: b.getAttribute('aria-label') || b.textContent.trim(), outer:{left:outer.left,right:outer.right},button:{left:r.left,right:r.right},style:{position:s.position,left:s.left,margin:s.margin,transform:s.transform,width:s.width,flex:s.flex,controlsWidth:p.width,controlsMargin:p.margin,controlsFlex:p.flex} }); } }
                for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
                    const a = buttons[i].getBoundingClientRect(), b = buttons[j].getBoundingClientRect();
                    if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2) issues.push({ type:'overlapping-buttons', id:card.id });
                }
            }
            if (document.documentElement.scrollWidth > innerWidth + 3) issues.push({ type:'page-overflow',extra:document.documentElement.scrollWidth-innerWidth });
            return issues;
        });
        results.push({ label, issues });
        if (issues.length || (width === 1440 && theme === 'dark' && ['vehicle','faculty-empty'].includes(label))) await page.screenshot({ path: `.tmp-sb/audit-ui/${width}-${theme}-${label}.png`, fullPage: true, animations: 'disabled' });
    };
    for (const section of ['hoy','higiene','cuidado','lentes','salud','vehiculo','gym','projects','finanzas','suscripciones','trading','faculty','tareas']) {
        await page.evaluate(id => window.lifecycle_controller.activateSection(id + '-section'), section);
        if (section === 'vehiculo') {
            for (const tab of ['maint','docs','issues']) {
                await page.evaluate(tab => window.lifecycle_controller.vehicle.activateVehicleTab(tab),tab);
                await inspect(tab === 'maint' ? 'vehicle' : `vehicle-${tab}`);
            }
        } else if (section === 'gym') {
            for (const tab of ['records','routine','sessions','nutrition','general-meals']) {
                await page.evaluate(tab => window.lifecycle_controller.gym.activateGymTab(tab),tab); await inspect(`gym-${tab}`);
            }
        } else if (section === 'trading') {
            await inspect('trading'); await page.getByRole('button',{name:'Saylor',exact:true}).click(); await inspect('saylor-empty');
        } else await inspect(section === 'faculty' ? 'faculty-empty' : section);
    }
    for (const tab of ['cuenta','notificaciones','alertas','preferencias','seguimientos','modulos','backup','instalacion']) {
        await page.evaluate(tab => window.lifecycle_controller.openProfileTab(tab),tab); await inspect(`profile-${tab}`);
    }
    await fs.writeFile(`.tmp-sb/audit-ui/${width}-${theme}.json`,JSON.stringify(results,null,2));
    const failures = results.filter(r => r.issues.length);
    assert.deepEqual(failures, [], `layout failures at ${width}/${theme}`);
}
module.exports = { runFullAuditSmoke, seedLegacyAudit };
