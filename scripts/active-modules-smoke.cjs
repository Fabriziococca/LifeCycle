const assert = require('node:assert/strict');
const { seedLegacyAudit } = require('./full-audit-smoke.cjs');

// All mutations and destructive scenarios run against the localhost fake cloud.
async function runActiveModulesSmoke(page) {
    assert.match(page.url(), /^http:\/\/localhost:/);
    await seedLegacyAudit(page);
    const activate = id => page.evaluate(id => window.lifecycle_controller.activateSection(id+'-section'),id);
    const confirm = async () => {
        try { await page.locator('[data-feedback-confirm]').click(); }
        catch(error) {
            await page.screenshot({path:'.tmp-sb/ui-smoke/active-modules-feedback-failure.png',animations:'disabled'});
            console.log(await page.locator('body').innerText());
            throw error;
        }
    };
    const cancel = async () => { await page.locator('[data-feedback-cancel]').click(); };

    // Tasks: blank validation, safe text, completion and recoverable removal.
    await page.locator('#global-quick-task-btn').click();
    await page.locator('#tareas-task-text').fill('   ');
    await page.evaluate(()=>window.lifecycle_controller.tareas.saveTaskCapture());
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.tareas.tasks.length),0);
    await page.locator('#tareas-task-text').fill('AUDIT <img src=x onerror="throw 1">');
    await page.evaluate(()=>window.lifecycle_controller.tareas.saveTaskCapture());
    await page.locator('#tareas-task-modal').waitFor({state:'hidden'});
    await activate('tareas');
    const taskId=await page.evaluate(()=>window.lifecycle_controller.tareas.tasks[0].id);
    await page.evaluate(id=>window.lifecycle_controller.tareas.toggleTask(id),taskId);
    assert.ok(await page.evaluate(()=>window.lifecycle_controller.tareas.tasks[0].completedAt));
    await page.evaluate(id=>window.lifecycle_controller.tareas.toggleTask(id),taskId);
    await page.evaluate(id=>window.lifecycle_controller.tareas.deleteTask(id),taskId);
    await page.getByRole('button',{name:'Deshacer',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.tareas.tasks.length),1);
    assert.equal(await page.locator('#tareas-section img[src="x"]').count(),0);
    await page.locator('#tareas-active-list .btn-view-task').click();
    await page.getByRole('dialog',{name:'Detalle de la Tarea',exact:true}).waitFor({state:'visible'});
    const detailContrast = await page.locator('#tareas-detail-text').evaluate(element => {
        const rgb = value => value.match(/[\d.]+/g).map(Number);
        const blend = (front,back) => front.slice(0,3).map((v,i)=>v*(front[3]??1)+back[i]*(1-(front[3]??1)));
        const layers=[];
        for(let node=element;node;node=node.parentElement) layers.unshift(rgb(getComputedStyle(node).backgroundColor));
        const background=layers.reduce((back,front)=>blend(front,back),[255,255,255]);
        const foreground=blend(rgb(getComputedStyle(element).color),background);
        const luminance=color=>color.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
        const a=luminance(foreground),b=luminance(background);
        return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
    });
    assert.ok(detailContrast>=4.5,`task detail contrast ${detailContrast} is unreadable`);
    await page.screenshot({path:`.tmp-sb/ui-smoke/task-detail-${page.viewportSize().width}-${await page.locator('html').getAttribute('data-theme')}.png`,animations:'disabled'});
    await page.locator('#tareas-detail-close-btn').click();

    // Lenses: cancellation preserves an active timer; finishing stores a session.
    await activate('lentes');
    await page.locator('#lenses-btnPut').click();
    await page.locator('#lenses-activeState').waitFor({state:'visible'});
    await page.locator('#lenses-btnRemove').click(); await cancel();
    assert.ok(await page.evaluate(()=>window.lifecycle_controller.lenses.startTime));
    await page.locator('#lenses-btnRemove').click(); await confirm();
    await page.locator('#lenses-idleState').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.lenses.getLensesHistory().length),1);

    // Medical study: unsafe URL rejected, record without attachment, cancelled delete.
    await activate('salud');
    const studyId=await page.evaluate(()=>window.lifecycle_controller.customTrackers.registry.trackers.find(t=>t.template==='medical-study')?.id);
    assert.ok(studyId,'legacy fixture includes the study tracker');
    await page.evaluate(id=>window.lifecycle_controller.health.openStudyForm(id),studyId);
    await page.locator('#blood-form-portal').fill('http://example.invalid');
    await page.locator('#blood-form-save').click(); await confirm();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.health.bloodTests.length),0);
    await page.locator('#blood-form-portal').fill('https://example.invalid/audit');
    await page.locator('#blood-form-save').click();
    await page.waitForFunction(()=>window.lifecycle_controller.health.bloodTests.length===1);
    const bloodId=await page.evaluate(()=>window.lifecycle_controller.health.bloodTests[0].id);
    await page.evaluate(id=>{void window.lifecycle_controller.health.deleteBloodTest(id);},bloodId); await cancel();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.health.bloodTests.length),1);
    await page.evaluate(id=>{void window.lifecycle_controller.health.deleteBloodTest(id);},bloodId); await confirm();
    await page.waitForFunction(()=>window.lifecycle_controller.health.bloodTests.length===0);
    await page.evaluate(()=>window.lifecycle_controller.health.closeStudyDialog());

    // Vehicle: service validation, mirrored catalog, documents, issue + undo.
    await activate('vehiculo');
    await page.evaluate(()=>window.lifecycle_controller.vehicle.activateVehicleTab('maint'));
    await page.locator('#btn-add-oil-service').click();
    await page.locator('#oil-form-km').fill('0');
    await page.locator('#oil-form-save').click(); await confirm();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.vehicle.maintenanceLog.length),0);
    await page.locator('#oil-form-km').fill('106000');
    await page.locator('#oil-form-save').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.vehicle.maintenanceLog.length),1);
    await page.evaluate(()=>window.lifecycle_controller.vehicle.activateVehicleTab('docs'));
    await page.locator('#doc-vtv-input').fill('2027-10-14');
    await page.locator('.btn-save-doc[data-doc="vtv"]').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.vehicle.trackerData.vtvExpDate),'2027-10-14');
    await page.evaluate(()=>window.lifecycle_controller.vehicle.activateVehicleTab('issues'));
    await page.locator('#vehicle-issue-composer summary').click();
    await page.locator('#issue-title-input').fill('AUDIT ruido de prueba');
    await page.locator('#vehicle-add-issue-form [type=submit]').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.vehicle.issues.length),1);
    await page.evaluate(()=>window.lifecycle_controller.vehicle.resolveIssue(window.lifecycle_controller.vehicle.issues[0].id));
    await page.getByRole('button',{name:'Deshacer',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.vehicle.issues.length),1);

    // Gym: PR, linked routine, active-session persistence, finish and discarded-session cancel.
    await activate('gym');
    await page.evaluate(()=>window.lifecycle_controller.gym.activateGymTab('records'));
    await page.locator('#record-exercise').fill('AUDIT Sentadilla');
    await page.locator('#record-weight').fill('80'); await page.locator('#record-reps').fill('8');
    await page.locator('#record-form [type=submit]').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.gym.records.length),1);
    await page.evaluate(()=>window.lifecycle_controller.gym.activateGymTab('routine'));
    await page.locator('.inline-add-exercise-form[data-day="Lunes"] input').fill('AUDIT Press');
    await page.locator('.inline-add-exercise-form[data-day="Lunes"] button[type=submit]').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.gym.routine.filter(x=>x.name==='AUDIT Press').length),2);
    await page.evaluate(()=>window.lifecycle_controller.gym.activateGymTab('sessions'));
    await page.locator('#start-session-day-select').selectOption('Lunes');
    await page.locator('#start-session-btn').click();
    await page.locator('.session-set-weight').first().fill('40');
    await page.locator('.session-set-reps').first().fill('10');
    await page.evaluate(()=>window.lifecycle_controller.auth.flushPendingKeySync(true));
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId);
    await activate('gym'); await page.evaluate(()=>window.lifecycle_controller.gym.activateGymTab('sessions'));
    assert.equal(await page.locator('.session-set-weight').first().inputValue(),'40');
    await page.locator('#finish-session-btn').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.gym.sessions.length),1);
    await page.locator('#start-session-btn').click();
    await page.locator('#discard-session-btn').click(); await cancel();
    assert.ok(await page.evaluate(()=>window.lifecycle_controller.gym.activeSession));
    await page.locator('#discard-session-btn').click(); await confirm();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.gym.activeSession),null);

    // Nutrition: template, copy to fixed, edit, totals, weight history.
    await page.evaluate(()=>window.lifecycle_controller.gym.activateGymTab('general-meals'));
    await page.locator('#toggle-general-form-btn').click();
    await page.locator('#general-meal-name').fill('AUDIT Comida');
    for(const [key,value] of Object.entries({qty:'1',kcal:'300',protein:'20',carbs:'30',fat:'10',sodium:'100',fiber:'3'})) await page.locator('#general-meal-'+key).fill(value);
    await page.locator('#general-meal-form [type=submit]').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.gym.generalMeals.length),1);
    await page.evaluate(()=>window.lifecycle_controller.gym.copyToFixed(window.lifecycle_controller.gym.generalMeals[0].id));
    await page.evaluate(()=>window.lifecycle_controller.gym.activateGymTab('nutrition'));
    assert.equal((await page.locator('#total-kcal').textContent()).trim(),'300');
    await page.evaluate(()=>window.lifecycle_controller.gym.editMeal('fixed',window.lifecycle_controller.gym.meals.fixed[0].id));
    await page.locator('#edit-meal-kcal').fill('350'); await page.locator('#edit-meal-save').click();
    assert.equal((await page.locator('#total-kcal').textContent()).trim(),'350');
    await page.locator('#btn-weight-log-toggle').click();
    await page.locator('#weight-log-val').fill('80.5');
    await page.locator('#weight-log-form [type=submit]').click();
    assert.equal(await page.evaluate(()=>window.lifecycle_controller.gym.weight[0].weight),80.5);
    await page.evaluate(()=>{
        const gym=window.lifecycle_controller.gym;
        gym.records.push({id:'legacy-effort',name:'Legacy effort',weight:40,reps:8,rir:'RIR 1.5'});
        gym.saveData('gym_records');
        gym.activateGymTab('records');
    });
    await page.locator('#gym-records-content').getByText('RIR: 1.5',{exact:true}).waitFor();
    await page.evaluate(()=>window.lifecycle_controller.auth.flushPendingKeySync(true));

    // Export the state produced by these UI flows, rather than only validating
    // hand-built backup fixtures. A PR used to make the whole export fail.
    await page.evaluate(()=>window.lifecycle_controller.openProfileTab('backup'));
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#btnExportUnified').click()
    ]);
    const text = await require('node:fs/promises').readFile(await download.path(),'utf8');
    const {parseAndValidateBackupText} = await import('../backup-utils.mjs');
    const plan = parseAndValidateBackupText(text);
    const records = JSON.parse(plan.entries.find(([key])=>key==='gym_records')[1]);
    assert.equal(records.length,2);
    assert.equal(records[0].rir,0);
    assert.equal(records[1].rir,1.5);
}
module.exports={runActiveModulesSmoke};
