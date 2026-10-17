import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWork,validateWork,workOverview,workNotificationCandidates,financeWorkScope,activeProjectCandidates,validWorkDate,isWorkRetryRelevant } from '../work-utils.mjs';
import { createBackupPayload,parseAndValidateBackupText } from '../backup-utils.mjs';
const client={id:'11111111-1111-4111-8111-111111111111',name:'QA',archived:false};
const f={id:'22222222-2222-4222-8222-222222222222',clientId:client.id,title:'Revisar',actor:'client',status:'open',priority:'normal',reviewOn:'2026-10-17',promisedOn:'2026-10-20',reminderEnabled:true,reminderTime:'15:00'};
const state=()=>({...emptyWork(),clients:[{...client}],followups:[{...f}]});
test('Trabajo validates ownership, dates, states and identifiers without inferring promises',()=>{
 assert.equal(validateWork(state()).followups[0].promisedOn,'2026-10-20');
 for(const change of [{clientId:crypto.randomUUID()},{reviewOn:'2026-02-30'},{actor:'unknown'},{projectId:'other'}])assert.throws(()=>validateWork({...state(),followups:[{...f,...change}]}));
 assert.equal(validWorkDate('2028-02-29'),true);assert.equal(validWorkDate('2026-02-29'),false);
});
test('Trabajo counts obligations once; arbitration is not an overdue delivery',()=>{
 const s=state();s.links=[{projectId:'p1',clientId:client.id},{projectId:'p2',clientId:client.id}];
 const projects=[{id:'p1',deadline:'2026-10-19T21:00:00Z',budgetNet:100,partialReleases:[{netAmount:40}]},{id:'p2',isArbitration:true,deadline:'2026-01-01',budgetNet:20}];
 const o=workOverview(s,projects,new Date('2026-10-17T18:00:00Z'));assert.equal(o.due.length,1);assert.equal(o.waiting.length,1);assert.equal(o.deliveries.length,1);assert.equal(o.balances[0].remaining,60);
 s.clients[0].archived=true;assert.equal(workOverview(s,projects).open.length,0);assert.equal(workOverview(s,projects).balances.length,2,'archiving never hides unpaid balances');
 assert.equal(activeProjectCandidates(projects,s.links).length,0);
});
test('Trabajo notices follow Argentina dates, expire at 15 minutes and stop when completed/archived',()=>{
 const s=state();s.settings.dailyEnabled=true;
 assert.equal(workNotificationCandidates(s,new Date('2026-10-17T17:59:59Z')).length,0);
 const due=workNotificationCandidates(s,new Date('2026-10-17T18:04:00Z'));assert.equal(due.length,2);assert.equal(due[0].expiresAt,'2026-10-17T18:15:00.000Z');
 assert.equal(workNotificationCandidates(s,new Date('2026-10-17T18:15:00Z')).length,0);
 s.followups[0].status='completed';assert.equal(workNotificationCandidates(s,new Date('2026-10-17T18:04:00Z')).length,0);
 s.followups[0].status='open';s.clients[0].archived=true;assert.equal(workNotificationCandidates(s,new Date('2026-10-17T18:04:00Z')).length,0);
});
test('Finance scope never changes ledger records; project and Saylor retain their origins',()=>{
 assert.equal(financeWorkScope({id:'proj-42',type:'income'},{'income:proj-42':'personal'}),'work');
 assert.equal(financeWorkScope({id:'x',origin:'saylor',type:'income'}),'personal');
 assert.equal(financeWorkScope({id:'x',type:'expense'},{'expense:x':'work'}),'work');
 assert.equal(financeWorkScope({id:'z',type:'expense'}),'unclassified');
});
test('Work retries accept equivalent timestamps and stop after edits, rescheduling or cancellation',()=>{
 const s=state(),now=new Date('2026-10-17T18:07:00Z'),n=workNotificationCandidates(s,now)[0];
 const c={alert_key:n.key,scheduled_at:'2026-10-17T18:00:00+00:00',title:n.title,body:n.body};
 assert.equal(isWorkRetryRelevant(s,c,now),true);
 for(const changes of [{status:'cancelled'},{title:'Changed'},{reminderTime:'15:10'},{reminderEnabled:false}]) assert.equal(isWorkRetryRelevant({...s,followups:[{...f,...changes}]},c,now),false);
});
test('New backups include Trabajo; older full backups preserve existing Trabajo',()=>{
 const b=createBackupPayload(key=>key==='lifecycle_work'?JSON.stringify(state()):null);
 const plan=parseAndValidateBackupText(JSON.stringify(b));assert.ok(plan.entries.some(([key])=>key==='lifecycle_work'));
 delete b.data.lifecycle_work;const old=parseAndValidateBackupText(JSON.stringify(b));assert.equal(old.entries.some(([key])=>key==='lifecycle_work'),false);
 b.data.lifecycle_work={...state(),followups:[{...f,clientId:crypto.randomUUID()}]};assert.throws(()=>parseAndValidateBackupText(JSON.stringify(b)));
});
