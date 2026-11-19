// Anonymous mobile opening against the published origin, with real browser HTTP caching.
const { chromium } = require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

async function measure(context, origin) {
    const page = await context.newPage();
    try {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', {
            offline:false, latency:80, downloadThroughput:500000, uploadThroughput:125000
        });
        await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
        await page.addInitScript(() => {
            function checkGate() {
                const email = document.querySelector('#access-gate input[type=email]');
                if (email?.getBoundingClientRect().height) performance.mark('qa-login-visible');
                else requestAnimationFrame(checkGate);
            }
            requestAnimationFrame(checkGate);
        });
        await page.goto(origin, {waitUntil:'load',timeout:60000});
        await page.waitForFunction(()=>performance.getEntriesByName('qa-login-visible').length, null, {timeout:30000});
        const result = await page.evaluate(() => ({
            gateMs: Math.round(performance.getEntriesByName('qa-login-visible')[0].startTime),
            assets: performance.getEntriesByType('resource')
                .filter(r=>/\/app\.(?:bundle|styles)(?:\.[a-f0-9]+)?\.(?:js|css)$/.test(new URL(r.name).pathname))
                .map(r=>({path:new URL(r.name).pathname,transferBytes:r.transferSize,encodedBytes:r.encodedBodySize,
                    finishMs:Math.round(r.responseEnd)}))
        }));
        assert.equal(result.assets.length,2);
        return result;
    } finally { await page.close(); }
}

async function main() {
    const [origin, output, expected, oldScript, newScript] = process.argv.slice(2);
    assert.ok(origin && output && ['cached','baseline','rollout'].includes(expected),'Pass origin, output file and mode');
    const browser = await chromium.launch({channel:'chrome',headless:true});
    try {
        if (expected === 'rollout') {
            assert.ok(oldScript && newScript && oldScript !== newScript);
            const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
            const first = await measure(context,origin), warm = await measure(context,origin);
            assert.ok(warm.assets.some(a=>a.path==='/'+oldScript));
            assert.ok(warm.assets.every(a=>a.transferBytes===0));
            console.log('Previous release warm. Waiting for the new public HTML.');
            const deadline = Date.now()+600000;
            while (!(await (await fetch(origin,{signal:AbortSignal.timeout(15000)})).text()).includes('src="'+newScript+'"')) {
                assert.ok(Date.now()<deadline,'Deployment timed out');
                await new Promise(resolve=>setTimeout(resolve,5000));
            }
            const updated = await measure(context,origin), reopened = await measure(context,origin);
            assert.ok(updated.assets.some(a=>a.path==='/'+newScript && a.transferBytes>0));
            assert.ok(updated.assets.some(a=>a.path===warm.assets.find(x=>x.path.endsWith('.css')).path && a.transferBytes===0));
            assert.ok(reopened.assets.every(a=>a.transferBytes===0));
            await fs.writeFile(output,JSON.stringify({first,warm,updated,reopened},null,2));
            console.log('New script downloaded, stylesheet reused, both cached on next open.');
            return;
        }
        const runs = [];
        for (let i=0;i<3;i++) {
            const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
            const cold = await measure(context,origin), warm = await measure(context,origin);
            await context.close();
            runs.push({cold,warm});
            assert.ok(cold.assets.every(a=>a.transferBytes>0));
            assert.ok(warm.assets.every(a=>expected==='cached' ? a.transferBytes===0 : a.transferBytes>0));
        }
        await fs.writeFile(output, JSON.stringify({origin,expected,downMbps:4,latencyMs:80,cpuSlowdown:4,runs},null,2));
        console.log(runs.map(({cold,warm})=>[cold.gateMs,warm.gateMs,warm.assets.reduce((n,a)=>n+a.transferBytes,0)]));
    } finally { await browser.close(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
