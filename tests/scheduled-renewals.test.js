const test=require('node:test'),assert=require('node:assert/strict');
const {SubscriptionRenewalWorker}=require('../subscription-renewal-worker');
const {normalizeSubscription}=require('../subscription-utils.mjs');
const {getDueTradingEventNotices,buildTradingEventAlertKey,parseTradingEventAlertKey,isTradingRetryRelevant}=require('../trading-event-utils');
const event={id:'trade_qa_schedule',company:'QA',name:'Evento',scheduledAt:'2026-12-01T21:00:00Z',noticeDays:[1,7],noticeTimes:['09:00','18:00'],status:'active'};
test('Trading uses Argentina calendar dates, independent hours, expiry and stable one-to-many keys',()=>{
 assert.deepEqual(getDueTradingEventNotices(event,'2026-11-30T11:59:59Z'),[]);
 const first=getDueTradingEventNotices(event,'2026-11-30T12:05:00Z')[0];
 assert.equal(first.time,'09:00');assert.equal(first.scheduledAt,'2026-11-30T12:00:00.000Z');
 assert.equal(first.alertKey,buildTradingEventAlertKey(event,1,'09:00'));
 assert.equal(buildTradingEventAlertKey({...event,noticeTimes:['09:00']},1,'09:00'),first.alertKey);
 assert.deepEqual(getDueTradingEventNotices(event,'2026-11-30T12:15:00Z'),[]);
 assert.equal(getDueTradingEventNotices(event,'2026-11-30T21:03:00Z')[0].time,'18:00');
 assert.equal(parseTradingEventAlertKey(first.alertKey).time,'09:00');
 assert.deepEqual(getDueTradingEventNotices({...event,status:'paused'},'2026-11-30T12:05:00Z'),[]);
 assert.deepEqual(getDueTradingEventNotices(event,'2026-12-01T12:05:00Z'),[]);
 assert.equal(getDueTradingEventNotices({...event,scheduledAt:'2026-12-02T01:00:00Z',noticeTimes:['09:00']},'2026-11-30T12:03:00Z').length,1);
});
test('Trading retries stop after pause, removal, changed hour/date or expiration',()=>{
 const now='2026-11-30T12:05:00Z',key=getDueTradingEventNotices(event,now)[0].alertKey;
 const snap=e=>({finanzasData:JSON.stringify({tradingEvents:[e]})});
 assert.equal(isTradingRetryRelevant(key,snap(event),now),true);
 for(const e of [{...event,status:'paused'},{...event,noticeTimes:['18:00']},{...event,scheduledAt:'2026-12-02T21:00:00Z'}])assert.equal(isTradingRetryRelevant(key,snap(e),now),false);
 assert.equal(isTradingRetryRelevant(key,{finanzasData:'{"tradingEvents":[]}'},now),false);
 assert.equal(isTradingRetryRelevant(key,snap(event),'2026-11-30T12:16:00Z'),false);
});
test('Existing Trading events preserve the legacy key without fabricating slots',()=>{
 const legacy={...event,noticeTimes:[]},notice=getDueTradingEventNotices(legacy,'2026-11-30T21:01:00Z')[0];
 assert.equal(notice.alertKey,buildTradingEventAlertKey(legacy,1));assert.equal(notice.time,undefined);
});
function fixture(overrides={},options={}){
 const calls=[];const sub=normalizeSubscription({id:'sub_qa_worker',name:'QA worker',cost:10,autoRenew:true,autoRecordExpense:true,nextRenewalDate:'2026-10-01',...overrides});
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{created:true,duplicate:false,next_date:'2026-11-01'},error:null};}};
 return {calls,sub,db,rows:[{user_id:'qa-only',data:{lifecycle_subscriptions:JSON.stringify({version:3,subscriptions:[sub]})}}],worker:new SubscriptionRenewalWorker(db,options)};
}
test('Automatic renewals execute without a browser or Push device and use bounded catchup',async()=>{
 const f=fixture();const result=await f.worker.run(f.rows,{now:new Date('2026-10-18T15:00:00Z')});
 assert.equal(result.summary.processed,1);assert.deepEqual([...result.changed],['qa-only']);assert.equal(f.calls[0].args.p_due_date,'2026-10-01');
 const bounded=fixture({}, {maxOperations:2});bounded.db.rpc=async()=>({data:{created:false,duplicate:true,next_date:null}});
 const duplicate=await bounded.worker.run(bounded.rows,{now:new Date('2026-10-18T15:00:00Z')});assert.equal(duplicate.summary.duplicates,1);
});
test('Disabled, paused, free, trial, future and manual subscriptions are skipped',async()=>{
 for(const patch of [{status:'paused'},{status:'canceled'},{autoRenew:false},{autoRecordExpense:false},{billingMode:'free'},{billingMode:'trial'},{nextRenewalDate:'2027-01-01'}]) {
  const f=fixture(patch);await f.worker.run(f.rows,{now:new Date('2026-10-18T15:00:00Z')});assert.equal(f.calls.length,0);
 }
});
test('ARS requires a valid current rate; RPC errors retain a visible failure and never advance local data',async()=>{
 const f=fixture({currency:'ARS',cost:15000},{resolveRate:async()=>1500});
 await f.worker.run(f.rows,{now:new Date('2026-10-18T15:00:00Z')});assert.equal(f.calls[0].args.p_ars_per_usd,1500);
 const fail=fixture({currency:'ARS'},{resolveRate:async()=>{throw new Error('offline');}}),before=structuredClone(fail.rows);
 const result=await fail.worker.run(fail.rows,{now:new Date('2026-10-18T15:00:00Z')});assert.equal(result.summary.failed,1);assert.equal(fail.calls.length,0);assert.deepEqual(fail.rows,before);assert.equal(fail.worker.snapshot().consecutiveFailures,1);
});
