import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeFinancialValue} from '../financial-sync-utils.mjs';
import {FinanzasModule} from '../modules/FinanzasModule.js';
const expense={id:'automatic-period',autoRecorded:true,amount:1};
const sub={id:'sub_fixture',status:'active',nextRenewalDate:'2026-10-18',history:[]};
const advanced={...sub,nextRenewalDate:'2026-11-18',lastExpenseRecordedPeriod:'period',history:[{id:'expense-period',type:'expense-recorded',occurrenceKey:'period',occurredAt:'2026-10-18T12:00:00Z'}]};
test('durable stale financial queues preserve server renewals and pending local additions/deletions',()=>{
 const base={expenses:[{id:'old-manual',amount:2}],entries:[]};
 const local={expenses:[{id:'new-local',amount:3}],entries:[]};
 const remote={expenses:[...base.expenses,expense],entries:[{id:'new-income',amount:4}]};
 const result=mergeFinancialValue('finanzasData',base,JSON.stringify(local),JSON.stringify(remote));
 assert.deepEqual(new Set(result.expenses.map(e=>e.id)),new Set(['new-local','automatic-period']));
 assert.deepEqual(result.entries,remote.entries);
});
test('pausing an outdated subscription preserves a concurrent renewal date, history and occurrence marker',()=>{
 const result=mergeFinancialValue('lifecycle_subscriptions',{subscriptions:[sub]},
  {subscriptions:[{...sub,status:'paused'}]},{subscriptions:[advanced]});
 assert.deepEqual(result.subscriptions,[{...advanced,status:'paused'}]);
});
test('legacy queues with no persisted ancestor preserve previously unseen server renewals',()=>{
 const registry=mergeFinancialValue('lifecycle_subscriptions',undefined,{subscriptions:[{...sub,status:'paused'}]},{subscriptions:[advanced]});
 assert.deepEqual(registry.subscriptions,[{...advanced,status:'paused'}]);
 assert.deepEqual(mergeFinancialValue('finanzasData',undefined,{expenses:[],entries:[]},{expenses:[expense],entries:[]}).expenses,[expense]);
});
test('a confirmed subscription RPC does not enqueue an echo of its financial snapshot',async()=>{
 let echoed=0,remembered=null;
 const cloud={entries:[],expenses:[expense],recurringRules:[],tradingEvents:[]};
 const auth={user:{id:'qa'},isRestoring:false,flushPendingKeySync:async()=>true,
  rememberFinancialSnapshot:value=>{remembered=value;},supabase:{rpc:async()=>({data:{created:true,finance_data:cloud,subscription_registry:{version:3,subscriptions:[advanced]},document_revision:20},error:null})}};
 const finance={app:{auth},data:{...cloud,expenses:[]},getFinanceResourceCapacity:()=>({allowed:true}),saveData(){if(!auth.isRestoring)echoed++;},render(){}};
 const result=await FinanzasModule.prototype.recordSubscriptionExpense.call(finance,{subscriptionId:sub.id,name:'QA',amount:1,currency:'USD',date:'2026-10-18'});
 assert.equal(result.created,true);assert.equal(echoed,0);assert.deepEqual(finance.data.expenses,[expense]);
 assert.deepEqual(remembered.finanzasData,cloud);assert.equal(auth.minimumCloudRevision,20);assert.equal(auth.isRestoring,false);
});
