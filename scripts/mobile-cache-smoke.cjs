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
    const [origin, output, expected] = process.argv.slice(2);
    assert.ok(origin && output && ['cached','baseline'].includes(expected),'Pass origin, output file and cached/baseline');
    const browser = await chromium.launch({channel:'chrome',headless:true});
    try {
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
