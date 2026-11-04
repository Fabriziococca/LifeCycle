const assert=require('node:assert/strict');
exports.runClientSubscriptionsSmoke=async(page,{width,theme})=>{
 assert.match(page.url(),/^http:\/\/localhost:/,'Fixtures are restricted to the local fake cloud');
 await page.waitForFunction(()=>window.lifecycle_controller.work.store.state);
 await page.evaluate(()=>window.lifecycle_controller.activateSection('work-clients-section'));
 const section=page.locator('#work-clients-section'),dialog=page.locator('#planning-dialog'),modal=page.locator('#subscription-modal');
 await section.locator('[data-work-action=client]').click();await dialog.locator('[name=name]').fill('QA Suscripciones 01/11');await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'hidden'});
 await section.locator('[data-work-action=client-tab][data-id=subscriptions]').click();
 for(const [name,date,time] of [['QA Webshare','2026-11-04','17:47'],['QA ngrok','2026-11-29','21:00']]){
  await section.locator('[data-work-action=subscription-new]').click();
  assert.equal(await modal.locator('#sub-billing-mode').inputValue(),'tracking');assert.equal(await modal.locator('#sub-period').inputValue(),'days');assert.equal(await modal.locator('#sub-alert-mode').inputValue(),'progressive');
  assert.equal(await modal.locator('#sub-auto-record-expense').isEnabled(),false);assert.equal(await modal.locator('#sub-cost').isVisible(),true);
  await modal.locator('#sub-name').fill(name);await modal.locator('#sub-renewal-date').fill(date);await modal.locator('#sub-renewal-time').fill(time);await modal.locator('#sub-alert-enabled').uncheck();
  await modal.locator('#sub-cost').fill(name.includes('Webshare')?'20':'25');
  await modal.locator('[type=submit]').click();await modal.waitFor({state:'hidden'});
 }
 assert.equal(await section.locator('.subscription-card').count(),2);
 const snapshot=await page.evaluate(()=>{const a=window.lifecycle_controller;const subs=a.subscriptions.subscriptions.filter(s=>s.name.startsWith('QA '));return {subs,expenses:a.finanzas.data.expenses,client:a.work.clientId};});
 assert.equal(snapshot.subs.length,2);for(const sub of snapshot.subs){assert.equal(sub.clientId,snapshot.client);assert.equal(sub.periodDays,30);assert.equal(sub.autoRecordExpense,false);assert.deepEqual(sub.alert.noticeDays,[7,5,3,2,1,0]);}
 assert.match(await section.innerText(),/La paga el cliente/);
 assert.equal(await section.locator('[data-subscription-action=expense],[data-subscription-action=convert-paid]').count(),0);
 const blocked=await page.evaluate(async()=>{const app=window.lifecycle_controller,s=app.subscriptions.subscriptions.find(s=>s.clientId);return {card:await app.subscriptions.recordExpense(s.id),finance:(await app.finanzas.recordSubscriptionExpense({subscriptionId:s.id,amount:20,currency:'USD'})).created};});
 assert.deepEqual(blocked,{card:false,finance:false});
 const card=section.locator('.subscription-card').filter({hasText:'QA Webshare'});await card.locator('[data-subscription-action=edit]').click();assert.equal(await modal.locator('#sub-renewal-time').inputValue(),'17:47');
 const overflow=await modal.locator('.modal-content').evaluate(el=>el.scrollWidth>el.clientWidth+2);assert.equal(overflow,false);
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.evaluate(()=>window.lifecycle_controller.activateSection('suscripciones-section'));
 assert.equal(await page.locator('#subscriptions-list').innerText().then(t=>t.includes('QA Webshare')),false,'client subscriptions stay separate from own subscriptions');
 await page.locator('#btn-new-subscription').click();await modal.locator('#sub-name').fill('QA Propia');await modal.locator('#sub-cost').fill('10');await modal.locator('#sub-renewal-date').fill('2099-01-01');await modal.locator('#sub-alert-enabled').uncheck();await modal.locator('[type=submit]').click();await modal.waitFor({state:'hidden'});
 assert.equal(await page.locator('#subs-summary-monthly-usd').innerText(),'$10.00 USD');assert.equal(await page.locator('#subscriptions-list [data-subscription-action=expense]').count(),1);
 await page.locator('#sub-client-scope').selectOption('clients');assert.equal(await page.locator('#subscriptions-list .subscription-card').count(),2);
 assert.equal(await page.locator('#subs-summary-monthly-usd').innerText(),'$45.00 USD');assert.match(await page.locator('#subs-summary-usd-label').innerText(),/Costo mensual de clientes/);
 await page.locator('#sub-client-scope').selectOption('all');assert.equal(await page.locator('#subs-summary-monthly-usd').innerText(),'$10.00 USD');assert.match(await page.locator('#subs-summary-scope-note').innerText(),/45\.00/);
 await page.evaluate(()=>window.lifecycle_controller.auth.flushPendingKeySync(true));await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.lifecycle_controller.work.store.state);await page.evaluate(()=>window.lifecycle_controller.activateSection('work-clients-section'));await section.locator('[data-work-action=detail]').click();await section.locator('[data-work-action=client-tab][data-id=subscriptions]').click();
 assert.equal(await section.locator('.subscription-card').count(),2);assert.deepEqual(await page.evaluate(()=>window.lifecycle_controller.finanzas.data.expenses),snapshot.expenses);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await page.screenshot({path:`.tmp-sb/ui-smoke/client-subscriptions-${width}-${theme}.png`,fullPage:false});
};
