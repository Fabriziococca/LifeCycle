const assert=require('node:assert/strict');
exports.runProjectHistoryLayoutSmoke=async(page,{width,theme})=>{
    assert.match(page.url(),/^http:\/\/localhost:/,'Layout fixtures are restricted to the local fake cloud.');
    const before=await page.evaluate(()=>{
        const app=window.lifecycle_controller;
        app.setFinancialAmountsHidden(false);app.activateSection('projects-section');
        window.qaOriginalAverages=app.projects.calculateAverages;
        app.projects.calculateAverages=()=>({historical:723.57,last6:865.26,last3:967.33});
        return JSON.stringify({projects:app.projects.projects,history:app.projects.history});
    });
    const modal=page.locator('#projects-history-modal');
    const fits=async()=>{
        const violations=await modal.locator('#proj-averages-container strong').evaluateAll(values=>values.flatMap(value=>{
            const cell=value.parentElement.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(value);
            return [...range.getClientRects()].filter(r=>r.left<cell.left-1||r.right>cell.right+1||r.top<cell.top-1||r.bottom>cell.bottom+1).map(()=>value.id);
        }));
        assert.deepEqual(violations,[],`Average text must stay inside its own cell at ${width}/${theme}`);
        assert.equal(await modal.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'History must not overflow horizontally');
    };
    for(const button of ['btnOpenHistory','btnOpenMonthDetails','btnOpenYearDetails']){
        await page.locator('#'+button).click();await fits();
        await modal.locator('#proj-close-history-modal').click();
    }
    await page.evaluate(()=>{window.lifecycle_controller.projects.calculateAverages=()=>({historical:123456789012345.67,last6:9999999999999.99,last3:98765432109876.54});});
    await page.locator('#btnOpenHistory').click();await fits();
    await page.evaluate(()=>{const app=window.lifecycle_controller;app.setFinancialAmountsHidden(true);app.projects.renderMonthlyHistory('all');});
    for(const value of await modal.locator('#proj-averages-container strong').allTextContents())assert.equal(value,'••••••');
    await fits();
    await page.evaluate(()=>{const app=window.lifecycle_controller;app.setFinancialAmountsHidden(false);app.projects.calculateAverages=()=>({historical:723.57,last6:865.26,last3:967.33});app.projects.renderMonthlyHistory('all');});
    await page.screenshot({path:`.tmp-sb/ui-smoke/project-history-${width}-${theme}.png`,fullPage:false,animations:'disabled'});
    assert.equal(await page.evaluate(()=>JSON.stringify({projects:window.lifecycle_controller.projects.projects,history:window.lifecycle_controller.projects.history})),before,'Rendering averages must not change the income records');
    await page.evaluate(()=>{window.lifecycle_controller.projects.calculateAverages=window.qaOriginalAverages;delete window.qaOriginalAverages;});
    await modal.locator('#proj-close-history-modal').click();
};
