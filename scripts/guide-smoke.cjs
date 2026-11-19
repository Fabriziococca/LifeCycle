const assert = require('node:assert/strict');

exports.runGuideSmoke = async function(page, width) {
    const guide = () => page.getByRole('button',{name:'Guía · ¿Dónde hago esto?'});
    if (width < 500) await page.locator('.adaptive-nav-more').click();
    else await page.locator('#global-search-btn').click();
    await guide().click();
    assert.equal(await page.getByRole('option').count(),7);
    const steps = page.getByRole('option',{name:/Cobrar un mantenimiento/}).locator('.global-search-result-copy span');
    assert.equal(await steps.evaluate(el => el.scrollWidth <= el.clientWidth + 1),true);
    if (width < 500) await page.screenshot({path:'.tmp-sb/ui-smoke/guide-mobile.png',animations:'disabled'});
    await page.getByRole('option',{name:/Crear un turno/}).click();
    await page.getByRole('button',{name:'Nuevo turno'}).waitFor({state:'visible'});
    async function search(text, title) {
        await page.locator('#global-search-btn').click();
        await page.locator('#global-search-input').fill(text);
        await page.getByRole('option',{name:title}).click();
    }
    await search('cobrar mantenimiento', /Cobrar un mantenimiento/);
    const clients = page.locator('#work-clients-section');
    await clients.getByRole('button',{name:'Nuevo cliente'}).click();
    await page.locator('#planning-dialog [name=name]').fill('Guía QA');
    await page.locator('#planning-dialog [type=submit]').click();
    await page.locator('#planning-dialog').waitFor({state:'hidden'});
    // The same guide intent works for an empty directory and an existing client.
    await search('registrar revisión', /Registrar una revisión/);
    const open = clients.getByRole('button',{name:'Abrir ficha'});
    if (await open.count()) await open.click();
    await clients.locator('[data-work-action="client-tab"][data-id="reminders"][aria-pressed="true"]').waitFor();
    await search('servicio del cliente', /Agregar un servicio/);
    await clients.getByRole('button',{name:'Nueva suscripción'}).waitFor();
    await search('cobrar mantenimiento', /Cobrar un mantenimiento/);
    await clients.locator('[data-work-action="client-tab"][data-id="retainers"][aria-pressed="true"]').waitFor();
    await search('calorías', /Editar una comida/);
    assert.equal(await page.locator('#gym-section [data-gym-tab="nutrition"]').evaluate(e => e.classList.contains('active')), true);
    await search('anotar tarea', /Anotar una tarea/);
    await page.locator('#tareas-task-cancel').click();
    await search('dispositivos', /Ver mis dispositivos/);
    await page.locator('#tab-notificaciones').waitFor();
};
