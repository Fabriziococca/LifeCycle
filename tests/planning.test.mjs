import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlanning, SAYLOR_KEY, FACULTY_KEY, saylorTotals, closeSaylor, saylorMovements, validatePlanning, dueFacultyNotices, facultyState } from '../planning-utils.mjs';
import { buildWorkspaceMovements } from '../finance-workspace-utils.mjs';
import { isPushRetryRelevant } from '../notification-utils.js';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
const campaign = (position=30,margin=0) => ({id:'sc_fixture',name:'Saylor de prueba',bulletMinor:5000,startedOn:'2026-10-01',status:'active',loads:[
    {id:'sl_position',quantity:position,destination:'position',date:'2026-10-01'},...(margin?[{id:'sl_margin',quantity:margin,destination:'margin',date:'2026-10-02'}]:[])]});
const faculty = () => ({...emptyPlanning(FACULTY_KEY), subjects:[{id:'fs_fixture',name:'Materia de prueba',teacher:'',term:'',archived:false}],events:[{id:'fe_fixture',subjectId:'fs_fixture',name:'Primer parcial',type:'parcial',date:'2026-10-16',time:'18:00',noticeTime:'15:00',leadDays:14,status:'pending',paused:false,scheduleVersion:1,notes:'',grade:''}],tasks:[]});

test('46 historical bullets remain 30/16/0, independent from market price',()=>{
    const c=campaign(40,6), totals=saylorTotals(c);
    assert.deepEqual(totals.magazines,[30,16,0]);assert.equal(totals.remaining,44);assert.equal(totals.contributedMinor,230000);
    c.marketPrice=1;assert.deepEqual(saylorTotals(c),totals);
    c.loads[0].voidedAt='2026-10-03T15:00:00Z';assert.equal(saylorTotals(c).bullets,6);
});
test('closing 30 bullets at 20 percent records only 300 USD, stable after edits',()=>{
    const c=campaign(); c.closure=closeSaylor(c,{percent:'20',date:'2026-10-03'});c.status='closed';
    const data={...emptyPlanning(SAYLOR_KEY),campaigns:[c]};validatePlanning(data,SAYLOR_KEY);
    const [first]=saylorMovements(data);assert.equal(first.amount,300);assert.equal(first.date,'2026-10-03');
    c.closure=closeSaylor(c,{percent:'22.5',date:'2026-10-04'});
    const entries=saylorMovements(data);assert.equal(entries.length,1);assert.equal(entries[0].id,first.id);assert.equal(entries[0].amount,337.5);
    const movements=buildWorkspaceMovements({entries:[],expenses:[]},entries);assert.equal(movements[0].sourceLabel,'Saylor');assert.equal(movements[0].editable,false);
});
test('position-only, extra margin, zero, negative and actual net result are explicit',()=>{
    const c=campaign(30,6);
    assert.equal(closeSaylor(c,{basis:'position',percent:20,date:'2026-10-03'}).profitMinor,30000);
    assert.equal(closeSaylor(c,{basis:'all',percent:20,date:'2026-10-03'}).profitMinor,36000);
    c.closure=closeSaylor(c,{percent:-1.25,date:'2026-10-03'});c.status='closed';
    assert.equal(saylorMovements({...emptyPlanning(SAYLOR_KEY),campaigns:[c]})[0].resultType,'expense');
    assert.equal(closeSaylor(c,{percent:20,actual:'287.14',date:'2026-10-03'}).profitMinor,28714);
    assert.equal(closeSaylor(c,{percent:0,date:'2026-10-03'}).profitMinor,0);
});
test('overspending, forged profit, invalid references and duplicate loads are rejected',()=>{
    assert.throws(()=>validatePlanning({...emptyPlanning(SAYLOR_KEY),campaigns:[campaign(90,1)]},SAYLOR_KEY),/noventa/);
    const c=campaign();c.loads.push({...c.loads[0]});assert.throws(()=>validatePlanning({...emptyPlanning(SAYLOR_KEY),campaigns:[c]},SAYLOR_KEY),/duplicado/);
    c.loads.pop();c.closure=closeSaylor(c,{percent:20,date:'2026-10-03'});c.closure.profitMinor++;c.status='closed';assert.throws(()=>validatePlanning({...emptyPlanning(SAYLOR_KEY),campaigns:[c]},SAYLOR_KEY),/coincide/);
    const f=faculty();f.events[0].subjectId='fs_missing';assert.throws(()=>validatePlanning(f,FACULTY_KEY),/Evaluación/);
});
test('daily academic notices start 14 days before, use Argentina time and expire after 15 minutes',()=>{
    const f=faculty();
    assert.equal(dueFacultyNotices(f,new Date('2026-10-01T18:01:00Z')).length,0);
    assert.equal(dueFacultyNotices(f,new Date('2026-10-02T17:59:00Z')).length,0);
    const [notice]=dueFacultyNotices(f,new Date('2026-10-02T18:04:00Z'));
    assert.equal(notice.scheduledAt,'2026-10-02T18:00:00.000Z');assert.equal(notice.expiresAt,'2026-10-02T18:15:00.000Z');
    assert.equal(dueFacultyNotices(f,new Date('2026-10-02T18:16:00Z')).length,0);
    assert.equal(dueFacultyNotices(f,new Date('2026-10-16T21:00:00Z')).length,0);
    assert.equal(facultyState(f.events[0],new Date('2026-10-16T21:01:00Z')).label,'Pendiente de resultado');
});
test('reprogramming, completion, pause and archiving suppress old push retries',()=>{
    const f=faculty(), now=new Date('2026-10-14T18:04:00Z');const [notice]=dueFacultyNotices(f,now);
    const snapshot=()=>({lifecycle_faculty:f});assert.equal(isPushRetryRelevant(notice.alertKey,snapshot()),true);
    f.events[0].scheduleVersion++;assert.equal(isPushRetryRelevant(notice.alertKey,snapshot()),false);
    f.events[0].paused=true;assert.equal(dueFacultyNotices(f,now).length,0);f.events[0].paused=false;
    f.events[0].status='done';assert.equal(dueFacultyNotices(f,now).length,0);f.events[0].status='pending';
    f.subjects[0].archived=true;assert.equal(dueFacultyNotices(f,now).length,0);
});
test('backup includes planning and accepts earlier v2 backups without erasing new workspaces',()=>{
    const saylor={...emptyPlanning(SAYLOR_KEY),campaigns:[campaign()]}, f=faculty();
    const backup=createBackupPayload(key=>key===SAYLOR_KEY?JSON.stringify(saylor):key===FACULTY_KEY?JSON.stringify(f):null);
    const parsed=parseAndValidateBackupText(JSON.stringify(backup));assert(parsed.entries.some(([key])=>key===SAYLOR_KEY));
    delete backup.data[SAYLOR_KEY];delete backup.data[FACULTY_KEY];const older=parseAndValidateBackupText(JSON.stringify(backup));
    assert(!older.entries.some(([key])=>[SAYLOR_KEY,FACULTY_KEY].includes(key)));
});
