import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';
import {normalizeSubscription,advanceSubscriptionRenewal} from '../subscription-utils.mjs';
const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create table public.user_data(user_id uuid primary key references auth.users(id),data jsonb not null default '{}',revision bigint default 1,updated_at timestamptz default now());
 create function private.bump_revision() returns trigger language plpgsql as $$begin new.revision:=old.revision+1;return new;end;$$;
 create trigger bump_revision before update on public.user_data for each row execute function private.bump_revision();
 grant usage on schema public,auth to authenticated,anon,service_role;`);
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 for(const name of ['20260809062605_tanda_8_trading_projection.sql','20260829201218_expand_trading_projection_capacity.sql','20261018050000_trading_times_and_subscription_renewals.sql'])
  await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const sub=normalizeSubscription({id:'sub_qa_renewal',name:'QA renovación',cost:12,currency:'USD',nextRenewalDate:'2026-01-31',startDate:'2026-01-31',autoRenew:true,autoRecordExpense:true});
 const finance={entries:[{id:'income-preserved'}],expenses:[],accounts:[{id:'account-preserved'}],tradingEvents:[]};
 const doc={unrelated:['preserved'],finanzasData:JSON.stringify(finance),lifecycle_subscriptions:JSON.stringify({version:3,subscriptions:[sub]})};
 await db.query('insert into public.user_data values($1,$2,1,now()),($3,$4,1,now())',[a,doc,b,{unrelated:'other-owner'}]);
 const read=async()=> (await db.query('select data,revision from public.user_data where user_id=$1',[a])).rows[0];
 const automatic=async(date,rate=null)=>(await db.query('select public.renew_subscription_for_scheduler($1,$2,$3,$4) result',[a,sub.id,date,rate])).rows[0].result;
 await db.exec('set role service_role');
 let result=await automatic('2026-01-31');assert.equal(result.created,true);assert.equal(result.next_date,'2026-02-28');
 result=await automatic('2026-01-31');assert.equal(result.duplicate,true);assert.equal(result.created,false);
 await automatic('2026-02-28');
 await db.exec('reset role');
 let row=await read(),f=JSON.parse(row.data.finanzasData),reg=JSON.parse(row.data.lifecycle_subscriptions);
 assert.equal(f.expenses.length,2);assert.equal(reg.subscriptions[0].nextRenewalDate,'2026-03-31');
 assert.deepEqual(f.entries,finance.entries);assert.deepEqual(f.accounts,finance.accounts);assert.deepEqual(row.data.unrelated,doc.unrelated);
 assert.equal(reg.subscriptions[0].history.filter(e=>e.type==='expense-recorded').length,2);
 const noChange=row.revision;await db.exec('set role service_role');await automatic('2026-01-31');await db.exec('reset role');assert.equal((await read()).revision,noChange);
 // The manual path races the same period and observes its committed occurrence.
 await db.exec(`set request.jwt.claim.sub='${a}';set role authenticated`);
 result=(await db.query("select public.record_subscription_expense($1,'QA',12,'2026-01-31',$2) result",[sub.id,'subscription:'+sub.id+':renewal:2026-01-31'])).rows[0].result;
 assert.equal(result.duplicate,true);assert.equal(result.subscription_registry.subscriptions[0].nextRenewalDate,'2026-03-31');
 await assert.rejects(automatic('2026-03-31'),/permission denied/);
 await db.exec(`reset role;set request.jwt.claim.sub='${b}';set role authenticated`);
 await assert.rejects(db.query("select public.record_subscription_expense($1,'QA',12,'2026-03-31',$2)",[sub.id,'subscription:'+sub.id+':renewal:2026-03-31']),/not found/);
 await db.exec('reset role;set role anon');await assert.rejects(automatic('2026-03-31'),/permission denied/);await db.exec('reset role');
 // Pauses, cancellation, disabled flags, free/trial, invalid rates and future
 // dates never create an expense or advance a date.
 for(const patch of [{status:'paused'},{status:'canceled'},{autoRecordExpense:false},{autoRenew:false},{billingMode:'free'},{billingMode:'trial'},{currency:'ARS'}]) {
  const candidate={...sub,...patch};const d={...doc,lifecycle_subscriptions:{version:3,subscriptions:[candidate]}};
  await db.query('update public.user_data set data=$2 where user_id=$1',[a,d]);
  await db.exec('set role service_role');await assert.rejects(automatic('2026-01-31'));await db.exec('reset role');
  assert.deepEqual((await read()).data,d);
 }
 // ARS conversion and all month-end anchors agree with the client calculator.
 for(const date of ['2024-01-31','2024-02-29','2025-02-28','2026-04-30','2026-08-29']) {
  const candidate=normalizeSubscription({...sub,currency:'ARS',cost:15000,nextRenewalDate:date,billingAnchorDay:31,billingAnchorIsMonthEnd:true});
  await db.query('update public.user_data set data=$2 where user_id=$1',[a,{...doc,lifecycle_subscriptions:{version:3,subscriptions:[candidate]}}]);
  await db.exec('set role service_role');result=await automatic(date,1500);await db.exec('reset role');
  assert.equal(result.next_date,advanceSubscriptionRenewal(candidate,date).nextRenewalDate);
  f=JSON.parse((await read()).data.finanzasData);assert.equal(f.expenses[0].amount,10);assert.equal(f.expenses[0].exchangeRate,1500);
 }
 // A legacy accepted Trading notice covers only the original hour, not other
 // newly configured slots. Two different slots can be reserved independently.
 const event={id:'trade_qa_times',company:'QA',name:'Evento',scheduledAt:'2026-12-01T21:00:00Z',noticeDays:[1],noticeTimes:['09:00','18:00'],status:'active'};
 await db.query('update public.user_data set data=$2 where user_id=$1',[a,{...doc,finanzasData:JSON.stringify({...finance,tradingEvents:[event]})}]);
 assert.deepEqual((await db.query('select notice_times from public.trading_events where user_id=$1',[a])).rows[0].notice_times,['09:00','18:00']);
 const key='trading_event:trade_qa_times:20261201T210000000Z:1d';
 const claim=async(k)=>(await db.query("select public.claim_trading_notification_dispatch($1,$2,$3,$4,1) ok",[a,k,event.id,event.scheduledAt])).rows[0].ok;
 await db.exec('set role service_role');assert.equal(await claim(key),true);
 await db.query("select public.complete_trading_notification_dispatch($1,$2,'sent')",[a,key]);
 assert.equal(await claim(key+'@18:00'),false);assert.equal(await claim(key+'@09:00'),true);assert.equal(await claim(key+'@09:00'),false);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select data from public.user_data where user_id=$1',[b])).rows[0].data,{unrelated:'other-owner'});
 console.log('SQL passed: atomic manual/server idempotence, billing anchors/leap years, ARS, flags, grants, isolation, exact unrelated-data preservation, Trading projection/slot claims and legacy compatibility.');
} finally {await db.close();}
