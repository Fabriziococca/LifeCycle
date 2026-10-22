import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';
import { emptyWork } from '../work-utils.mjs';
const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);insert into auth.users(id) values('${a}'),('${b}');
 create table public.user_data(user_id uuid primary key,data jsonb not null default '{}',updated_at timestamptz default now(),revision bigint default 1);
 create table private.lifecycle_access_profiles(user_id uuid,access_tier text);
 grant usage on schema public,auth to authenticated,anon,service_role;`);
 for(const file of ['20261014191358_personal_planning.sql','20261017183000_work_workspace.sql','20261017220000_charging_controls.sql','20261020164626_client_maintenance_and_health_appointments.sql','20261022004255_client_retainer_billing.sql','20261022015610_unified_reminder_schedules.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));

 await db.exec(`set request.jwt.claim.sub='${a}';set role authenticated`);
 const save=async(value,revision)=>(await db.query('select public.save_work_state($1,$2) as v',[{...value,revision:revision+1},revision])).rows[0].v;
 let state={...emptyWork(),clients:[{id:cid,name:'QA',contact:'',context:'',archived:false}]};
 const item={id:'44444444-4444-4444-8444-444444444444',clientId:cid,title:'QA',actor:'me',status:'open',priority:'normal',reviewOn:'2026-10-21',promisedOn:'',reminderEnabled:true,reminderTime:'09:00',maintenance:{version:1,scheduleVersion:1,instructions:'QA',pushTitle:'QA',times:['09:00'],history:[],paused:false,archived:false,completed:false,repeatUntilDone:false,cadence:{type:'scheduled',anchorDate:'2026-10-21',schedule:{type:'once',date:'2026-10-21'}}}};
 const revision=()=>state.revision;
 state=await save({...state,followups:[item]},revision());
 for(const schedule of [{type:'weekly',days:[1,3]},{type:'monthly',day:31},{type:'yearly',month:2,day:29},{type:'interval',every:3,unit:'days',startDate:'2026-10-21'}]) {
  const next=structuredClone(state);next.followups[0].maintenance.cadence.schedule=schedule;
  state=await save(next,revision());
 }
 for(const schedule of [{type:'once',date:'2026-02-30'},{type:'weekly',days:[]},{type:'monthly',day:32},{type:'yearly',month:13,day:1},{type:'interval',every:0,unit:'days',startDate:'2026-10-21'}]) {
  const next=structuredClone(state);next.followups[0].maintenance.cadence.schedule=schedule;
  await assert.rejects(save(next,revision()));
 }
 const next=structuredClone(state);next.followups[0].maintenance.cadence={type:'interval',anchorDate:'2026-10-21',every:3,unit:'days',anchor:'completion'};
 state=await save(next,revision());
 const night=structuredClone(state);night.followups[0].maintenance.cadence={type:'scheduled',anchorDate:'2026-10-21',schedule:{type:'once',date:'2026-10-21'}};night.followups[0].maintenance.times=['23:55'];night.followups[0].reminderTime='23:55';state=await save(night,revision());
 await db.exec('reset role;set role service_role');
 assert.equal((await db.query("select * from public.work_notification_states('2026-10-22T03:05:00Z')")).rows.length,1);
 assert.equal((await db.query("select * from public.work_notification_states('2026-10-22T03:10:00Z')")).rows.length,0);
 await db.exec(`reset role;set request.jwt.claim.sub='${b}';set role authenticated`);
 assert.deepEqual((await db.query('select public.get_work_state() as v')).rows[0].v,emptyWork());
 await assert.rejects(db.query('select * from public.work_notification_states()'),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.get_work_state()'));
 console.log('Unified reminders SQL: calendar schedules, invalid input rollback, legacy compatibility and owner isolation passed.');
} finally {await db.close();}
