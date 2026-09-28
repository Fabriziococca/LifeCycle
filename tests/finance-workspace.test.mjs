import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyToMinor, financeWorkspace, financeDate, buildFinanceAccount, buildFinanceMovement,
    buildFinanceTransfer, buildFinanceBudget, buildWorkspaceMovements, accountBalanceMinor,
    budgetSpentMinor, validateFinanceWorkspace, reconcileFinanceSnapshot } from '../finance-workspace-utils.mjs';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
import { getFinanceResourceUsage, RESOURCE_KEYS } from '../resource-policy.mjs';
import { FinanzasModule } from '../modules/FinanzasModule.js';

const account = (name, kind='bank', currency='USD') => buildFinanceAccount({ name, kind, currency, opening:kind==='credit'?0:1000, limit:5000, closingDay:20, dueDay:5 });
const movement = (accountId, currency='USD') => ({ type:'expense', description:'Compra', category:'comida', date:'2026-09-27', amount:120, currency, rate:1200, accountId });

test('money uses integer cents, valid dates and explicit currency conversion', () => {
    assert.equal(moneyToMinor('12,34'),1234);
    for(const value of ['1.234','0','-1','Infinity','1e4','']) assert.throws(()=>moneyToMinor(value));
    assert.throws(()=>financeDate('2026-02-30'));
    assert.equal(financeDate('2024-02-29'),'2024-02-29');
    const item=buildFinanceMovement({...movement(null,'ARS'),amount:120000},financeWorkspace({}));
    assert.equal(item.amount,100); assert.equal(item.nativeAmountMinor,12000000); assert.equal(item.exchangeRate,1200);
    assert.throws(()=>buildFinanceMovement({...movement(null,'ARS'),rate:0},financeWorkspace({})));
});

test('legacy values and source ids remain intact, project/subscription sources are not double counted', () => {
    const data={entries:[{id:10,amount:17.123456,date:'2026-08-01',category:'extraordinary'}],expenses:[{id:'sub_1',subscriptionId:'s1',subscriptionOccurrenceKey:'s1:2026-09-01',amount:3,date:'2026-09-01'}]};
    const before=JSON.stringify(data);
    const list=buildWorkspaceMovements(data,[...data.entries,{id:'p1',amount:90,date:'2026-09-02',source:'workana'}]);
    assert.equal(list.length,3); assert.equal(JSON.stringify(data),before);
    assert.equal(list.find(item=>item.id===10).amount,17.123456);
    assert.equal(list.find(item=>item.id===10).legacyEquivalent,true);
    assert.equal(list.find(item=>item.id==='sub_1').editable,false);
    assert.equal(list.find(item=>item.id==='p1').editable,false);
    assert.equal(list.find(item=>item.id==='sub_1').subscriptionOccurrenceKey,'s1:2026-09-01');
});

test('card payments and transfers change balances but never become another expense', () => {
    const bank=account('Banco'),card=account('Tarjeta','credit');
    const ws={version:1,accounts:[bank,card],budgets:[],transfers:[]};
    const expense=buildFinanceMovement(movement(card.id),ws);
    const rows=buildWorkspaceMovements({entries:[],expenses:[expense]});
    assert.equal(accountBalanceMinor(card,rows,[]),-12000);
    const payment=buildFinanceTransfer({fromId:bank.id,toId:card.id,amount:120,date:'2026-09-28'},ws);
    ws.transfers.push(payment);
    assert.equal(accountBalanceMinor(card,rows,ws.transfers),0);
    assert.equal(accountBalanceMinor(bank,rows,ws.transfers),88000);
    assert.equal(rows.reduce((sum,item)=>sum+item.amount,0),120);
    assert.equal(validateFinanceWorkspace(ws),ws);
    assert.equal(getFinanceResourceUsage({expenses:[expense],workspace:ws})[RESOURCE_KEYS.FINANCE_TRANSACTIONS],2);
    payment.voidedAt='2026-09-28T03:00:00.000Z';
    assert.equal(accountBalanceMinor(bank,rows,ws.transfers),100000);
    assert.equal(accountBalanceMinor(card,rows,ws.transfers),-12000);
    assert.equal(validateFinanceWorkspace(ws),ws);
});

test('account currency/type is immutable and mismatched/archived links are rejected', () => {
    const usd=account('USD'),ars=account('Pesos','wallet','ARS');
    const ws={version:1,accounts:[usd,ars],budgets:[],transfers:[]};
    assert.throws(()=>buildFinanceAccount({name:'Cambio',kind:'bank',currency:'ARS',opening:1},usd));
    assert.throws(()=>buildFinanceMovement(movement(ars.id),ws));
    assert.throws(()=>buildFinanceTransfer({fromId:usd.id,toId:ars.id,amount:1,date:'2026-09-27'},ws));
    usd.archived=true;
    assert.throws(()=>buildFinanceMovement(movement(usd.id),ws));
    assert.equal(buildFinanceMovement(movement(usd.id),ws,{id:'old',accountId:usd.id}).accountId,usd.id);
    assert.equal(accountBalanceMinor(usd,[],[]),100000);
});

test('delayed subscription snapshot preserves local edits, deletions and unrelated remote rows', () => {
    const base={entries:[{id:'a',amount:1},{id:'b',amount:2}],expenses:[],workspace:{version:1,accounts:[],budgets:[],transfers:[]}};
    const local=structuredClone(base),remote=structuredClone(base);
    local.entries=[{id:'a',amount:3},{id:'local',amount:7}];
    local.workspace.accounts.push(account('New'));
    remote.entries.push({id:'remote',amount:9});
    remote.expenses.push({id:'subscription',amount:4});
    const merged=reconcileFinanceSnapshot(base,local,remote);
    assert.deepEqual(merged.entries,[{id:'a',amount:3},{id:'remote',amount:9},{id:'local',amount:7}]);
    assert.deepEqual(merged.workspace,local.workspace);
    assert.deepEqual(merged.expenses,remote.expenses);
    assert.deepEqual(reconcileFinanceSnapshot(base,base,remote),remote);
});

test('budgets only use matching month/category/currency and reject duplicates', () => {
    const ws=financeWorkspace({});
    const budget=buildFinanceBudget({category:'comida',month:'2026-09',currency:'USD',amount:100},ws);
    ws.budgets.push(budget);
    assert.throws(()=>buildFinanceBudget({category:'Comida',month:'2026-09',currency:'USD',amount:100},ws));
    const rows=buildWorkspaceMovements({expenses:[buildFinanceMovement(movement(null),ws),buildFinanceMovement({...movement(null,'ARS'),amount:2400},ws),{id:'old',date:'2026-08-01',amount:50,category:'comida'}]});
    assert.equal(budgetSpentMinor(budget,rows),12000);
});

test('workspace backup round-trips historical precision, accounts, native amounts, budgets and payments', () => {
    const bank=account('Banco'),card=account('Crédito','credit');
    const workspace={version:1,accounts:[bank,card],budgets:[],transfers:[]};
    workspace.budgets.push(buildFinanceBudget({category:'comida',month:'2026-09',currency:'USD',amount:100},workspace));
    workspace.transfers.push(buildFinanceTransfer({fromId:bank.id,toId:card.id,amount:12,date:'2026-09-27'},workspace));
    const data={entries:[{id:'old',amount:1.234567,date:'2026-01-01'}],expenses:[buildFinanceMovement(movement(card.id),workspace)],workspace};
    const backup=createBackupPayload(key=>key==='finanzasData'?JSON.stringify(data):null);
    assert.deepEqual(backup.data.finanzasData,data);
    assert.doesNotThrow(()=>parseAndValidateBackupText(JSON.stringify(backup)));
    const broken=structuredClone(workspace); broken.transfers[0].toId='missing';
    assert.throws(()=>validateFinanceWorkspace(broken));
    assert.throws(()=>financeWorkspace({workspace:{version:99}}));
});

test('subscription RPC waits for sync, preserves in-flight edits and rejects a different session', async () => {
    let calls=0, flushed=false, rpcBehavior;
    const module=Object.create(FinanzasModule.prototype);
    module.data={entries:[],expenses:[],workspace:financeWorkspace({})};
    module.getFinanceResourceCapacity=()=>true; module.saveData=()=>{}; module.render=()=>{};
    module.app={auth:{user:{id:'owner'},flushPendingKeySync:async()=>{flushed=true;return true;},supabase:{rpc:async()=>{calls++;assert.equal(flushed,true);return rpcBehavior();}}}};
    const params={subscriptionId:'s',name:'Subscription',amount:10,currency:'USD',date:'2026-09-27'};
    rpcBehavior=()=>{
        const cloud=structuredClone(module.data);
        cloud.expenses.push({id:'cloud-subscription',amount:10,subscriptionId:'s'});
        module.data.workspace.accounts.push(account('Edited while waiting'));
        return {data:{created:true,finance_data:cloud}};
    };
    assert.equal((await module.recordSubscriptionExpense(params)).created,true);
    assert.equal(module.data.workspace.accounts.length,1); assert.equal(module.data.expenses.length,1);
    module.app.auth.flushPendingKeySync=async()=>false;
    assert.ok((await module.recordSubscriptionExpense({...params,date:'2026-10-27'})).error);
    assert.equal(calls,1);
    module.app.auth.flushPendingKeySync=async()=>true;
    const before=JSON.stringify(module.data);
    rpcBehavior=()=>{module.app.auth.user={id:'other'};return {data:{created:true,finance_data:{expenses:[]}}};};
    assert.ok((await module.recordSubscriptionExpense({...params,date:'2026-10-27'})).error);
    assert.equal(JSON.stringify(module.data),before);
});
