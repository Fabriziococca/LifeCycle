const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=html.match(/<script id="lifecycle-startup-guard">([\s\S]*?)<\/script>/)[1];
function setup(ready=false){
    let fallback=[],timeout,reloads=0;
    const document={getElementById:()=>({classList:{contains:()=>ready},replaceChildren:(...items)=>{fallback=items;}}),createElement:tag=>({tag,setAttribute(){},addEventListener(type,fn){this.click=fn;}})};
    const window={lifecycle_controller:ready?{}:null,location:{reload:()=>reloads++},setTimeout:(fn,delay)=>{assert.equal(delay,30000);timeout=fn;}};
    vm.runInNewContext(source,{window,document});
    return {window,fallback:()=>fallback,timeout:()=>timeout(),reloads:()=>reloads};
}
test('failed module loading offers one safe retry without touching storage',()=>{
    const state=setup();state.window.lifecycleBootFailure();state.timeout();
    assert.equal(state.fallback().length,2);
    assert.equal(state.fallback()[1].id,'app-load-retry');
    state.fallback()[1].click();assert.equal(state.reloads(),1);
});
test('slow-loading deadline has a recovery action; initialized app stays untouched',()=>{
    const failed=setup();failed.timeout();assert.equal(failed.fallback().length,2);
    const ready=setup(true);ready.timeout();assert.equal(ready.fallback().length,0);
});
test('an initialized controller with an unfinished session check also has a retry',()=>{
    const pending=setup();pending.window.lifecycle_controller={};pending.timeout();
    assert.equal(pending.fallback()[1].id,'app-load-retry');
});
