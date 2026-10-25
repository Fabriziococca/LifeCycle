const {chromium}=require(process.env.LIFECYCLE_PLAYWRIGHT_MODULE||'playwright');
const express=require('express');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {installFakeCloud}=require('./qa-cloud.cjs');
(async()=>{
 const server=express().use(express.static(process.cwd())).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',r=>r.fulfill({contentType:'application/javascript',body:`(${installFakeCloud.toString()})();`}));
   await context.route('**/api/**',r=>r.fulfill({json:r.request().url().endsWith('/api/config')?{supabaseUrl:'https://qa.invalid',supabaseAnonKey:'qa',registrationEnabled:false}:{devices:[],events:[],entries:[],deliveries:[],available:true}}));
   await context.addInitScript(()=>localStorage.setItem('qa-startup-sentinel','conserved'));
   const page=await context.newPage();
   const failures=[];
   page.on('requestfailed',r=>failures.push(new URL(r.url()).pathname));
   const block=r=>r.abort();await page.route('**/app.bundle.js',block);
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.locator('#app-load-retry').waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('qa-startup-sentinel')),'conserved');
   await page.unroute('**/app.bundle.js',block);await page.locator('#app-load-retry').click();
   await page.waitForFunction(()=>window.lifecycle_controller?.auth?.readyUserId);
   assert.equal(await page.evaluate(()=>localStorage.getItem('qa-startup-sentinel')),'conserved');
   assert.equal(await page.locator('#app-load-retry').count(),0);
   await fs.mkdir('.tmp-sb/startup-ui',{recursive:true});
   await page.screenshot({path:`.tmp-sb/startup-ui/recovered-${width}.png`});
   console.log(JSON.stringify({width,retryRecovered:true,storagePreserved:true}));
   await context.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
