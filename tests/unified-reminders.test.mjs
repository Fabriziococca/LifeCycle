import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRecurringSchedule, nextReminderDay, upsertRecurringReminder, migrateRecurringReminderConfigs, validateReminderSchedule } from '../recurring-reminder-utils.mjs';
import { completeMaintenance, maintenanceSchedule } from '../maintenance-utils.mjs';
import { emptyWork, workNotificationCandidates, validateWork, isWorkRetryRelevant, WORK_SECTIONS } from '../work-utils.mjs';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
import { createRecoveryVault, encryptRecoverySnapshot, decryptRecoverySnapshot } from '../recovery-vault.mjs';

const cid='11111111-1111-4111-8111-111111111111', fid='22222222-2222-4222-8222-222222222222';
function state(schedule,repeatUntilDone=false){
    return {...emptyWork(),clients:[{id:cid,name:'QA',archived:false}],followups:[{
        id:fid,clientId:cid,title:'QA aviso',actor:'me',status:'open',priority:'normal',reviewOn:'2026-10-21',promisedOn:'',reminderEnabled:true,reminderTime:'09:00',
        maintenance:{version:1,scheduleVersion:1,instructions:'QA',times:['09:00','18:00'],paused:false,archived:false,history:[],repeatUntilDone,cadence:{type:'scheduled',schedule,anchorDate:'2026-10-21'}}
    }]};
}
test('one-time client reminders send on their date only and completion retains history without starting another cycle',()=>{
    const s=state({type:'once',date:'2026-10-21'});validateWork(s);
    assert.equal(workNotificationCandidates(s,new Date('2026-10-21T12:04:00Z')).length,1);
    assert.equal(workNotificationCandidates(s,new Date('2026-10-21T21:04:00Z')).length,1);
    assert.equal(workNotificationCandidates(s,new Date('2026-10-22T12:04:00Z')).length,0);
    const notice=workNotificationCandidates(s,new Date('2026-10-21T12:04:00Z'))[0];
    const finished=completeMaintenance(s.followups[0],{id:'mh_qa-once',doneOn:'2026-10-21',now:new Date('2026-10-21T13:00:00Z')});
    s.followups=[finished];assert.equal(finished.maintenance.completed,true);assert.equal(finished.maintenance.history.length,1);
    assert.equal(workNotificationCandidates(s,new Date('2026-10-21T21:04:00Z')).length,0);
    assert.equal(isWorkRetryRelevant(s,{alert_key:notice.key,scheduled_at:notice.scheduledAt,title:notice.title,body:notice.body},new Date('2026-10-21T12:05:00Z')),false);
});
test('fixed schedules do not become daily reminders when an occurrence was not marked done',()=>{
    const s=state({type:'interval',startDate:'2026-10-21',every:3,unit:'days'});
    for(const [date,n] of [['21',1],['22',0],['23',0],['24',1]])assert.equal(workNotificationCandidates(s,new Date(`2026-10-${date}T12:04:00Z`)).length,n);
    s.followups[0].maintenance.repeatUntilDone=true;
    assert.equal(workNotificationCandidates(s,new Date('2026-10-22T12:04:00Z')).length,1);
});
test('a one-time client notice crossing midnight retains its original day and expires once',()=>{
    const s=state({type:'once',date:'2026-10-21'});s.followups[0].maintenance.times=['23:55'];s.followups[0].reminderTime='23:55';
    const due=workNotificationCandidates(s,new Date('2026-10-22T03:05:00Z'));
    assert.equal(due.length,1);assert.ok(due[0].key.endsWith(':2026-10-21'));
    assert.equal(workNotificationCandidates(s,new Date('2026-10-22T03:10:00Z')).length,0);
});
test('monthly and yearly calendar calculations preserve month-end and leap-year meaning',()=>{
    assert.equal(nextReminderDay({type:'interval',every:1,unit:'months',startDate:'2026-01-31'},'2026-02-01'),'2026-02-28');
    assert.equal(nextReminderDay({type:'interval',every:1,unit:'months',startDate:'2026-01-31'},'2026-03-01'),'2026-03-31');
    assert.equal(nextReminderDay({type:'yearly',day:29,month:2},'2027-03-01'),'2028-02-29');
    assert.equal(nextReminderDay({type:'once',date:'2026-10-21'},'2026-10-22'),null);
    assert.equal(matchesRecurringSchedule({type:'once',date:'2026-10-21'},{year:2026,month:10,day:21,dayOfWeek:3}),true);
    assert.throws(()=>validateReminderSchedule({type:'once',date:'2026-02-30'}));
    assert.throws(()=>validateReminderSchedule({type:'interval',startDate:'2026-10-21',every:0,unit:'days'}));
});
test('workspace metadata is additive and old reminder configuration keeps times, days and pause state',()=>{
    const original={trading:{enabled:false,paused:true,times:['09:00','18:00'],days:[1,3]}};
    const next=upsertRecurringReminder(original,{id:'reminder_qa_work',workspace:'work',category:'trabajo',name:'QA',body:'QA',schedule:{type:'once',date:'2026-10-22'},time:'15:00'});
    const migrated=migrateRecurringReminderConfigs(next);
    assert.equal(migrated.__recurring_reminders.reminders.find(r=>r.id==='reminder_qa_work').workspace,'work');
    assert.equal(migrated.trading.enabled,false);assert.equal(migrated.trading.paused,true);assert.deepEqual(migrated.trading.times,['09:00','18:00']);assert.deepEqual(migrated.trading.days,[1,3]);
    assert.equal(original.__recurring_reminders,undefined);
    assert.ok(WORK_SECTIONS.includes('suscripciones-section'));
});
test('legacy completion-based routines keep their original cadence and history on completion',()=>{
    const s=state({type:'weekly',days:[1]});
    s.followups[0].maintenance.cadence={type:'interval',every:3,unit:'days',anchor:'completion',anchorDate:'2026-10-21'};
    delete s.followups[0].maintenance.repeatUntilDone;
    const next=completeMaintenance(s.followups[0],{id:'mh_qa-legacy',doneOn:'2026-10-21',now:new Date('2026-10-21T13:00:00Z')});
    assert.equal(next.reviewOn,'2026-10-24');assert.equal(next.maintenance.cadence.anchor,'completion');assert.equal(maintenanceSchedule(next).every,3);
});
test('full backup and encrypted recovery round-trip new reminder frequencies and original workspace associations',async()=>{
    let alerts=upsertRecurringReminder({}, {id:'reminder_qa_once',name:'QA once',workspace:'work',category:'trabajo',schedule:{type:'once',date:'2026-12-21'},times:['09:00','18:00']});
    alerts=upsertRecurringReminder(alerts,{id:'reminder_qa_interval',name:'QA interval',workspace:'personal',schedule:{type:'interval',startDate:'2026-12-20',every:3,unit:'days'}});
    const work=state({type:'once',date:'2026-10-21'}),data={alerts_config:JSON.stringify(alerts),lifecycle_work:JSON.stringify(work)};
    const payload=createBackupPayload(k=>data[k]??null),plan=parseAndValidateBackupText(JSON.stringify(payload));
    const restored=Object.fromEntries(plan.entries);
    assert.deepEqual(JSON.parse(restored.alerts_config),alerts);assert.deepEqual(JSON.parse(restored.lifecycle_work),work);
    const vault=await createRecoveryVault('qa-unified-owner','qa-local-recovery-phrase');
    vault.snapshots=[await encryptRecoverySnapshot(vault,{...payload,ownerId:vault.ownerId})];
    const decrypted=await decryptRecoverySnapshot(vault,'qa-local-recovery-phrase');
    assert.deepEqual(decrypted.data,payload.data);
    const invalid=structuredClone(payload);invalid.data.alerts_config.reminder_qa_once.schedule.date='2026-02-30';
    assert.throws(()=>parseAndValidateBackupText(JSON.stringify(invalid)));
});
