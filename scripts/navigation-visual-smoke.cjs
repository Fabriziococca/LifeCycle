const assert = require('node:assert/strict');

exports.runNavigationVisualSmoke = async (page, {width, theme}) => {
    assert.match(page.url(), /^http:\/\/localhost:/);
    await page.emulateMedia({reducedMotion:'no-preference'});
    const sections = ['higiene','cuidado','lentes','salud','vehiculo','work-summary','work-clients',
        'work-followups','projects','finanzas','higiene','salud','work-summary','higiene'];
    // Inspect every frame, rather than a settled screenshot: the reported
    // regression lasted only a fraction of a second after navigation.
    const frames = await page.evaluate(async sections => {
        const a=window.lifecycle_controller, failures=[];
        for (const id of sections) {
            a.activateSection(id+'-section');
            const root=document.getElementById(id+'-section');
            for(let frame=0;frame<12;frame++) {
                const style=getComputedStyle(root);
                if(style.opacity!=='1'||style.transform!=='none'||root.getAnimations().some(x=>x.playState==='running')) {
                    failures.push({id,frame,opacity:style.opacity,transform:style.transform});
                }
                await new Promise(requestAnimationFrame);
            }
        }
        return failures;
    },sections);
    assert.deepEqual(frames,[],`Module navigation must stay opaque and stationary at ${width}/${theme}`);

    // The old saved ph-spray value has no glyph in the current icon font.
    await page.evaluate(()=>window.lifecycle_controller.activateSection('lentes-section'));
    // Presentation-only fixture; this regression does not exercise persistence.
    await page.evaluate(async()=>{
        const a=window.lifecycle_controller;
        const {createCustomTracker}=await import('/custom-tracker-utils.mjs');
        const tracker=createCustomTracker({section:'lenses',subsection:'insumos',
            template:'consumable',name:'Pañuelo (Lavado)',actionLabel:'Lavar pañuelo',intervalDays:15,
            icon:'ph-spray',alert:{enabled:false,time:'15:00'}},{id:'ct_navigation_cloth'});
        a.customTrackers.registry.trackers.push(tracker);
        a.customTrackers.renderSection('lenses');
    });
    const cloth = page.locator('#lentes-section .custom-tracker-card').filter({hasText:'Pañuelo (Lavado)'});
    const clothIcon = cloth.locator('.custom-tracker-icon .ph-spray-bottle');
    try { await clothIcon.waitFor({state:'visible'}); }
    catch (error) {
        console.log('Cloth icon diagnostics',await page.evaluate(()=>({
            sectionClass:document.getElementById('lentes-section').className,
            cards:[...document.querySelectorAll('#lentes-section .custom-tracker-card')].map(e=>({
                name:e.querySelector('h3')?.textContent,icon:e.querySelector('.custom-tracker-icon i')?.className
            }))
        })));
        throw error;
    }
    assert.ok(await clothIcon.evaluate(e=>!['none','""',''].includes(getComputedStyle(e,'::before').content)));

    for(const id of ['higiene','work-summary']) {
        await page.evaluate(id=>window.lifecycle_controller.activateSection(id+'-section'),id);
        const icon=page.locator('.adaptive-nav-brand > i');
        const result=await icon.evaluate(e=>{
            const style=getComputedStyle(e);
            const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
            const lum=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
            const a=lum(style.color),b=lum(style.backgroundColor);
            return {contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),glyph:getComputedStyle(e,'::before').content};
        });
        assert.ok(result.contrast>=4.5,`Logo contrast ${result.contrast} in ${id}/${theme}`);
        assert.ok(result.glyph&&result.glyph!=='none'&&result.glyph!=='""','Brand glyph must be present');
        if(width>900)assert.equal(await icon.isVisible(),true);
        const navContrast=await page.locator('#main-nav .nav-btn.active').evaluate(e=>{
            const s=getComputedStyle(e),rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
            const lum=v=>rgb(v).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
            const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        });
        assert.ok(navContrast>=4.5,`Selected navigation contrast ${navContrast} at ${width}/${theme}`);
    }
    await page.screenshot({path:`.tmp-sb/ui-smoke/${width}-${theme}-navigation-fixed.png`,fullPage:false});
};
