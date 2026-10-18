const assert=require('node:assert/strict');
exports.runSchedulesRenewalsSmoke=async(page,{width,theme})=>{
 assert.match(page.url(),/^http:\/\/localhost:/);
 await page.evaluate(()=>window.lifecycle_controller.activateSection('trading-section'));
 await page.locator('#btnAddTradingEvent').click();
 await page.locator('#trading-event-company').fill('QA Horarios');
 await page.locator('#trading-event-name').fill('Balance QA');
 await page.locator('#trading-event-date').fill('2030-11-20');
 await page.locator('#trading-event-time').fill('18:00');
 await page.locator('#trading-event-notice-days').fill('7, 1');
 const editor=page.locator('#trading-event-notice-times');
 await editor.locator('.btn-add-time').click();
 assert.equal(await editor.locator('input[type=time]').count(),2);
 await editor.locator('input[type=time]').nth(1).fill('09:00');
 await page.locator('#trading-event-name').click();
 assert.equal(await editor.locator('input[type=time]').count(),1,'duplicate hours must collapse');
 for(let i=1;i<6;i++)await editor.locator('.btn-add-time').click();
 assert.equal(await editor.locator('input[type=time]').count(),6);
 assert.equal(await editor.locator('.btn-add-time').count(),0);
 await editor.locator('.btn-remove-time').last().click();
 assert.equal(await editor.locator('input[type=time]').count(),5);
 const times=await editor.locator('input[type=time]').evaluateAll(inputs=>inputs.map(e=>e.value));
 await page.locator('#trading-event-form [type=submit]').click();
 await page.locator('#trading-event-modal').waitFor({state:'hidden'});
 await page.evaluate(()=>window.lifecycle_controller.auth.flushPendingKeySync(true));
 let saved=await page.evaluate(()=>window.lifecycle_controller.trading.events.find(e=>e.company==='QA Horarios'));
 assert.deepEqual(saved.noticeTimes,times);
 const card=page.locator('#trading-events-list .trading-event-card').filter({hasText:'QA Horarios'});
 await card.locator('[data-trading-action=edit]').click();
 assert.deepEqual(await editor.locator('input[type=time]').evaluateAll(inputs=>inputs.map(e=>e.value)),times);
 await page.locator('#trading-event-modal').press('Escape');
 await card.locator('[data-trading-action=toggle]').click();
 assert.equal(await card.locator('.trading-event-status').innerText(),'Pausado');
 await page.evaluate(()=>window.lifecycle_controller.auth.flushPendingKeySync(true));
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId);
 await page.evaluate(()=>window.lifecycle_controller.activateSection('trading-section'));
 saved=await page.evaluate(()=>window.lifecycle_controller.trading.events.find(e=>e.company==='QA Horarios'));
 assert.deepEqual(saved.noticeTimes,times);assert.equal(saved.status,'paused');
 assert.equal(await page.evaluate(()=>typeof window.lifecycle_controller.subscriptions.processDueAutomaticRenewals),'undefined');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await page.screenshot({path:`.tmp-sb/ui-smoke/${width}-${theme}-trading-times.png`,fullPage:false});
 for(const legacy of [false,true]){
  await page.evaluate(async legacy=>{
   const a=window.lifecycle_controller;await a.auth.flushPendingKeySync(true);
   const {normalizeSubscription}=await import('/subscription-utils.mjs');
   const {financialBaseKey}=await import('/financial-sync-utils.mjs');
   const {SYNC_PENDING_STORAGE_KEY}=await import('/sync-config.mjs');
   const before=a.auth.gatherLocalData();
   const finance=JSON.parse(before.finanzasData||'{}');finance.expenses=finance.expenses||[];
   const registry=JSON.parse(before.lifecycle_subscriptions||'{"version":3,"subscriptions":[]}');
   const id='sub_reopen_'+(legacy?'legacy':'base');
   registry.subscriptions.push(normalizeSubscription({id,name:'QA reapertura '+legacy,cost:1,nextRenewalDate:'2026-10-18',autoRecordExpense:true,alert:{enabled:false}}));
   before.finanzasData=JSON.stringify(finance);before.lifecycle_subscriptions=JSON.stringify(registry);
   a.auth.restoreDataLocally(before);a.auth.rememberFinancialSnapshot(before);
   if(legacy)localStorage.removeItem(financialBaseKey(a.auth.user.id));
   // A real old browser can close with only the dirty key names persisted.
   localStorage.setItem(SYNC_PENDING_STORAGE_KEY,JSON.stringify(['finanzasData','lifecycle_subscriptions']));
   const after=structuredClone(before),key='subscription:'+id+':renewal:2026-10-18';
   finance.expenses.push({id:'expense_'+id,amount:1,category:'servicios',date:'2026-10-18',description:'QA servidor',subscriptionId:id,subscriptionOccurrenceKey:key,autoRecorded:true});
   const sub=registry.subscriptions.find(s=>s.id===id);sub.nextRenewalDate='2026-11-18';sub.lastExpenseRecordedPeriod=key;
   sub.history.push({id:'history_'+id,type:'expense-recorded',occurredAt:'2026-10-18T12:00:00Z',effectiveDate:'2026-10-18',occurrenceKey:key,cost:1,currency:'USD'});
   after.finanzasData=JSON.stringify(finance);after.lifecycle_subscriptions=JSON.stringify(registry);
   sessionStorage.setItem('qa-cloud-document',JSON.stringify(after));
  },legacy);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId);
  const result=await page.evaluate(legacy=>{
   const a=window.lifecycle_controller,id='sub_reopen_'+(legacy?'legacy':'base');
   return {expense:a.finanzas.data.expenses.some(e=>e.subscriptionId===id),date:a.subscriptions.subscriptions.find(s=>s.id===id)?.nextRenewalDate,
    remoteExpense:JSON.parse(window.qaCloudDocument().finanzasData).expenses.some(e=>e.subscriptionId===id)};
  },legacy);
  assert.deepEqual(result,{expense:true,date:'2026-11-18',remoteExpense:true});
 }
};
