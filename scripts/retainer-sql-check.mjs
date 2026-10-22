import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';
import { emptyWork } from '../work-utils.mjs';
import { confirmRetainer, relinkProject } from '../retainer-utils.mjs';
const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);insert into auth.users(id) values('${a}'),('${b}');
 create table public.user_data(user_id uuid primary key,data jsonb not null default '{}',updated_at timestamptz default now(),revision bigint default 1);
 create table private.lifecycle_access_profiles(user_id uuid,access_tier text);
 grant usage on schema public,auth to authenticated,anon,service_role;`);
 for(const file of ['20261014191358_personal_planning.sql','20261017183000_work_workspace.sql','20261017220000_charging_controls.sql','20261020164626_client_maintenance_and_health_appointments.sql','20261022004255_client_retainer_billing.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query('insert into public.user_data(user_id,data) values($1,$2)',[a,{projectPulseData:JSON.stringify([{id:'p1',project:'QA'}])}]);
 await db.exec(`set request.jwt.claim.sub='${a}';set role authenticated`);
 const r={id:'44444444-4444-4444-8444-444444444444',version:1,scheduleVersion:1,title:'QA monthly',tasks:'QA',currency:'USD',amountMinor:20000,billingDay:31,nextDue:'2026-01-31',projectIds:['p1'],paused:false,archived:false,reminderEnabled:true,times:['09:00','18:00'],payments:[]};
 const state={...emptyWork(),revision:1,clients:[{id:cid,name:'QA',contact:'',context:'',archived:false,retainers:[r]}],links:[{clientId:cid,projectId:'p1'}]};
 const save=async(s,rev)=>(await db.query('select public.save_work_state($1,$2) as v',[s,rev])).rows[0].v;
 assert.deepEqual(await save(state,0),state,'new link and contract validate together');
 await db.exec('reset role;set role service_role');
 assert.equal((await db.query("select * from public.work_notification_states('2026-01-31T21:04:00Z')")).rows.length,1,'billing-only account is selected at second daily time');
 assert.equal((await db.query("select * from public.work_notification_states('2026-01-31T21:15:00Z')")).rows.length,0,'expired time is excluded');
 await db.exec('reset role;set role authenticated');
 const paid=confirmRetainer(r,{id:crypto.randomUUID(),dueOn:r.nextDue,receivedOn:r.nextDue,today:r.nextDue,clientName:'QA'});
 const next={...state,revision:2,clients:[{...state.clients[0],retainers:[paid]}]};
 assert.deepEqual(await save(next,1),next);assert.deepEqual(await save(next,1),next,'lost response retries return one receipt');
 const snapshot=(await db.query('select public.work_backup_snapshot() as v')).rows[0].v;
 assert.equal(snapshot.work.clients[0].retainers[0].payments.length,1);assert.equal(snapshot.personal.finanzasData,undefined,'no duplicate ledger write');
 for(const patch of [{times:['25:00']},{amountMinor:0},{billingDay:32},{projectIds:['other']},{nextDue:'2026-02-30'},{payments:[...paid.payments,...paid.payments]}])await assert.rejects(save({...next,revision:3,clients:[{...next.clients[0],retainers:[{...paid,...patch}]}]},2));
 assert.equal((await db.query('select public.get_work_state() as v')).rows[0].v.revision,2,'failed validation rolls back whole revision');
 await assert.rejects(save({...next,revision:3,notes:[{id:crypto.randomUUID(),clientId:cid,kind:'note',body:'stale'}]},1),/conflict/);
 const detached=relinkProject(next,'p1','');detached.revision=3;await save(detached,2);
 assert.deepEqual((await db.query('select public.get_work_state() as v')).rows[0].v.clients[0].retainers[0].payments[0].projectIds,['p1'],'historical receipt keeps original project');
 await db.exec(`reset role;set request.jwt.claim.sub='${b}';set role authenticated`);
 assert.deepEqual((await db.query('select public.get_work_state() as v')).rows[0].v,emptyWork());
 assert.equal((await db.query('select count(*) as n from public.work_clients')).rows[0].n,0,'RLS hides other owner');
 await assert.rejects(db.query('select * from public.work_notification_states()'),/permission denied/);
 await assert.rejects(db.query('update public.work_clients set record=record'),/permission denied/);
 console.log('Retainer SQL passed: transactional validation, owner isolation, billing-only scheduler, duplicate receipt prevention, CAS/retry, backup and safe relinking.');
} catch(e) {console.error({message:e.message,detail:e.detail,where:e.where});process.exitCode=1;}
finally {await db.close();}

