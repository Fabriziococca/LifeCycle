import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSubscription, advanceSubscriptionRenewal, subscriptionNoticeDue, subscriptionAlertTimes, subscriptionTrackingDue, subscriptionClientActive, isExpenseSubscription, CLIENT_SUBSCRIPTION_NOTICE_DAYS } from '../subscription-utils.mjs';
import { SubscriptionRenewalWorker } from '../subscription-renewal-worker.js';
import { isPushRetryRelevant } from '../notification-utils.js';
const clientId='11111111-1111-4111-8111-111111111111';
const subscription=()=>normalizeSubscription({id:'sub_client_qa',clientId,name:'Webshare QA',billingMode:'tracking',periodDays:30,nextRenewalDate:'2026-11-04',renewalTime:'17:47',alert:{enabled:true,times:['22:00'],noticeDays:[...CLIENT_SUBSCRIPTION_NOTICE_DAYS]}});

test('exact-day client cycles preserve anchors, hours and original month-based subscriptions',()=>{
 let s=subscription();assert.equal(s.clientId,clientId);assert.equal(s.renewalTime,'17:47');assert.equal(s.paymentMethod,'');
 for(const day of ['2026-12-04','2027-01-03','2027-02-02']){s=advanceSubscriptionRenewal(s);assert.equal(s.nextRenewalDate,day);assert.equal(s.history.length,0);}
 assert.equal(advanceSubscriptionRenewal(normalizeSubscription({id:'sub_monthly',nextRenewalDate:'2026-01-31',periodMonths:1})).nextRenewalDate,'2026-02-28');
});
test('progressive notices happen on exactly 7, 5, 3, 2, 1, 0 days and preserve legacy daily notices',()=>{
 const s=subscription();for(let d=-1;d<=10;d++)assert.equal(subscriptionNoticeDue(s,d),CLIENT_SUBSCRIPTION_NOTICE_DAYS.includes(d));
 const legacy=normalizeSubscription({alert:{daysBefore:3}});for(let d=0;d<=3;d++)assert.equal(subscriptionNoticeDue(legacy,d),true);assert.equal(subscriptionNoticeDue(legacy,4),false);
 assert.deepEqual(subscriptionAlertTimes(s,1),['22:00']);assert.deepEqual(subscriptionAlertTimes(s,0),['17:47']);
 assert.deepEqual(subscriptionAlertTimes({...s,alert:{...s.alert,times:['09:00','18:00','23:00']}},0),['09:00','17:47']);
});
test('expense-free rollover waits for the final notice window and respects pause, cancel and archive',()=>{
 const s=subscription();assert.equal(subscriptionTrackingDue(s,'2026-11-04T18:01:59-03:00'),false);assert.equal(subscriptionTrackingDue(s,'2026-11-04T18:02:00-03:00'),true);
 for(const status of ['paused','canceled'])assert.equal(subscriptionTrackingDue({...s,status},'2026-11-05T22:00:00-03:00'),false);
 assert.equal(subscriptionClientActive(s,[{id:clientId,archived:true}]),false);assert.equal(subscriptionClientActive(s,[]),false);assert.equal(subscriptionClientActive(s,[{id:clientId,archived:false}]),true);
 const snap={lifecycle_subscriptions:{subscriptions:[s]},_subscriptionClients:[{id:clientId,archived:true}]};assert.equal(isPushRetryRelevant('sub_'+s.id,snap),false);
});
test('tracking renews with no browser, no Push device and no exchange rate or expense RPC',async()=>{
 const s=subscription(),calls=[];
 const worker=new SubscriptionRenewalWorker({rpc:async(name,args)=>{calls.push({name,args});return {data:{created:true,next_date:'2026-12-04'},error:null};}},{resolveRate:async()=>{throw Error('Tracking must not request currency');}});
 const rows=[{user_id:'qa-only',data:{lifecycle_subscriptions:{subscriptions:[s]},finanzasData:{expenses:[]}}}],before=structuredClone(rows);
 const result=await worker.run(rows,{now:new Date('2026-11-04T18:05:00-03:00'),clientStates:new Map([['qa-only',[{id:clientId,archived:false}]]])});
 assert.equal(result.summary.processed,1);assert.equal(calls[0].name,'advance_subscription_tracking_for_scheduler');assert.deepEqual(rows,before);
 calls.length=0;await worker.run(rows,{now:new Date('2026-11-04T18:05:00-03:00'),clientStates:new Map([['qa-only',[{id:clientId,archived:true}]]])});assert.equal(calls.length,0);
});

test('client prices are informational even in older paid records; dates, cost and history survive',()=>{
 const raw={...subscription(),billingMode:'paid',cost:99,currency:'ARS',autoRecordExpense:true,history:[{id:'existing',type:'created',occurredAt:'2026-11-01T00:00:00Z',effectiveDate:'2026-11-01',cost:99,currency:'ARS'}]};
 const s=normalizeSubscription(raw);
 assert.equal(isExpenseSubscription(raw),false);assert.equal(isExpenseSubscription(s),false);
 assert.equal(s.cost,99);assert.equal(s.currency,'ARS');assert.equal(s.autoRecordExpense,false);
 assert.equal(s.nextRenewalDate,raw.nextRenewalDate);assert.equal(s.history[0].id,'existing');
 assert.equal(subscriptionTrackingDue(raw,'2026-11-05T22:00:00-03:00'),true);
 assert.equal(isExpenseSubscription({...raw,clientId:undefined}),true);
});

test('old paid client subscriptions use expense-free rollover while own paid renewals still record expenses',async()=>{
 const client={...subscription(),billingMode:'paid',cost:100,currency:'ARS',autoRecordExpense:true};
 const own={...client,id:'sub_own_paid',clientId:undefined,currency:'USD'};
 const calls=[],worker=new SubscriptionRenewalWorker({rpc:async(name,args)=>{calls.push(name);return {data:{created:true,next_date:'2026-12-04'}};}},{resolveRate:async()=>{throw Error('Client price must never require an exchange rate');}});
 const rows=[{user_id:'qa-only',data:{lifecycle_subscriptions:{subscriptions:[client,own]},finanzasData:{expenses:[]}}}],before=structuredClone(rows);
 await worker.run(rows,{now:new Date('2026-11-05T22:00:00-03:00'),clientStates:new Map([['qa-only',[{id:clientId,archived:false}]]])});
 assert.deepEqual(calls,['advance_subscription_tracking_for_scheduler','renew_subscription_for_scheduler']);assert.deepEqual(rows,before);
});
