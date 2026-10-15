const assert = require('node:assert/strict');

// Local synthetic cloud only. Includes the retired state object that newer QA
// accounts did not contain, but the owner's older account can still retain.
async function runRecoverySmoke(page, {width, theme}) {
    assert.match(page.url(), /^http:\/\/localhost:/);
    await page.evaluate(async () => {
        const app = window.lifecycle_controller;
        await app.auth.flushPendingKeySync(true);
        app.openProfileTab('backup');
    });
    await page.locator('#recovery-password').fill('synthetic-recovery-pass');
    await page.locator('#recovery-password-confirm').fill('synthetic-recovery-pass');
    await page.locator('#recovery-setup [type=submit]').click();
    await page.locator('#recovery-setup').waitFor({state:'hidden'});
    assert.match(await page.locator('#recovery-status').textContent(),/Copia cifrada local/);
    const preserved = await page.evaluate(async () => {
        const {readRecoveryVault,decryptRecoverySnapshot} = await import('/recovery-vault.mjs');
        const {parseAndValidateBackupText} = await import('/backup-utils.mjs');
        const vault = await readRecoveryVault(window.lifecycle_controller.auth.readyUserId);
        const {appName,backupVersion,exportDate,data} = await decryptRecoverySnapshot(vault,'synthetic-recovery-pass');
        return {cycle:data.hygiene_tracker_data.listerine,
            source:JSON.parse(localStorage.getItem('hygiene_tracker_data')).listerine,
            valid:parseAndValidateBackupText(JSON.stringify({appName,backupVersion,exportDate,data})).mode==='full'};
    });
    assert.deepEqual(preserved,{cycle:{status:'paused',startDate:null},source:{status:'paused',startDate:null},valid:true});
    await page.screenshot({path:`.tmp-sb/ui-smoke/recovery-legacy-${width}-${theme}.png`,fullPage:true});
    await page.getByRole('link',{name:'Abrir consulta y descargar copia cifrada',exact:true}).click();
    await page.locator('#vault-password').fill('incorrect-key');
    await page.locator('#unlock-form [type=submit]').click();
    await page.locator('#recovery-message').filter({hasText:'Clave incorrecta'}).waitFor();
    assert.equal(await page.locator('#read-view').isVisible(),false);
    await page.context().setOffline(true);
    await page.locator('#vault-password').fill('synthetic-recovery-pass');
    await page.locator('#unlock-form [type=submit]').click();
    await page.locator('#read-view').waitFor({state:'visible'});
    await page.locator('#recovery-search').fill('listerine');
    assert.equal(await page.locator('#recovery-data details').count(),1);
    assert.match(await page.locator('#recovery-data').textContent(),/paused/);
    await page.locator('#lock-vault').click();
    assert.equal(await page.locator('#read-view').isVisible(),false);
    assert.equal(await page.locator('#recovery-data').textContent(),'');
    await page.context().setOffline(false);
}
module.exports = {runRecoverySmoke};
