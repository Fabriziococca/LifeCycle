// Anonymous, fresh contexts only. No account credentials, fixtures, HTTP override or network interception.
const {chromium}=require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const page=await context.newPage(),network=[],failed=[],errors=[];
   const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
   cdp.on('Network.responseReceived',e=>{const u=new URL(e.response.url);if(u.origin==='https://lifecycle-ykn5.onrender.com')network.push({path:u.pathname,protocol:e.response.protocol,status:e.response.status});});
   page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',r=>failed.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
   await page.goto('https://lifecycle-ykn5.onrender.com/',{waitUntil:'networkidle'});
   await page.locator('#access-gate input[type=email]').first().waitFor({state:'visible',timeout:20000});
   assert.equal(await page.locator('#app-load-retry').count(),0);
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   assert.ok(network.some(r=>r.path==='/app.bundle.js'&&r.status===200&&r.protocol==='h2'),'Actual HTTP/2 bundle download required');
   assert.equal(network.some(r=>r.path.startsWith('/modules/')),false,'Startup must not fan out into the source module graph');
   await fs.mkdir('.tmp-sb/startup-ui',{recursive:true});
   await page.screenshot({path:`.tmp-sb/startup-ui/public-http2-${width}.png`});
   results.push({width,loginReady:true,http2:true,failedRequests:failed.length,exceptions:errors.length,sourceModuleRequests:0});
   await context.close();
  }
  await fs.writeFile('.tmp-sb/http2-public-results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
