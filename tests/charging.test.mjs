import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARGING_KEY, emptyCharging, readCharging, validateCharging, chargingState, chargingNotificationCandidates, isChargingRetryRelevant, restoreCharging } from '../charging-utils.mjs';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
import { PlanningStore } from '../modules/PlanningStore.js';
const start='2026-10-17T15:00:00.000Z',due='2026-10-17T18:00:00.000Z';
const device=()=>({id:'cd_fixture',name:'Aspiradora QA',maxMinutes:180,createdAt:start,archived:false,deleted:false,paused:false,notify:true,repeatMinutes:30,sessions:[{id:'cs_fixture',startedAt:start,finishedAt:null,limitMinutes:180}]});
// IDs in the production format use UUIDs or stable hyphenated seed names.
const fixture=()=>{const d=device();d.id='cd_fixture-qa';d.sessions[0].id='cs_fixture-qa';return {version:1,revision:1,devices:[d]};};
test('charging: elapsed wall time and frozen duration are independent of edited settings',()=>{
 const value=fixture(),d=value.devices[0];d.maxMinutes=30;d.paused=true;
 assert.equal(validateCharging(value).devices[0].maxMinutes,30);
 assert.equal(chargingState(d,new Date(due)).elapsedMinutes,180);
 assert.equal(chargingState(d,new Date(due)).dueAt,due);
 assert.equal(chargingState(d,new Date('2026-10-17T17:59:59Z')).overdue,false);
});
test('charging: no invented deadline for an unknown duration, no alerts before due',()=>{
 const v=fixture();assert.equal(chargingNotificationCandidates(v,new Date('2026-10-17T17:59:59Z')).length,0);
 v.devices[0].sessions[0].limitMinutes=null;assert.equal(chargingState(v.devices[0],new Date(due)).dueAt,null);
 assert.equal(chargingNotificationCandidates(v,new Date(due)).length,0);
});
test('charging: 15-minute expiry, distinct repeat claims, no replay after a restart',()=>{
 const v=fixture(),first=chargingNotificationCandidates(v,new Date(due))[0];assert.ok(first);
 assert.equal(chargingNotificationCandidates(v,new Date('2026-10-17T18:14:59Z'))[0].key,first.key);
 assert.equal(chargingNotificationCandidates(v,new Date('2026-10-17T18:15:00Z')).length,0);
 assert.notEqual(chargingNotificationCandidates(v,new Date('2026-10-17T18:30:00Z'))[0].key,first.key);
 v.devices[0].repeatMinutes=0;assert.equal(chargingNotificationCandidates(v,new Date('2026-10-17T18:30:00Z')).length,0);
});
test('charging: disconnected, paused, disabled and archived devices never notify',()=>{
 for(const change of [d=>d.paused=true,d=>d.notify=false,d=>d.sessions[0].finishedAt=due,d=>{d.archived=true;d.sessions[0].finishedAt=due;}]) {
  const v=fixture();change(v.devices[0]);assert.equal(chargingNotificationCandidates(v,new Date(due)).length,0);
 }
});
test('charging: retries require the same active session, time, body and title',()=>{
 const v=fixture(),n=chargingNotificationCandidates(v,new Date(due))[0],c={alert_key:n.key,scheduled_at:due,title:n.title,body:n.body};
 assert.equal(isChargingRetryRelevant(v,c,new Date(due)),true);
 assert.equal(isChargingRetryRelevant(v,{...c,title:'changed'},new Date(due)),false);
 v.devices[0].sessions[0].finishedAt=due;assert.equal(isChargingRetryRelevant(v,c,new Date(due)),false);
});
test('charging: reject overlapping sessions, duplicate IDs, invalid states, durations and dates',()=>{
 for(const change of [d=>d.sessions.push({...d.sessions[0],id:'cs_other-qa'}),d=>d.sessions.push({...d.sessions[0]}),d=>d.maxMinutes=0,d=>d.maxMinutes=1.5,d=>d.maxMinutes=10081,d=>d.archived=true,d=>d.deleted=true,d=>d.sessions[0].finishedAt='2026-10-16T00:00:00Z',d=>d.sessions[0].startedAt='today']) {
  const v=fixture();change(v.devices[0]);assert.throws(()=>validateCharging(v));
 }
 assert.deepEqual(readCharging(null),emptyCharging());
});
test('charging: restoring an old active snapshot preserves history but pauses physical reminders',()=>{
 const v=fixture(),restored=restoreCharging(v);assert.equal(restored.devices[0].paused,true);
 assert.deepEqual(restored.devices[0].sessions,v.devices[0].sessions);assert.equal(v.devices[0].paused,false);
});
test('charging: unified backups validate and retain devices; older backups preserve absent charging',()=>{
 const payload=createBackupPayload(key=>key===CHARGING_KEY?JSON.stringify(fixture()):null);
 const plan=parseAndValidateBackupText(JSON.stringify(payload));assert.ok(plan.entries.some(([k])=>k===CHARGING_KEY));
 delete payload.data[CHARGING_KEY];assert.equal(parseAndValidateBackupText(JSON.stringify(payload)).entries.some(([k])=>k===CHARGING_KEY),false);
});
test('charging store: a lost response can be retried identically without duplicating the active session',async()=>{
 const previous=globalThis.localStorage,cache=new Map();globalThis.localStorage={getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v)};
 try {
  let cloud=null,lost=true;const app={auth:{user:{id:'owner'},readyUserId:'owner',syncGeneration:1,flushPendingKeySync:async()=>true,supabase:{rpc:async(_name,p)=>{
   if(!cloud)cloud=structuredClone(p.p_value);
   else assert.deepEqual(cloud,p.p_value);
   if(lost){lost=false;return {error:{message:'response lost'}};}
   return {data:{workspace:cloud,documentRevision:2}};
  }}}};
  const store=new PlanningStore(app,CHARGING_KEY),v=fixture();v.revision=0;
  await assert.rejects(store.save(v,0),/No se confirmó/);assert.equal(cache.size,0);
  await store.save(v,0);assert.equal(store.value.devices[0].sessions.length,1);assert.equal(app.auth.planningWriteCount,0);
 } finally {globalThis.localStorage=previous;}
});
test('charging store: an old response cannot populate another signed-in account',async()=>{
 const previous=globalThis.localStorage,cache=new Map();globalThis.localStorage={getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v)};
 try {
  let resolve;const app={auth:{user:{id:'first'},readyUserId:'first',syncGeneration:1,flushPendingKeySync:async()=>true,supabase:{rpc:()=>new Promise(r=>resolve=r)}}};
  const store=new PlanningStore(app,CHARGING_KEY),v=fixture();v.revision=0;const pending=store.save(v,0);
  while(!resolve)await Promise.resolve();app.auth.user.id='second';app.auth.readyUserId='second';app.auth.syncGeneration++;
  resolve({data:{workspace:{...v,revision:1},documentRevision:2}});await assert.rejects(pending,/sesión cambió/);assert.equal(cache.size,0);
 } finally {globalThis.localStorage=previous;}
});
