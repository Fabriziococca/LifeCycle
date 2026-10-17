import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';
import { validateCharging, readCharging } from '../charging-utils.mjs';
import { createEmptyCustomTrackerRegistry, createCustomTracker, normalizeCustomTrackerRegistry } from '../custom-tracker-utils.mjs';
const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',friend='22222222-2222-4222-8222-222222222222';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.user_data(user_id uuid primary key,data jsonb not null default '{}',updated_at timestamptz default now(),revision bigint default 1);
 create table private.lifecycle_access_profiles(user_id uuid,access_tier text);
 grant usage on schema public,auth to authenticated,anon;
 create function private.bump_revision() returns trigger language plpgsql as $$begin new.revision:=old.revision+1;return new;end;$$;
 create trigger bump_revision before update on public.user_data for each row execute function private.bump_revision();`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261014191358_personal_planning.sql',import.meta.url),'utf8'));
 await db.query("insert into private.lifecycle_access_profiles values($1,'owner')",[owner]);
 await db.query("insert into public.user_data(user_id,data) values($1,'{\"tareas_list\":\"[]\"}'),($2,'{}')",[owner,friend]);
 const migration=await readFile(new URL('../supabase/migrations/20261017220000_charging_controls.sql',import.meta.url),'utf8');await db.exec(migration);
 let seeded=(await db.query('select data from public.user_data where user_id=$1',[owner])).rows[0].data;
 assert.equal(seeded.tareas_list,'[]');validateCharging(seeded.lifecycle_charging);
 assert.deepEqual(seeded.lifecycle_charging.devices.map(d=>[d.maxMinutes,d.sessions.length]),[[180,0],[null,0]]);
 assert.equal((await db.query('select data from public.user_data where user_id=$1',[friend])).rows[0].data.lifecycle_charging,undefined);
 await db.exec(`set request.jwt.claim.sub='${owner}';set role authenticated`);
 const save=async(v,revision)=>(await db.query("select public.save_lifecycle_planning('lifecycle_charging',$1,$2) as result",[revision,v])).rows[0].result;
 const next=structuredClone(seeded.lifecycle_charging);next.revision=2;next.devices[0].sessions.push({id:'cs_fixture-qa',startedAt:'2026-10-17T15:00:00.000Z',finishedAt:null,limitMinutes:180});
 const result=await save(next,1);assert.equal(result.workspace.revision,2);assert.equal((await save(next,1)).documentRevision,result.documentRevision);
 await assert.rejects(save({...next,revision:2,devices:[]},1),/conflict/);
 for(const change of [d=>d.sessions.push({...d.sessions[0],id:'cs_another-qa'}),d=>d.archived=true,d=>d.deleted=true,d=>d.maxMinutes=0,d=>delete d.maxMinutes,d=>delete d.sessions[0].finishedAt,d=>d.sessions[0].finishedAt='2026-10-16T00:00:00Z']) {
  const bad=structuredClone(next);bad.revision=3;change(bad.devices[0]);await assert.rejects(save(bad,2));
 }
 await db.query('select public.merge_user_data_keys($1,$2)',[{lifecycle_charging:JSON.stringify(next)},[]]);
 await assert.rejects(db.query('select public.merge_user_data_keys($1,$2)',[{},['lifecycle_charging']]),/explicit versioned/);
 const restored={...next,revision:3};restored.devices[0].paused=true;
 await db.query('select public.merge_user_data_keys($1,$2)',[{lifecycle_charging:JSON.stringify(restored)},[]]);
 await db.exec(`reset role;set request.jwt.claim.sub='${friend}';set role authenticated`);
 await save({version:1,revision:1,devices:[]},0);
 await db.exec('reset role;set role anon');await assert.rejects(save(next,1),/permission denied/);
 await db.exec('reset role;set role service_role');await assert.rejects(save(next,1),/permission denied/);
 await db.exec('reset role');
 assert.equal(readCharging((await db.query('select data from public.user_data where user_id=$1',[owner])).rows[0].data.lifecycle_charging).revision,3);
 const registry=createEmptyCustomTrackerRegistry();
 registry.trackers.push(createCustomTracker({name:'Computadora (Teclado y Ext.)',actionLabel:'Registrar limpieza',section:'hygiene',template:'routine',cadence:{unit:'days',value:21},thresholds:{mode:'automatic',red:21}},{id:'trk_original-exterior'}));
 registry.histories['trk_original-exterior']=['2026-10-01T15:00:00.000Z'];
 const weekly=await readFile(new URL('../supabase/migrations/20261017223000_owner_computer_weekly_cards.sql',import.meta.url),'utf8');
 const friendBefore=(await db.query('select data from public.user_data where user_id=$1',[friend])).rows[0].data;
 for(const stringFormat of [true,false]) {
  const original={legacyRetained:['2026-09-01T00:00:00Z'],__trackers_v2:registry};
  const rowBefore=(await db.query('select data from public.user_data where user_id=$1',[owner])).rows[0].data;
  await db.query("update public.user_data set data=data||jsonb_build_object('hygiene_tracker_data',$2::jsonb) where user_id=$1",[owner,JSON.stringify(stringFormat?JSON.stringify(original):original)]);
  await db.exec(weekly);
  const updated=(await db.query('select data,revision from public.user_data where user_id=$1',[owner])).rows[0],raw=updated.data.hygiene_tracker_data,h=stringFormat?JSON.parse(raw):raw;
  assert.deepEqual(h.legacyRetained,original.legacyRetained);normalizeCustomTrackerRegistry(h.__trackers_v2,{strict:true});
  assert.deepEqual(h.__trackers_v2.trackers[0],registry.trackers[0]);assert.deepEqual(h.__trackers_v2.histories['trk_original-exterior'],registry.histories['trk_original-exterior']);
  for(const card of h.__trackers_v2.trackers.slice(1)){assert.equal(card.intervalDays,7);assert.deepEqual(card.thresholds,{mode:'automatic',yellow:4,orange:5,red:7});assert.deepEqual(h.__trackers_v2.histories[card.id],[]);}
  const {hygiene_tracker_data:omit,...retained}=updated.data;const {hygiene_tracker_data:oldOmit,...expected}=rowBefore;assert.deepEqual(retained,expected);
  await db.exec(weekly);assert.equal((await db.query('select revision from public.user_data where user_id=$1',[owner])).rows[0].revision,updated.revision);
 }
 assert.deepEqual((await db.query('select data from public.user_data where user_id=$1',[friend])).rows[0].data,friendBefore);
 console.log('Charging SQL: seed preservation, row locking, idempotence, conflicts, atomic restore, validation, grants and account isolation passed.');
 console.log('Weekly computer cards: string/object formats, exact existing-card/history preservation, 7-day automatic thresholds, empty histories, account isolation and idempotence passed.');
} finally {await db.close();}
