import test from 'node:test';
import assert from 'node:assert/strict';
import { completeMaintenance,nextMaintenanceDate,validateMaintenance,alignMaintenanceDate } from '../maintenance-utils.mjs';
import { emptyWork,validateWork,workOverview,workNotificationCandidates,isWorkRetryRelevant } from '../work-utils.mjs';
import { APPOINTMENTS_KEY,emptyAppointments,validateAppointments,appointmentState,appointmentNotificationCandidates,isAppointmentRetryRelevant } from '../appointments-utils.mjs';
import { createBackupPayload,parseAndValidateBackupText } from '../backup-utils.mjs';
export const client={id:'11111111-1111-4111-8111-111111111111',name:'QA care',archived:false};
export const routine=()=>({id:'22222222-2222-4222-8222-222222222222',clientId:client.id,title:'Revisar equipo',actor:'me',status:'open',priority:'normal',reviewOn:'2026-01-31',promisedOn:'',reminderEnabled:true,reminderTime:'09:00',maintenance:{version:1,scheduleVersion:1,instructions:'Prueba sintética',paused:false,archived:false,times:['09:00','18:00'],history:[],cadence:{type:'interval',every:1,unit:'months',anchor:'calendar',anchorDate:'2026-01-31'}}});
export const appointment=()=>({id:'ha_11111111-1111-4111-8111-111111111111',name:'Consulta QA',professional:'Profesional de prueba',kind:'consultation',date:'2026-10-20',time:'18:00',location:'Lugar sintético',notes:'',trackerId:'',status:'pending',paused:false,archived:false,scheduleVersion:1,stages:[{days:15,times:['09:00']},{days:7,times:['09:00','17:00']},{days:0,times:['08:00','18:00']}]});
const state=()=>({...emptyWork(),clients:[{...client}],followups:[routine()]});
const agenda=e=>({...emptyAppointments(),events:[e]});
test('fixed monthly cadence retains month-end after late or early completion without catch-up backlog',()=>{
 const r=routine();assert.equal(nextMaintenanceDate(r,'2026-02-03'),'2026-02-28');
 assert.equal(nextMaintenanceDate(r,'2026-02-28'),'2026-03-31');
 assert.equal(nextMaintenanceDate(r,'2026-06-10'),'2026-06-30');
 assert.equal(nextMaintenanceDate(r,'2026-01-29'),'2026-02-28');
 r.maintenance.cadence.anchor='completion';assert.equal(nextMaintenanceDate(r,'2026-02-03'),'2026-03-03');
 r.maintenance.cadence={type:'weekly',days:[1,5],anchorDate:'2026-01-31'};
 assert.equal(nextMaintenanceDate(r,'2026-02-01'),'2026-02-02');
 assert.equal(alignMaintenanceDate({type:'weekly',days:[1,5]},'2026-10-22'),'2026-10-23');
 assert.equal(alignMaintenanceDate({type:'weekly',days:[1,5]},'2026-10-23'),'2026-10-23');
 assert.throws(()=>alignMaintenanceDate({type:'weekly',days:[]},'2026-10-22'));
});
test('completion records one occurrence, preserves source, versions pending pushes and rejects invalid history',()=>{
 const r=routine(), args={id:'mh_test-completion',doneOn:'2026-02-03',note:'Revisado',now:new Date('2026-02-03T20:00:00Z')};
 const next=completeMaintenance(r,args);assert.equal(next.reviewOn,'2026-02-28');assert.equal(next.maintenance.history.length,1);assert.equal(r.maintenance.history.length,0);assert.equal(next.maintenance.scheduleVersion,2);
 assert.deepEqual(completeMaintenance(next,args),next);
 assert.throws(()=>completeMaintenance(next,{...args,id:'mh_older',doneOn:'2026-02-02'}));
 for(const broken of [{...r,maintenance:null},{...r,actor:'client'},{...r,maintenance:{...r.maintenance,times:['09:00','09:00']}},{...r,maintenance:{...r.maintenance,cadence:{type:'weekly',anchorDate:'2026-01-01',days:[]}}}])assert.throws(()=>validateMaintenance(broken));
});
test('maintenance participates once in summary, with every configured time and suppression of stale/paused/archived notices',()=>{
 const s=state(),now=new Date('2026-10-20T21:04:00Z');validateWork(s);
 assert.equal(workOverview(s,[],now).mine.length,1);
 const n=workNotificationCandidates(s,now)[0];assert.ok(n.key.startsWith('work:maintenance:'));
 const candidate={alert_key:n.key,scheduled_at:n.scheduledAt,title:n.title,body:n.body};assert.equal(isWorkRetryRelevant(s,candidate,now),true);
 for(const key of ['paused','archived']){const x=structuredClone(s);x.followups[0].maintenance[key]=true;assert.equal(workNotificationCandidates(x,now).length,0);}
 s.followups[0].maintenance.scheduleVersion++;assert.equal(isWorkRetryRelevant(s,candidate,now),false);
 s.clients[0].archived=true;assert.equal(workOverview(s,[],now).due.length,0);
});
test('appointment stages replace each other, respect Argentina dates and expire before the actual appointment',()=>{
 const e=appointment();
 assert.equal(appointmentNotificationCandidates(agenda(e),new Date('2026-10-04T12:04:00Z')).length,0);
 assert.equal(appointmentNotificationCandidates(agenda(e),new Date('2026-10-05T12:04:00Z')).length,1);
 assert.equal(appointmentNotificationCandidates(agenda(e),new Date('2026-10-13T20:04:00Z')).length,1);
 assert.equal(appointmentNotificationCandidates(agenda(e),new Date('2026-10-20T11:04:00Z')).length,1);
 assert.equal(appointmentNotificationCandidates(agenda(e),new Date('2026-10-20T12:04:00Z')).length,0,'today stage replaces seven-day times');
 assert.equal(appointmentNotificationCandidates(agenda(e),new Date('2026-10-20T21:00:00Z')).length,0,'never send at/after appointment time');
 assert.equal(appointmentState(e,new Date('2026-10-20T21:00:00Z')).label,'Confirmar asistencia');
 assert.equal(e.status,'pending','time alone never confirms attendance');
 const late={...e,time:'09:10',stages:[{days:0,times:['09:00']}]};
 assert.equal(appointmentNotificationCandidates(agenda(late),new Date('2026-10-20T12:04:00Z'))[0].expiresAt,'2026-10-20T12:10:00.000Z');
});
test('rescheduling, disabling and finishing invalidate appointment retries even when queued already',()=>{
 const e=appointment(),now=new Date('2026-10-13T12:05:00Z'),n=appointmentNotificationCandidates(agenda(e),now)[0];
 const c={alert_key:n.key,scheduled_at:n.scheduledAt.replace('Z','+00:00'),title:n.title,body:n.body};
 assert.equal(isAppointmentRetryRelevant(agenda(e),c,now),true);
 for(const patch of [{paused:true},{archived:true},{status:'cancelled'},{status:'done',completedOn:'2026-10-13'},{scheduleVersion:2},{date:'2026-11-30'}])assert.equal(isAppointmentRetryRelevant(agenda({...e,...patch}),c,now),false);
 assert.equal(isAppointmentRetryRelevant(agenda(e),c,new Date('2026-10-13T12:15:00Z')),false);
});
test('agenda validation and backups preserve both domains and old backups do not clear appointments',()=>{
 const a=agenda(appointment());validateAppointments(a);
 for(const patch of [{date:'2026-02-30'},{stages:[{days:7,times:['25:00']}]},{stages:[{days:7,times:['09:00']},{days:7,times:['18:00']}]},{status:'done',completedOn:'2050-01-01'}])assert.throws(()=>validateAppointments(agenda({...appointment(),...patch})));
 const b=createBackupPayload(key=>key===APPOINTMENTS_KEY?JSON.stringify(a):key==='lifecycle_work'?JSON.stringify(state()):null);
 const plan=parseAndValidateBackupText(JSON.stringify(b));assert.ok(plan.entries.some(([k])=>k===APPOINTMENTS_KEY));
 delete b.data[APPOINTMENTS_KEY];assert.equal(parseAndValidateBackupText(JSON.stringify(b)).entries.some(([k])=>k===APPOINTMENTS_KEY),false);
});
