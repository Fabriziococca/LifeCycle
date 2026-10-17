const assert=require('node:assert/strict');
exports.runChargingSmoke=async(page,{width,theme})=>{
 await page.evaluate(()=>{const a=window.lifecycle_controller;a.hygiene.currentCategory='tecnologia';a.activateSection('higiene-section');a.hygiene.render();});
 const root=page.locator('#charging-root'),dialog=page.locator('#planning-dialog'),field=n=>dialog.locator(`[name="${n}"]`);
 const save=async()=>{await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'hidden'});};
 await root.locator('[data-charge-action=edit]').click();await field('name').fill('Voltra QA <texto>');await field('minutes').fill('180');await save();
 let card=root.locator('[data-charging-id]').first();await card.locator('[data-charge-action=start]').click();await card.getByText('Cargando',{exact:true}).waitFor();
 const original=await page.evaluate(()=>window.lifecycle_controller.charging.store.value.devices[0]);assert.equal(original.sessions.length,1);
 await card.locator('[data-charge-action=edit]').click();await field('minutes').fill('1');await save();
 assert.equal(await page.evaluate(()=>window.lifecycle_controller.charging.store.value.devices[0].sessions[0].limitMinutes),180);
 await card.locator('[data-charge-action=pause]').click();await card.getByText(/Avisos pausados/).waitFor();
 await card.locator('[data-charge-action=pause]').click();await card.locator('[data-charge-action=stop]').click();await card.getByText('Sin carga en curso',{exact:true}).waitFor();
 await card.locator('[data-charge-action=history]').click();await dialog.getByText(/Desconectado:/).waitFor();await dialog.locator('[data-close]').first().click();
 await card.locator('[data-charge-action=archive]').click();await page.locator('#app-feedback-dialog [data-feedback-confirm]').click();await root.locator('[name=charging-view]').selectOption('archived');
 await card.locator('[data-charge-action=archive]').click();await page.locator('#app-feedback-dialog [data-feedback-confirm]').click();await root.locator('[name=charging-view]').selectOption('trash');
 await card.locator('[data-charge-action=restore]').click();await root.locator('[name=charging-view]').selectOption('active');
 await root.locator('header [data-charge-action=edit]').click();await field('name').fill('Raqueta QA');await field('minutes').fill('');await save();
 const racket=root.locator('[data-charging-id]').filter({has:page.getByRole('heading',{name:'Raqueta QA',exact:true})});await racket.locator('[data-charge-action=start]').click();await racket.getByText(/Sin plazo configurado/).waitFor();
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId&&window.lifecycle_controller.charging.store.value.devices.length===2);
 await page.evaluate(()=>window.lifecycle_controller.activateSection('higiene-section'));assert.equal(await root.locator('[data-charging-id]').count(),2);
 assert.equal(await page.evaluate(()=>window.lifecycle_controller.charging.store.value.devices[0].sessions.length),1);
 const backup=await page.evaluate(async()=>{const a=window.lifecycle_controller,s=await a.work.store.backupSnapshot(),u=await import('/backup-utils.mjs');return u.createBackupPayload(k=>s[k]??null);});
 await page.evaluate(async b=>{const a=window.lifecycle_controller,u=await import('/backup-utils.mjs');await a.work.store.restore(u.parseAndValidateBackupText(JSON.stringify(b)));},backup);
 assert.equal(await page.evaluate(()=>window.lifecycle_controller.charging.store.value.devices[1].paused),true);
 delete backup.data.lifecycle_charging;
 await page.evaluate(async b=>{const a=window.lifecycle_controller,u=await import('/backup-utils.mjs');await a.work.store.restore(u.parseAndValidateBackupText(JSON.stringify(b)));},backup);
 assert.equal(await page.evaluate(()=>window.lifecycle_controller.charging.store.value.devices[1].sessions.length),1);
 // Create a due session only in the isolated local fake cloud; real QA never
 // receives synthetic dates through runtime evaluation.
 await page.evaluate(async()=>{const a=window.lifecycle_controller,d=a.charging.store.value;d.devices[0].sessions.push({id:'cs_due-local-test',startedAt:new Date(Date.now()-120000).toISOString(),finishedAt:null,limitMinutes:1});await a.charging.store.save(d,d.revision);});
 await root.getByText('Revisar y desconectar',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>window.lifecycle_controller.notificationsCenter.getOverdueItems().some(x=>x.module==='charging')));
 await page.locator('#tabs-container [data-category=dormitorio_bano]').click();assert.equal(await root.isVisible(),false);
 await page.locator('#tabs-container [data-category=tecnologia]').click();await root.waitFor({state:'visible'});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
 await page.screenshot({path:`.tmp-sb/ui-smoke/${width}-${theme}-charging.png`,fullPage:true,animations:'disabled'});
 await page.evaluate(async()=>{const a=window.lifecycle_controller;await a.auth.supabase.auth.signOut();});
 await page.waitForFunction(()=>!window.lifecycle_controller.auth.readyUserId);assert.equal(await page.evaluate(()=>localStorage.getItem('lifecycle_charging')),null);
};
