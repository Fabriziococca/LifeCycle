const assert = require('node:assert/strict');

exports.runTodayActionsSmoke = async function (page) {
    const hoy = page.locator('#hoy-section');
    const clients = page.locator('#work-clients-section');
    const dialog = page.locator('#planning-dialog');
    const actions = ['new_client_followup', 'open_nutrition'];
    const tile = id => hoy.locator(`[data-quick-action-id="${id}"]`);
    const toggle = id => page.locator(`[data-today-preference-action][data-quick-action-id="${id}"]`);
    const openToday = () => page.evaluate(() => window.lifecycle_controller.activateSection('hoy-section'));
    const workState = () => page.evaluate(() => window.lifecycle_controller.work.store.value);
    await openToday();
    for (const id of actions) assert.equal(await tile(id).count(), 0);
    await hoy.getByRole('button', { name: 'Personalizar' }).click();
    for (const id of actions) await toggle(id).click();
    await page.waitForFunction(() => window.qaCloudDocument().hygiene_tracker_data?.includes('open_nutrition'));
    await page.reload();
    await page.waitForFunction(() => window.lifecycle_controller?.auth?.readyUserId);
    await openToday();
    await tile('open_nutrition').click();
    await page.locator('#gym-section [data-gym-tab="nutrition"].active').waitFor();
    await openToday();
    await tile('new_client_followup').click();
    await page.getByText('Agregá un cliente activo en Trabajo → Clientes para anotar un pendiente.', {exact:true}).waitFor();
    assert.equal(await dialog.count(), 0);

    // Seed the isolated cloud with two identically named routines and two pending bills.
    const fixtures = await page.evaluate(async () => {
        const store = window.lifecycle_controller.work.store;
        const state = store.value;
        const fixtures = [];
        for (const name of ['Cliente A', 'Cliente B']) {
            const clientId = crypto.randomUUID(), routineId = crypto.randomUUID(), billId = crypto.randomUUID();
            state.clients.push({ id:clientId, name, archived:false, retainers:[{
                id:billId, version:1, scheduleVersion:1, title:'Abono de prueba', tasks:'', amountMinor:100,
                currency:'USD', billingDay:1, nextDue:'2020-01-01', paused:false, archived:false,
                reminderEnabled:false, times:['12:00'], projectIds:[], payments:[]
            }] });
            state.followups.push({ id:routineId, clientId, title:'Revisión de prueba', actor:'me', status:'open',
                priority:'normal', reviewOn:'2020-01-04', reminderEnabled:false, reminderTime:'12:00',
                maintenance:{version:1, scheduleVersion:1, instructions:'', times:['12:00'], paused:false,
                    archived:false, history:[], repeatUntilDone:true, escalationDays:3,
                    cadence:{type:'interval', every:3, unit:'days', anchor:'completion', anchorDate:'2020-01-01'}}
            });
            fixtures.push({ name, clientId, routineId, billId });
        }
        await store.save(state);
        return fixtures;
    });
    const [first, second] = fixtures;
    const initial = await workState();
    for (const [title, tab, cardId] of [
        ['Revisión de prueba', 'reminders', 'maintenance-' + second.routineId],
        ['Abono de prueba', 'retainers', 'retainer-' + second.billId]
    ]) {
        await page.evaluate(async id => { await window.lifecycle_controller.work.action('detail', id); }, first.clientId);
        await clients.locator('[data-work-action="client-tab"][data-id="history"]').click();
        await openToday();
        await hoy.locator('.today-item').filter({hasText:title}).filter({hasText:second.name}).getByRole('button',{name:'Abrir'}).click();
        await clients.locator(`[data-id="${tab}"][aria-pressed="true"]`).waitFor();
        await clients.locator(`[id="${cardId}"].highlight-target-pulse`).waitFor();
    }
    assert.deepEqual(await workState(), initial);
    await openToday();
    await tile('new_client_followup').click();
    const select = dialog.locator('[name=clientId]');
    assert.equal(await select.inputValue(), '');
    await dialog.locator('[name=title]').fill('Pendiente de prueba');
    await dialog.getByRole('button', {name:'Guardar'}).click();
    assert.equal(await select.evaluate(el => el.validity.valueMissing), true);
    await dialog.getByRole('button', {name:'Cancelar'}).click();
    assert.deepEqual(await workState(), initial);
    await tile('new_client_followup').click();
    await select.selectOption(second.clientId);
    await dialog.locator('[name=title]').fill('Pendiente de prueba');
    await dialog.getByRole('button', {name:'Guardar'}).click();
    await dialog.waitFor({state:'hidden'});
    assert.equal(await tile('new_client_followup').evaluate(el => el === document.activeElement), true);
    const saved = (await workState()).followups.filter(f => f.title === 'Pendiente de prueba');
    assert.deepEqual(saved.map(f => f.clientId), [second.clientId]);
    await hoy.getByRole('button', {name:'Personalizar'}).click();
    for (const id of actions) await toggle(id).click();
    await openToday();
    for (const id of actions) assert.equal(await tile(id).count(), 0);
};
