import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWork, validateWork, workNotificationCandidates, isWorkRetryRelevant, financeWorkScope } from '../work-utils.mjs';
import { billingDate, nextBillingDate, confirmRetainer, voidLastRetainerPayment, retainerMovements, pendingRetainers, relinkProject } from '../retainer-utils.mjs';
import { buildWorkspaceMovements, accountBalanceMinor } from '../finance-workspace-utils.mjs';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
const cid='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222';
const contract=()=>({id:rid,version:1,scheduleVersion:1,title:'Soporte',tasks:'Reiniciar PC',amountMinor:20000,currency:'USD',billingDay:31,nextDue:'2026-01-31',paused:false,archived:false,reminderEnabled:true,times:['09:00','18:00'],projectIds:['p1'],payments:[]});
const state=r=>({...emptyWork(),clients:[{id:cid,name:'Cliente QA',archived:false,retainers:[r||contract()]}],links:[{clientId:cid,projectId:'p1'}]});
const confirm=(r,patch={})=>confirmRetainer(r,{id:crypto.randomUUID(),dueOn:r.nextDue,receivedOn:'2026-01-31',today:'2026-01-31',clientName:'Cliente QA',...patch});
test('monthly billing clamps short months and returns to the original billing day',()=>{
 assert.equal(billingDate('2026-02',31),'2026-02-28');assert.equal(billingDate('2028-02',31),'2028-02-29');
 assert.equal(nextBillingDate('2026-01-31',31),'2026-02-28');assert.equal(nextBillingDate('2026-02-28',31),'2026-03-31');
 assert.equal(nextBillingDate('2026-12-31',31),'2027-01-31');
});
test('unconfirmed periods never enter finance; receipt and next month change together and retry is idempotent',()=>{
 const r=contract(),s=state(r);assert.equal(retainerMovements(s).length,0);assert.equal(pendingRetainers(s,'2026-02-20').length,1);
 const paid=confirm(r);assert.equal(paid.nextDue,'2026-02-28');assert.equal(paid.payments.length,1);assert.deepEqual(r,contract());
 assert.deepEqual(confirmRetainer(paid,{dueOn:'2026-01-31'}),paid);
 assert.doesNotThrow(()=>validateWork(state(paid)));
 const entries=retainerMovements(state(paid));assert.equal(entries.length,1);assert.equal(entries[0].amount,200);
 const movements=buildWorkspaceMovements({entries:[],expenses:[]},entries);
 assert.equal(movements[0].editable,false);assert.equal(movements[0].sourceLabel,'Mantenimiento');assert.equal(financeWorkScope(movements[0]),'work');
 assert.equal(pendingRetainers(state(paid),'2026-01-31').length,0);
});
test('late payment advances exactly one period without skipping unpaid months; void keeps history',()=>{
 const paid=confirm(contract(),{today:'2026-05-01',receivedOn:'2026-05-01'});
 assert.equal(paid.nextDue,'2026-02-28');assert.equal(pendingRetainers(state(paid),'2026-05-01').length,1);
 const undone=voidLastRetainerPayment(paid,paid.payments[0].id);assert.equal(undone.nextDue,'2026-01-31');assert.equal(undone.billingDay,31);
 assert.equal(undone.payments.length,1);assert.equal(retainerMovements(state(undone)).length,0);
 const again=confirm(undone);assert.equal(again.payments.length,2);validateWork(state(again));
 assert.throws(()=>voidLastRetainerPayment(again,undone.payments[0].id));
});
test('paid snapshots survive price edits, archive and project reassignments without double-counting',()=>{
 const r=confirm(contract());r.amountMinor=40000;r.title='Nuevo servicio';r.archived=true;
 const s=state(r);s.clients.push({id:'33333333-3333-4333-8333-333333333333',name:'Otro',archived:false});
 s.followups=[{id:crypto.randomUUID(),clientId:cid,projectId:'p1',title:'Tarea',actor:'me',status:'open',priority:'normal',reviewOn:'2026-01-01',reminderEnabled:false,reminderTime:'09:00'}];
 s.notes=[{id:crypto.randomUUID(),clientId:cid,projectId:'p1',kind:'note',body:'Nota original'}];
 const changed=relinkProject(s,'p1',s.clients[1].id);validateWork(changed);
 assert.equal(changed.followups[0].clientId,cid);assert.equal(changed.followups[0].projectId,'');assert.equal(changed.notes[0].projectId,'');
 assert.deepEqual(changed.clients[0].retainers[0].projectIds,[]);assert.deepEqual(changed.clients[0].retainers[0].payments[0].projectIds,['p1']);
 assert.equal(retainerMovements(changed)[0].amount,200);assert.match(retainerMovements(changed)[0].description,/Soporte/);
 changed.clients[0].archived=true;assert.equal(retainerMovements(changed).length,1);assert.equal(pendingRetainers(changed,'2026-06-01').length,0);
 assert.deepEqual(s.links,[{clientId:cid,projectId:'p1'}]);
});
test('ARS receipts preserve native money and explicit conversion; optional account receives one income',()=>{
 const r={...contract(),currency:'ARS',amountMinor:24000000}, paid=confirm(r,{exchangeRate:1200,accountId:'acct_qa'});
 const entries=retainerMovements(state(paid)), m=buildWorkspaceMovements({entries:[],expenses:[]},entries);
 assert.equal(entries[0].amount,200);assert.equal(m[0].nativeAmountMinor,24000000);
 assert.equal(accountBalanceMinor({id:'acct_qa',currency:'ARS',openingMinor:0},m,[]),24000000);
 for(const exchangeRate of [0,NaN,-5,Infinity])assert.throws(()=>confirm(r,{exchangeRate}));
 for(const patch of [{paused:true},{archived:true},{nextDue:'2026-02-28',billingDay:28}])assert.throws(()=>confirm({...contract(),...patch}));
});
test('billing notices use configured Argentina times, expire, cancel retries, and include pending bills in summary',()=>{
 const s=state();s.settings.dailyEnabled=true;s.settings.dailyTime='09:00';
 const at=new Date('2026-01-31T12:04:00Z'), notices=workNotificationCandidates(s,at);assert.equal(notices.length,2);assert.equal(notices[1].retainer.id,rid);
 assert.equal(workNotificationCandidates(s,new Date('2026-01-31T12:15:00Z')).length,0);
 assert.equal(workNotificationCandidates(s,new Date('2026-01-31T21:05:00Z')).length,1);
 const n=notices[1],retry={alert_key:n.key,scheduled_at:n.scheduledAt,title:n.title,body:n.body};assert.equal(isWorkRetryRelevant(s,retry,at),true);
 s.clients[0].retainers[0]=confirm(contract());assert.equal(isWorkRetryRelevant(s,retry,at),false);
 for(const key of ['paused','archived']){const r=contract();r[key]=true;assert.equal(workNotificationCandidates(state(r),at).length,0);}
});
test('contracts and receipts survive unified backup; malformed history and cross-client links fail closed',()=>{
 const s=state(confirm(contract()));const backup=createBackupPayload(key=>key==='lifecycle_work'?JSON.stringify(s):null);
 const restored=parseAndValidateBackupText(JSON.stringify(backup));assert.ok(restored.entries.some(([key])=>key==='lifecycle_work'));
 for(const patch of [{amountMinor:0},{billingDay:32},{nextDue:'2026-02-30'},{times:['09:00','09:00']},{projectIds:['other']},{payments:[...s.clients[0].retainers[0].payments,...s.clients[0].retainers[0].payments]}])assert.throws(()=>validateWork(state({...s.clients[0].retainers[0],...patch})));
});
