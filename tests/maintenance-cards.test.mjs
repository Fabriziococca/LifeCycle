import test from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceCycleState, isMaintenanceCycle, completeMaintenance } from '../maintenance-utils.mjs';
import { cycleMetrics, cycleIdentity } from '../cycle-card-view.mjs';

const routine=()=>({id:'22222222-2222-4222-8222-222222222222',clientId:'11111111-1111-4111-8111-111111111111',title:'Reiniciar PC',actor:'me',status:'open',priority:'normal',reviewOn:'2026-10-04',promisedOn:'',reminderEnabled:true,reminderTime:'22:00',maintenance:{version:1,scheduleVersion:1,instructions:'Conservar evidencia',times:['22:00'],paused:false,archived:false,history:[],repeatUntilDone:true,escalationDays:4,seedKey:'keep-existing-marker',cadence:{type:'interval',every:3,unit:'days',anchor:'completion',anchorDate:'2026-10-01'}}});

test('client cards progress from up to date to attention on day 3 and overdue on day 7 without creating history',()=>{
    const item=routine(),before=JSON.stringify(item);
    for(const [day,elapsed,label] of [['2026-10-01',0,'Al día'],['2026-10-03',2,'Al día'],['2026-10-04',3,'Atención'],['2026-10-07',6,'Atención'],['2026-10-08',7,'Vencido'],['2026-10-13',12,'Vencido']]){
        const state=maintenanceCycleState(item,day);
        assert.equal(state.label,label);assert.equal(state.elapsedDays,elapsed);assert.equal(state.deadlineDays,7);assert.equal(state.lastDoneOn,null);assert.equal(state.deadlineOn,'2026-10-08');assert.ok(state.progress>=0&&state.progress<=100);
    }
    assert.equal(JSON.stringify(item),before);
});
test('a real completion resets the counter and both deadlines, preserving history and metadata',()=>{
    const item=routine(), next=completeMaintenance(item,{id:'mh_qa-card',doneOn:'2026-10-13',note:'Comprobado',now:new Date('2026-10-13T23:00:00-03:00')});
    const state=maintenanceCycleState(next,'2026-10-13');
    assert.equal(state.elapsedDays,0);assert.equal(state.label,'Al día');assert.equal(state.warningOn,'2026-10-16');assert.equal(state.deadlineOn,'2026-10-20');assert.equal(state.lastDoneOn,'2026-10-13');
    assert.equal(next.maintenance.seedKey,'keep-existing-marker');assert.equal(next.maintenance.history[0].note,'Comprobado');assert.equal(item.maintenance.history.length,0);
});
test('initial cycles, future dates and paused/archived states never invent a completion',()=>{
    for(const [flag,label] of [['paused','Pausado'],['archived','Archivado'],['completed','Realizado']]){const item=routine();item.maintenance[flag]=true;const s=maintenanceCycleState(item,'2026-10-13');assert.equal(s.label,label);assert.equal(s.tone,'gray');assert.equal(s.lastDoneOn,null);}
    const s=maintenanceCycleState(routine(),'2026-09-30');assert.equal(s.label,'Programado');assert.equal(s.elapsedDays,0);assert.equal(s.progress,0);
});
test('one-off reminders and fixed schedules retain their scheduling model',()=>{
    const item=routine();item.maintenance.repeatUntilDone=false;assert.equal(isMaintenanceCycle(item),false);assert.equal(maintenanceCycleState(item),null);
    item.maintenance.repeatUntilDone=true;item.maintenance.cadence={type:'scheduled',schedule:{type:'once',date:'2026-10-10'},anchorDate:'2026-10-01'};assert.equal(isMaintenanceCycle(item),false);
    item.maintenance.cadence={type:'interval',every:3,unit:'days',anchor:'calendar',anchorDate:'2026-10-01'};assert.equal(isMaintenanceCycle(item),false);
});
test('shared card components escape user content and contain no cross-module action handlers',()=>{
    assert.match(cycleIdentity('<img onerror=alert(1)>','ph-clock','Atención'),/&lt;img/);
    const html=cycleMetrics({elapsedDays:4,cadenceLabel:'de 7 días',latestLabel:'<img>',nextLabel:'8 oct',progress:150});
    assert.match(html,/width: 100%/);assert.match(html,/&lt;img&gt;/);assert.doesNotMatch(html,/data-custom-runtime-action|data-work-action/);
});
