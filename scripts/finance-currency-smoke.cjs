const assert = require('node:assert/strict');
exports.runFinanceCurrencySmoke = async (page,{width,theme}) => {
    await page.evaluate(()=>{
        localStorage.setItem('lemon_usdt_ars_rate','1000');localStorage.setItem('lemon_usdt_ars_time',Date.now());localStorage.setItem('lemon_usdt_ars_source','criptoya-lemon');
        const app=window.lifecycle_controller;app.setPreferredCurrency('USD');app.setFinancialAmountsHidden(false);app.activateSection('finanzas-section');
    });
    const root=page.locator('#finance-workspace'),dialog=page.locator('#fw-dialog'),field=name=>dialog.locator(`[name=${name}]`);
    assert.equal(await root.locator('#fw-valuation').inputValue(),'current','new users get automatic valuation');
    await root.locator('#fw-valuation').selectOption('historical');
    const save=async()=>{await dialog.locator('[type=submit]').click();try{await dialog.waitFor({state:'hidden'});}catch(e){console.log('Currency form:',await dialog.locator('[role=alert]').textContent());throw e;}};
    for(const code of ['USD','ARS']) {
        await root.locator('[data-fw-tab=accounts]').click();await root.locator('[data-fw-action=new-account]').click();
        await field('name').fill(`QA ${code}`);await field('currency').selectOption(code);await field('opening').fill('0');await save();
    }
    const ids=await page.evaluate(()=>Object.fromEntries(window.lifecycle_controller.finanzas.data.workspace.accounts.map(a=>[a.currency,a.id])));
    for(const [code,amount] of [['USD','1000'],['ARS','500000']]) {
        await root.locator('[data-fw-action=new-movement]').click();await field('type').selectOption('income');await field('description').fill(`Cobro QA ${code}`);await field('category').fill('freelance');await field('currency').selectOption(code);await field('amount').fill(amount);await field('rate').fill('1000');await field('accountId').selectOption(ids[code]);await save();
    }
    await root.locator('[data-fw-tab=summary]').click();
    const income=root.locator('.fw-income');assert.match(await income.innerText(),/1\.500,00/);
    assert.match(await income.innerText(),/500\.000,00/);
    await root.locator('#fw-currency').selectOption('ARS');assert.match(await income.innerText(),/1\.500\.000,00/);
    await page.evaluate(()=>{localStorage.setItem('lemon_usdt_ars_rate','1800');window.lifecycle_controller.refreshFinancialViews();});
    assert.match(await income.innerText(),/1\.500\.000,00/,'historical ARS total drifted');
    await root.locator('#fw-valuation').selectOption('current');
    assert.match(await income.innerText(),/2\.300\.000,00/);
    await root.locator('#fw-currency').selectOption('USD');assert.match(await income.locator('strong').innerText(),/1\.277,78/);
    await root.locator('#fw-valuation').selectOption('historical');
    await root.locator('#fw-currency').selectOption('USD');
    assert.match(await root.locator('.fw-current-balance .fw-balance').innerText(),/1\.277,78/);
    await root.locator('#fw-original').selectOption('ARS');assert.match(await income.innerText(),/500,00/);assert.doesNotMatch(await income.innerText(),/1\.500,00/);
    await root.locator('#fw-original').selectOption('all');
    await root.locator('[data-fw-tab=accounts]').click();await root.locator('[data-fw-action=transfer]').click();
    await field('fromId').selectOption(ids.ARS);await field('toId').selectOption(ids.USD);await field('amount').fill('500000');await field('receivedAmount').fill('500');await save();
    await root.locator('[data-fw-tab=summary]').click();assert.match(await income.innerText(),/1\.500,00/);
    assert.match(await root.locator('.fw-current-balance .fw-balance').innerText(),/1\.500,00/);
    await page.evaluate(()=>{const f=window.lifecycle_controller.finanzas;f.data.entries.push({id:'old-qa',date:f.data.entries[0].date,amount:100,description:'Original desconocida QA',category:'otros'});f.saveData();f.render();});
    await root.locator('#fw-currency').selectOption('ARS');await root.getByText('El total en ARS está incompleto.',{exact:false}).waitFor();
    await root.locator('#fw-original').selectOption('unknown');
    assert.match(await income.locator('strong').innerText(),/100,00 eq\./,'unknown ARS history must not look like zero income');
    const unchanged=await page.evaluate(()=>JSON.stringify(window.lifecycle_controller.finanzas.data));
    await root.locator('#fw-valuation').selectOption('current');
    assert.match(await income.locator('strong').innerText(),/180\.000,00/,'legacy income converts automatically without entering a receipt rate');
    assert.match(await income.innerText(),/original no registrada/);
    assert.match(await root.locator('#fw-report-note').innerText(),/Lemon vía CriptoYa/);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.lifecycle_controller.finanzas.data)),unchanged);
    await page.reload();await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId);
    await page.evaluate(()=>window.lifecycle_controller.activateSection('finanzas-section'));
    assert.equal(await root.locator('#fw-valuation').inputValue(),'current');
    await root.locator('#fw-valuation').selectOption('historical');
    await root.locator('#fw-original').selectOption('all');
    await root.locator('[data-fw-tab=movements]').click();await root.locator('#fw-original').selectOption('unknown');
    assert.equal(await root.locator('.fw-movement').count(),1);
    await root.locator('[data-fw-action=receipt]').click();assert.equal(await field('currency').inputValue(),'unknown');await field('rate').fill('1000');await save();
    const snapshot=await page.evaluate(async()=>{
        const {createBackupPayload,parseAndValidateBackupText}=await import('/backup-utils.mjs');
        const payload=createBackupPayload(key=>localStorage.getItem(key));parseAndValidateBackupText(JSON.stringify(payload));
        const f=window.lifecycle_controller.finanzas;
        return {entries:f.data.entries.length,expenses:f.data.expenses.length,transfers:f.data.workspace.transfers.length,legacyNative:f.data.entries.find(e=>e.id==='old-qa').nativeCurrency};
    });
    assert.deepEqual(snapshot,{entries:3,expenses:0,transfers:1,legacyNative:undefined});
    await root.locator('#fw-original').selectOption('all');await root.locator('#fw-currency').selectOption('USD');await root.locator('[data-fw-tab=summary]').click();
    await page.screenshot({path:`.tmp-sb/ui-smoke/finance-currency-${width}-${theme}.png`,fullPage:true});
    await page.reload();await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId);
    await page.evaluate(()=>window.lifecycle_controller.activateSection('finanzas-section'));
    assert.match(await income.innerText(),/1\.600,00/);
    await page.evaluate(()=>{
        const app=window.lifecycle_controller;
        app.projects.projects=[{id:'qa-fx-project',client:'Cliente QA',project:'Cobros con moneda original',accepted:new Date().toISOString(),deadline:'2030-10-20T23:00:00-03:00',budgetGross:200,budgetNet:200,partialReleases:[]}];
        app.projects.saveData();app.projects.render();app.activateSection('projects-section');
    });
    const project=page.locator('[data-project-id="qa-fx-project"]');
    await project.getByRole('button',{name:'Más opciones',exact:true}).click();await project.locator('.btn-partial-release').click();
    await page.locator('#proj-partial-pct').fill('50');await page.locator('#proj-partial-save').click();
    const receiptDialog=page.locator('#financial-receipt-dialog');
    await receiptDialog.locator('[name=currency]').selectOption('ARS');await receiptDialog.locator('[name=rate]').fill('1000');await receiptDialog.locator('[name=accountId]').selectOption(ids.ARS);
    await receiptDialog.getByRole('button',{name:'Confirmar cobro',exact:true}).click();
    await project.locator('.partial-release-badge').waitFor();
    await project.locator('.btn-deliver').click();await project.locator('.btn-confirm').click();
    await receiptDialog.locator('[name=rate]').fill('1000');await receiptDialog.locator('[name=accountId]').selectOption(ids.USD);
    await receiptDialog.getByRole('button',{name:'Confirmar cobro',exact:true}).click();await project.waitFor({state:'hidden'});
    const projectReceipts=await page.evaluate(async()=>{
        const app=window.lifecycle_controller, rows=app.finanzas.getCombinedEntries().filter(e=>e.projectId==='qa-fx-project');
        const {createBackupPayload,parseAndValidateBackupText}=await import('/backup-utils.mjs');parseAndValidateBackupText(JSON.stringify(createBackupPayload(k=>localStorage.getItem(k))));
        return rows.map(r=>({currency:r.nativeCurrency,amount:r.nativeAmountMinor,rate:r.valuationRate||r.exchangeRate}));
    });
    assert.deepEqual(projectReceipts,[{currency:'ARS',amount:10000000,rate:1000},{currency:'USD',amount:10000,rate:1000}]);
    await page.evaluate(()=>window.lifecycle_controller.activateSection('finanzas-section'));
    assert.match(await income.innerText(),/1\.800,00/);
    await root.locator('#fw-valuation').selectOption('current');
    assert.match(await income.locator('strong').innerText(),/1\.533,33/);
    await page.evaluate(()=>window.lifecycle_controller.activateSection('projects-section'));
    assert.match(await page.locator('#monthUSD').innerText(),/155,56/);
    assert.match(await page.locator('#projects-valuation-note').innerText(),/automáticamente/);
    await page.evaluate(()=>window.lifecycle_controller.activateSection('finanzas-section'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    console.log(JSON.stringify({currency:true,width,theme,frozenHistory:true,nativeSplit:true,currentValue:true,automaticLegacy:true,sharedProjectView:true,optionalExchangeNoIncome:true,legacyPreserved:true,backup:true,reload:true,projectPartialAndFinal:true}));
};
