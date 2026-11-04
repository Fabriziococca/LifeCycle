import {PGlite} from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(), owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', client='33333333-3333-4333-8333-333333333333';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.user_data(user_id uuid primary key,data jsonb,updated_at timestamptz,revision bigint default 1);
 create table public.work_clients(user_id uuid,id uuid,record jsonb);
 grant usage on schema public,auth to anon,authenticated,service_role;`);
 const old=await readFile(new URL('../supabase/migrations/20261018050000_trading_times_and_subscription_renewals.sql',import.meta.url),'utf8');
 await db.exec(old.slice(0,old.indexOf('alter table public.trading_events')));
 await db.exec(await readFile(new URL('../supabase/migrations/20261101031602_client_subscription_cycles.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261104045523_client_subscription_payer_boundary.sql',import.meta.url),'utf8'));
 await db.query('insert into public.work_clients values($1,$2,$3)',[owner,client,{archived:false}]);
 const base={id:'sub_sql_tracking',name:'QA local',clientId:client,billingMode:'tracking',status:'active',autoRenew:true,periodDays:30,nextRenewalDate:'2026-09-04',renewalTime:'17:47',alert:{enabled:true,times:['22:00']},history:[]};
 const put=async(sub,user=owner)=>db.query('insert into public.user_data(user_id,data) values($1,$2) on conflict(user_id) do update set data=excluded.data',[user,{sentinel:'preserved',lifecycle_subscriptions:JSON.stringify({version:4,subscriptions:[sub]}),finanzasData:'{"entries":[],"expenses":[]}'}]);
 const read=async(user=owner)=>(await db.query('select data from public.user_data where user_id=$1',[user])).rows[0].data;
 const advance=async(user=owner,date='2026-09-04')=>(await db.query('select public.advance_subscription_tracking_for_scheduler($1,$2,$3) as r',[user,base.id,date])).rows[0].r;
 await put(base);const before=await read();
 assert.equal((await advance()).next_date,'2026-10-04');assert.equal((await advance()).duplicate,true);
 let after=await read();assert.equal(after.finanzasData,before.finanzasData);assert.equal(after.sentinel,before.sentinel);
 assert.equal(JSON.parse(after.lifecycle_subscriptions).subscriptions[0].history.length,1);
 for(const patch of [{status:'paused'},{status:'canceled'},{autoRenew:false},{nextRenewalDate:'2099-01-01'}]){await put({...base,...patch});const old=await read();assert.equal((await advance(owner,patch.nextRenewalDate||base.nextRenewalDate)).skipped,true);assert.deepEqual(await read(),old);}
 await put(base,other);assert.equal((await advance(other)).skipped,true,'a client link from another owner cannot authorize a cycle');
 await put(base);await db.query("update public.work_clients set record='{"+'"archived":true'+"}'");assert.equal((await advance()).skipped,true);
 await db.query("update public.work_clients set record='{"+'"archived":false'+"}'");
 const paid={...base,billingMode:'paid',cost:20,currency:'USD',autoRecordExpense:true};await put(paid);
 const pay=async()=>(await db.query('select public.renew_subscription_for_scheduler($1,$2,$3,null) as r',[owner,base.id,base.nextRenewalDate])).rows[0].r;
 const clientBefore=await read();await assert.rejects(pay(),/paid by the client/);assert.deepEqual(await read(),clientBefore);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
 await assert.rejects(db.query('select public.record_subscription_expense($1,$2,20,$3,$4)',[base.id,'Ignored client price',base.nextRenewalDate,`subscription:${base.id}:renewal:${base.nextRenewalDate}`]),/paid by the client/);
 await db.exec('reset role');assert.deepEqual(await read(),clientBefore);
 assert.equal((await advance()).next_date,'2026-10-04');after=await read();assert.equal(after.finanzasData,clientBefore.finanzasData);assert.equal(JSON.parse(after.lifecycle_subscriptions).subscriptions[0].cost,20);
 await put({...paid,clientId:undefined});
 assert.equal((await pay()).next_date,'2026-10-04');assert.equal((await pay()).duplicate,true);
 after=await read();assert.equal(JSON.parse(after.finanzasData).expenses.length,1);assert.equal(JSON.parse(after.finanzasData).expenses[0].originalAmount,20);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(advance(),/permission denied/);await db.exec('reset role');}
 await put(base);await db.exec('set role service_role');assert.equal((await advance()).created,true);await assert.rejects(db.exec("select private.subscription_next_cycle('{}','2026-09-04')"),/permission denied/);await db.exec('reset role');
 console.log('Client subscription SQL: exact-day cycles, idempotency, no fabricated expenses, ownership, pause/archive, future dates and RPC permissions passed.');
} finally {await db.close();}
