import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';
import { emptyWork } from '../work-utils.mjs';
import { emptyAppointments } from '../appointments-utils.mjs';
const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);insert into auth.users(id) values('${a}'),('${b}');
 create table public.user_data(user_id uuid primary key,data jsonb not null default '{}',updated_at timestamptz default now(),revision bigint default 1);
 create table private.lifecycle_access_profiles(user_id uuid,access_tier text);
 grant usage on schema public,auth to authenticated,anon,service_role;`);
 for(const file of ['20261014191358_personal_planning.sql','20261017183000_work_workspace.sql','20261017220000_charging_controls.sql','20261020164626_client_maintenance_and_health_appointments.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`set request.jwt.claim.sub='${a}';set role authenticated`);
 const saveAgenda=async(v,r)=>(await db.query("select public.save_lifecycle_planning('lifecycle_appointments',$1,$2) as v",[r,v])).rows[0].v;
 const e={id:'ha_test-event',name:'QA appointment',professional:'',location:'',locationUrl:'https://maps.app.goo.gl/qa-location',notes:'',trackerId:'',date:'2026-10-30',time:'18:00',kind:'consultation',status:'pending',paused:false,archived:false,scheduleVersion:1,stages:[{days:15,times:['09:00','18:00']}]};
 const agenda={...emptyAppointments(),revision:1,events:[e]};
 assert.equal((await saveAgenda(agenda,0)).workspace.events[0].locationUrl,e.locationUrl,'existing SQL RPC preserves optional location link without a migration');
 assert.equal((await saveAgenda(agenda,0)).workspace.revision,1,'lost-response retry is idempotent');
 await assert.rejects(saveAgenda({...agenda,revision:2},0),/conflict/);
 for(const patch of [{date:'2026-02-30'},{time:'25:00'},{stages:[{days:7,times:['09:00','09:00']}]},{stages:[{days:7,times:['09:00']},{days:7,times:['18:00']}]},{paused:null},{status:'done',completedOn:'2050-01-01'}])await assert.rejects(saveAgenda({...agenda,revision:2,events:[{...e,...patch}]},1));
 const f={id:'44444444-4444-4444-8444-444444444444',clientId:cid,title:'QA routine',actor:'me',status:'open',priority:'normal',reviewOn:'2026-01-01',promisedOn:'',reminderEnabled:true,reminderTime:'09:00',maintenance:{version:1,scheduleVersion:1,instructions:'',paused:false,archived:false,times:['09:00','18:00'],cadence:{type:'interval',every:1,unit:'weeks',anchor:'completion',anchorDate:'2026-01-01'},history:[]}};
 const work={...emptyWork(),revision:1,clients:[{id:cid,name:'QA',contact:'',context:'',archived:false}],followups:[f]};
 const saveWork=async(w,r)=>(await db.query('select public.save_work_state($1,$2) as v',[w,r])).rows[0].v;
 await saveWork(work,0);
 for(const patch of [{times:['25:00']},{cadence:{type:'weekly',anchorDate:'2026-01-01',days:[]}},{history:[{id:'mh_bad'}]}])await assert.rejects(saveWork({...work,revision:2,followups:[{...f,maintenance:{...f.maintenance,...patch}}]},1));
 // The Work restore RPC must roll back both documents when one is invalid.
 await assert.rejects(db.query('select public.save_work_state($1,1,$2)',[{...work,revision:2},{lifecycle_appointments:JSON.stringify({...agenda,revision:2,events:[{...e,time:'99:00'}]})}]));
 assert.equal((await db.query('select public.get_work_state() as v')).rows[0].v.revision,1);
 await db.exec(`reset role;set role service_role`);
 assert.equal((await db.query("select * from public.work_notification_states('2026-10-20T21:04:00Z')")).rows.length,1,'second daily time is selected in SQL');
 assert.equal((await db.query("select * from public.work_notification_states('2026-10-20T21:15:00Z')")).rows.length,0);
 await db.exec(`reset role;set request.jwt.claim.sub='${b}';set role authenticated`);
 assert.deepEqual((await db.query('select public.get_work_state() as v')).rows[0].v,emptyWork());
 const snapshot=(await db.query('select public.work_backup_snapshot() as v')).rows[0].v;
 assert.equal(snapshot.personal.lifecycle_appointments,undefined,'another owner cannot read agenda');
 await assert.rejects(db.query('select * from public.work_notification_states()'),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(saveAgenda(agenda,0),/permission denied/);
 console.log('Care SQL passed: owner isolation, validation, CAS, retry, multi-time candidates and atomic restore.');
} catch(error) { console.error(JSON.stringify({message:error.message,detail:error.detail,where:error.where}));process.exitCode=1; }
finally {await db.close();}
