import test from 'node:test';
import assert from 'node:assert/strict';
import { completeMaintenance, maintenancePriority, validateMaintenance } from '../maintenance-utils.mjs';
import { emptyWork, workNotificationCandidates, isWorkRetryRelevant, validateWork, followupPriority } from '../work-utils.mjs';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';

const client={id:'11111111-1111-4111-8111-111111111111',name:'QA',archived:false};
const routine=(every=3,escalationDays=4)=>({id:'22222222-2222-4222-8222-222222222222',clientId:client.id,title:'QA Reinicio',actor:'me',status:'open',priority:'normal',reviewOn:every===1?'2026-10-02':'2026-10-04',promisedOn:'',reminderEnabled:true,reminderTime:'22:00',maintenance:{version:1,scheduleVersion:1,instructions:'QA',times:['22:00'],paused:false,archived:false,history:[],repeatUntilDone:true,escalationDays,cadence:{type:'interval',every,unit:'days',anchor:'completion',anchorDate:'2026-10-01'}}});
const state=f=>({...emptyWork(),clients:[client],followups:[f]});
const night=day=>new Date(day+'T22:04:00-03:00');

test('normal notice at day 3 and high priority at day 7, at 22:00 Argentina and without starting another cycle',()=>{
 const f=routine(),s=state(f);validateWork(s);
 assert.equal(workNotificationCandidates(s,night('2026-10-03')).length,0);
 for(const day of ['2026-10-04','2026-10-07']){assert.equal(maintenancePriority(f,day).high,false);assert.equal(workNotificationCandidates(s,night(day))[0].title,'Trabajo · recordatorio');}
 for(const day of ['2026-10-08','2026-10-13']){assert.equal(maintenancePriority(f,day).high,true);assert.match(workNotificationCandidates(s,night(day))[0].title,/^Prioridad alta/);assert.equal(followupPriority(f,day),'high');}
 assert.equal(maintenancePriority(f).highOn,'2026-10-08');assert.equal(f.reviewOn,'2026-10-04');assert.equal(f.maintenance.history.length,0);
 assert.equal(workNotificationCandidates(s,new Date('2026-10-08T22:15:00-03:00')).length,0);
});

test('daily OBS task becomes high on day 2 and completing late resets both thresholds from the actual realization',()=>{
 const f=routine(1,1);assert.equal(maintenancePriority(f,'2026-10-02').high,false);assert.equal(maintenancePriority(f,'2026-10-03').high,true);
 const next=completeMaintenance(f,{id:'mh_qa-complete',doneOn:'2026-10-07',now:new Date('2026-10-07T23:00:00-03:00')});
 assert.equal(next.reviewOn,'2026-10-08');assert.equal(maintenancePriority(next).highOn,'2026-10-09');assert.equal(next.maintenance.history[0].doneOn,'2026-10-07');
 assert.equal(maintenancePriority(next,'2026-10-07').high,false);assert.equal(workNotificationCandidates(state(next),night('2026-10-07')).length,0);
 assert.equal(f.maintenance.history.length,0);
});

test('paused, archived, completed or disabled routines and archived clients do not send reinforced notices',()=>{
 for(const key of ['paused','archived','completed']){const f=routine();f.maintenance[key]=true;assert.equal(maintenancePriority(f,'2026-10-08').high,false);assert.equal(workNotificationCandidates(state(f),night('2026-10-08')).length,0);}
 const f=routine();f.reminderEnabled=false;assert.equal(workNotificationCandidates(state(f),night('2026-10-08')).length,0);
 const s=state(routine());s.clients=[{...client,archived:true}];assert.equal(workNotificationCandidates(s,night('2026-10-08')).length,0);
});

test('completion invalidates an already queued high-priority retry; legacy routines retain their behavior',()=>{
 const f=routine(),now=night('2026-10-08'),n=workNotificationCandidates(state(f),now)[0];
 const c={alert_key:n.key,scheduled_at:n.scheduledAt,title:n.title,body:n.body};assert.equal(isWorkRetryRelevant(state(f),c,now),true);
 const next=completeMaintenance(f,{id:'mh_qa-retry',doneOn:'2026-10-08',now});assert.equal(isWorkRetryRelevant(state(next),c,now),false);
 delete f.maintenance.escalationDays;assert.equal(maintenancePriority(f,'2026-10-21').high,false);assert.equal(workNotificationCandidates(state(f),now)[0].title,'Trabajo · recordatorio');
});

test('escalation validation rejects invalid thresholds and preserves configured reinforcement in full backups',()=>{
 for(const value of [null,0,-1,1.1,'4',3651]){const f=routine();f.maintenance.escalationDays=value;assert.throws(()=>validateMaintenance(f));}
 const f=routine();f.maintenance.repeatUntilDone=false;assert.throws(()=>validateMaintenance(f));
 const data=state(routine()),payload=createBackupPayload(key=>key==='lifecycle_work'?JSON.stringify(data):null);
 const restored=JSON.parse(parseAndValidateBackupText(JSON.stringify(payload)).entries.find(([key])=>key==='lifecycle_work')[1]);
 assert.equal(restored.followups[0].maintenance.escalationDays,4);assert.equal(maintenancePriority(restored.followups[0],'2026-10-08').high,true);
});
