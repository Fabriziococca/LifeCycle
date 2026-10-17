import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkStore } from '../modules/WorkStore.js';
import { emptyWork } from '../work-utils.mjs';
import { WorkModule } from '../modules/WorkModule.js';

test('Work store confirms writes, retries a lost response without duplicates and refreshes conflicts',async()=>{
 const previous=globalThis.localStorage,cache=new Map();
 globalThis.localStorage={getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)};
 let cloud=emptyWork(),lost=false,conflict=false,calls=0;
 const owner='11111111-1111-4111-8111-111111111111';
 const app={auth:{user:{id:owner},readyUserId:owner,syncGeneration:1,flushPendingKeySync:async()=>true,supabase:{rpc:async(name,p)=>{
  if(name==='get_work_state')return {data:structuredClone(cloud)};
  if(name==='work_backup_snapshot')return {data:{work:structuredClone(cloud),personal:{}}};
  if(name==='save_work_state'){
   calls++;
   if(conflict){conflict=false;cloud={...cloud,revision:cloud.revision+1,settings:{...cloud.settings,dailyTime:'20:00'}};return {error:{code:'40001'}};}
   if(p.p_expected_revision===cloud.revision)cloud=structuredClone(p.p_state);
   if(lost){lost=false;return {error:{message:'response lost'}};}
   return {data:structuredClone(cloud)};
  }
 }}}};
 try {
  const store=new WorkStore(app);await store.load();const draft=store.value;draft.clients.push({id:'22222222-2222-4222-8222-222222222222',name:'QA',archived:false});
  lost=true;await store.save(draft);assert.equal(calls,2);assert.equal(store.value.clients.length,1);assert.equal(store.value.revision,1);
  conflict=true;await assert.rejects(store.save(store.value),/Otra pantalla/);assert.equal(store.value.settings.dailyTime,'20:00');
  const copy=store.value;copy.clients.length=0;assert.equal(store.value.clients.length,1,'unsaved forms cannot mutate the store');
  store.reset();assert.equal(cache.has('lifecycle_work'),false);assert.throws(()=>store.value,/sincronizado/);
 } finally {globalThis.localStorage=previous;}
});
test('A confirmation begun in one account cannot modify another account',async()=>{
 let resolveConfirmation,writes=0;
 const module=Object.create(WorkModule.prototype);
 const c={id:'11111111-1111-4111-8111-111111111111',name:'QA',archived:false};
 module.app={auth:{readyUserId:'first-owner',syncGeneration:1},confirmAction:()=>new Promise(r=>{resolveConfirmation=r;})};
 module.store={value:{...emptyWork(),clients:[c]},save:async()=>{writes++;}};
 const pending=module.action('archive',c.id);module.app.auth.readyUserId='second-owner';module.app.auth.syncGeneration++;
 resolveConfirmation(true);await assert.rejects(pending,/sesión cambió/);assert.equal(writes,0);
});

test('Workspace return respects hidden Hoy and falls back after reload or a hidden previous section',()=>{
 const module=Object.create(WorkModule.prototype),hidden=new Set(['hoy-section']),opened=[];
 module.area='work';module.lastPersonalSectionId='higiene-section';
 module.app={customTrackers:{getAppModules:()=>({'hoy-section':{},'higiene-section':{},'cuidado-section':{},'work-summary-section':{},'work-clients-section':{}}),isModuleVisible:id=>!hidden.has(id)},activateSection:id=>{opened.push(id);return true;}};
 assert.equal(module.switchWorkspace(),true);assert.equal(opened.pop(),'higiene-section');
 module.lastPersonalSectionId=null;module.switchWorkspace();assert.equal(opened.pop(),'higiene-section');
 module.lastPersonalSectionId='higiene-section';hidden.add('higiene-section');module.switchWorkspace();assert.equal(opened.pop(),'cuidado-section');
 module.area='personal';hidden.add('work-summary-section');module.switchWorkspace();assert.equal(opened.pop(),'work-clients-section');
 assert.equal(hidden.has('hoy-section'),true);
});
test('An entirely hidden destination opens module settings instead of silently rejecting the workspace switch',()=>{
 const module=Object.create(WorkModule.prototype);module.area='work';let settings=null,message=null;
 module.app={customTrackers:{getAppModules:()=>({'hoy-section':{},'work-summary-section':{}}),isModuleVisible:id=>id==='work-summary-section'},activateSection:()=>{throw new Error('No hidden section should be opened');},openProfileTab:id=>settings=id,showToast:text=>message=text};
 assert.equal(module.switchWorkspace(),false);assert.equal(settings,'modulos');assert.match(message,/LifeCycle/);
});
