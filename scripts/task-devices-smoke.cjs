const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { chromium } = require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE || 'playwright');
const { installFakeCloud } = require('./qa-cloud.cjs');

async function run() {
    let revision = 1, staleWrites = 0, release;
    const shared = {}, waitForPeer = new Promise(resolve => { release = resolve; });
    let reads = 0, overlap = false;
    async function request(name, params) {
        if (name === 'read') {
            const data = { revision, data:structuredClone(shared) };
            if (params.includes('tasks:data') && overlap) {
                if (++reads === 2) { overlap = false; release(); }
                await waitForPeer;
            }
            return { data };
        }
        if (name === 'merge_user_data_at_revision' && params.p_expected_revision !== revision) {
            staleWrites++;
            return { error:{ code:'40001' } };
        }
        const { __task_revision, ...updates } = params.p_updates;
        if (Object.hasOwn(updates,'tareas_list')) assert.equal(__task_revision, revision);
        Object.assign(shared, updates);
        for (const key of params.p_delete_keys) delete shared[key];
        return { data:{ revision:++revision } };
    }
    const server = express().use(express.static(path.resolve(__dirname,'..'))).listen(0,'127.0.0.1');
    const browser = await chromium.launch({channel:'chrome',headless:true});
    try {
        async function device(width) {
            const context = await browser.newContext({viewport:{width,height:800},isMobile:width<500,hasTouch:width<500,serviceWorkers:'block'});
            await context.exposeFunction('qaSharedDocument',request);
            await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({
                contentType:'application/javascript',body:'('+installFakeCloud.toString()+')();'
            }));
            await context.route('**/api/**',route=>route.fulfill({json:route.request().url().endsWith('/api/config')
                ? {supabaseUrl:'https://qa.invalid',supabaseAnonKey:'qa'} : {devices:[],events:[],deliveries:[],entries:[],engine:{}}}));
            const page = await context.newPage();
            await page.goto('http://localhost:'+server.address().port);
            await page.waitForFunction(()=>window.lifecycle_controller?.auth.readyUserId);
            return page;
        }
        const pages = await Promise.all([device(1440),device(390)]);
        const flush = page => page.evaluate(()=>window.lifecycle_controller.auth.flushPendingKeySync(true));
        const pull = page => page.evaluate(()=>window.lifecycle_controller.auth.checkAndSyncData({force:true}));
        async function add(page, text) {
            await page.locator('#global-quick-task-btn').click();
            await page.locator('#tareas-task-text').fill(text);
            await page.locator('#tareas-task-save').click();
            assert.equal(await flush(page),true);
        }
        overlap=true;
        await Promise.all(pages.map((page,i)=>add(page,i?'Teléfono QA':'PC QA')));
        assert.ok(staleWrites >= 1);
        for (const page of pages) {
            await pull(page);
            assert.deepEqual(await page.evaluate(()=>window.lifecycle_controller.tareas.tasks.map(t=>t.text).sort()), ['PC QA','Teléfono QA']);
        }
        await pages[0].evaluate(()=>{const t=window.lifecycle_controller.tareas;t.deleteTask(t.tasks.find(x=>x.text==='PC QA').id);});
        await flush(pages[0]);
        await pages[1].evaluate(()=>{const t=window.lifecycle_controller.tareas;t.tasks.find(x=>x.text==='Teléfono QA').text='Editada';t.saveData();});
        await flush(pages[1]);
        for (const page of pages) {
            await page.reload();
            await page.waitForFunction(()=>window.lifecycle_controller?.auth.readyUserId);
            assert.deepEqual(await page.evaluate(()=>window.lifecycle_controller.tareas.tasks.map(t=>t.text)), ['Editada']);
        }
        console.log('OK: PC and phone captured from one revision, retried, edited, deleted and reloaded in independent browsers.');
    } finally { await browser.close(); server.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
