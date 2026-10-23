import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalMinor, summarizeCurrency, currentBalanceValue, suggestedReceiptRate } from '../finance-currency-utils.mjs';
import { buildFinanceMovement, buildFinanceAccount, buildFinanceTransfer, buildFinanceReceipt, buildWorkspaceMovements, accountBalanceMinor, validateFinanceWorkspace } from '../finance-workspace-utils.mjs';
import { buildProjectIncomeMovements } from '../project-income-utils.mjs';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
const ws = () => ({version:1,accounts:[],budgets:[],transfers:[]});
const input = (currency,amount,rate) => ({type:'income',date:'2026-10-23',category:'freelance',description:'QA',currency,amount,rate});
const account = (currency,opening=0) => buildFinanceAccount({name:currency,kind:'bank',currency,opening});

test('mixed income retains original split and frozen USD/ARS totals despite later FX changes',()=>{
    const data={entries:[buildFinanceMovement(input('USD',1000,1000),ws()),buildFinanceMovement(input('ARS',500000,1000),ws())]};
    const before=structuredClone(data),rows=buildWorkspaceMovements(data);
    assert.equal(summarizeCurrency(rows,'USD').totalMinor,150000);
    assert.equal(summarizeCurrency(rows,'ARS').totalMinor,150000000);
    assert.deepEqual(summarizeCurrency(rows,'USD').originals,{USD:100000,ARS:50000000});
    const balances=[{currency:'USD',balance:100000},{currency:'ARS',balance:50000000}];
    assert.equal(currentBalanceValue(balances,'USD',1000).totalMinor,150000);
    assert.equal(currentBalanceValue(balances,'USD',1800).totalMinor,127778);
    assert.equal(summarizeCurrency(rows,'ARS').totalMinor,150000000);
    assert.deepEqual(data,before);
});

test('missing historical quotes are explicit; unknown originals never become received USD',()=>{
    const data={entries:[{id:'old',date:'2026-10-23',amount:123.123456},buildFinanceMovement(input('USD',50,''),ws())]};
    const rows=buildWorkspaceMovements(data),usd=summarizeCurrency(rows,'USD'),ars=summarizeCurrency(rows,'ARS');
    assert.equal(usd.legacyCount,1); assert.deepEqual(usd.originals,{USD:5000,ARS:0});
    assert.equal(usd.totalMinor,17312);assert.equal(ars.missingCount,2);assert.equal(ars.totalMinor,0);
    assert.equal(historicalMinor(rows[0],'ARS'),null);
    assert.equal(suggestedReceiptRate('2026-10-22','2026-10-23',{rate:1800,isFresh:true}),null);
    assert.equal(suggestedReceiptRate('2026-10-23','2026-10-23',{rate:1800,isFresh:false}),null);
    const old={id:'legacy',amount:17.123456,date:'2026-10-23',description:'Antes',category:'otros'};
    const edited=buildFinanceMovement({...input('unknown',17.12,''),description:'Nueva descripción',category:'otros'},ws(),old);
    assert.equal(edited.amount,17.123456);assert.equal(edited.nativeCurrency,undefined);
});

test('ARS/USD conversions affect both native balances without creating income, including void',()=>{
    const ars=account('ARS',500000),usd=account('USD',1000),workspace={...ws(),accounts:[ars,usd]};
    const transfer=buildFinanceTransfer({fromId:ars.id,toId:usd.id,amount:500000,receivedAmount:495,date:'2026-10-23'},workspace);
    workspace.transfers.push(transfer);validateFinanceWorkspace(workspace);
    assert.equal(accountBalanceMinor(ars,[],workspace.transfers),0);
    assert.equal(accountBalanceMinor(usd,[],workspace.transfers),149500);
    assert.equal(buildWorkspaceMovements({entries:[],workspace}).length,0);
    assert.equal(currentBalanceValue([{currency:'USD',balance:149500},{currency:'ARS',balance:0}],'USD',null).totalMinor,149500);
    transfer.voidedAt='2026-10-23T18:00:00Z';
    assert.equal(accountBalanceMinor(ars,[],workspace.transfers),50000000);
    assert.equal(accountBalanceMinor(usd,[],workspace.transfers),100000);
    assert.equal(currentBalanceValue([{currency:'ARS',balance:1}],'USD',null).totalMinor,null);
    assert.equal(accountBalanceMinor(ars,[{accountId:ars.id,nativeCurrency:'ARS',nativeAmountMinor:100,type:'income',date:'2030-01-01'}],[],'2026-10-23'),50000000);
});

test('inverse conversion, forged destination/rate and malformed transfers are guarded',()=>{
    const ars=account('ARS'),usd=account('USD'),workspace={...ws(),accounts:[ars,usd]};
    const t=buildFinanceTransfer({fromId:usd.id,toId:ars.id,amount:100,receivedAmount:180000,date:'2026-10-23'},workspace);
    assert.equal(t.exchangeRate,1800);
    assert.equal(accountBalanceMinor(ars,[],[t]),18000000);
    for(const patch of [{receivedAmountMinor:0},{receivedAmountMinor:NaN},{receivedCurrency:'USD'},{exchangeRate:10},{toId:usd.id}]) {
        assert.throws(()=>validateFinanceWorkspace({...workspace,transfers:[{...t,...patch}]}));
    }
    assert.throws(()=>buildFinanceTransfer({fromId:usd.id,toId:ars.id,amount:100,date:'2026-10-23'},workspace));
    const credit=buildFinanceAccount({name:'Card',kind:'credit',currency:'USD',opening:0,limit:100,closingDay:1,dueDay:2});
    assert.throws(()=>buildFinanceTransfer({fromId:credit.id,toId:ars.id,amount:10,receivedAmount:10000,date:'2026-10-23'},{accounts:[credit,ars]}));
});

test('receipt annotation preserves source data and USD equivalent, and rejects stale/different amounts',()=>{
    const project={id:'p',client:'QA',project:'Prueba',budgetNet:1000,partialReleases:[{id:'r',date:'2026-10-23',netAmount:500,percent:50}]};
    const data={entries:[],workspace:ws()},movements=buildProjectIncomeMovements({activeProjects:[project]});
    const row=buildWorkspaceMovements(data,movements)[0],before=JSON.stringify(project);
    const receipt=buildFinanceReceipt({currency:'ARS',amount:500000,rate:1000},row,data.workspace);
    data.workspace.receipts=[receipt];validateFinanceWorkspace(data.workspace);
    assert.equal(buildWorkspaceMovements(data,movements)[0].nativeCurrency,'ARS');
    assert.equal(JSON.stringify(project),before);
    assert.throws(()=>buildFinanceReceipt({currency:'ARS',amount:100,rate:1000},row,data.workspace));
    const archived=buildProjectIncomeMovements({historyProjects:[{...project,deliveredDate:'2026-10-23'}]});
    assert.equal(buildWorkspaceMovements(data,archived).find(m=>m.id.includes('partial')).nativeAmountMinor,50000000);
    assert.equal(buildWorkspaceMovements(data,[{...movements[0],amount:999}])[0].legacyEquivalent,true);
});

test('historical quote can be filled without claiming an unknown receipt was USD',()=>{
    const data={entries:[{id:'old',date:'2026-10-23',amount:100}],workspace:ws()};
    const row=buildWorkspaceMovements(data)[0];
    data.workspace.receipts=[buildFinanceReceipt({currency:'unknown',rate:1500},row,data.workspace)];
    validateFinanceWorkspace(data.workspace);
    const result=summarizeCurrency(buildWorkspaceMovements(data),'ARS');
    assert.equal(result.totalMinor,15000000);assert.equal(result.legacyCount,1);
    assert.equal(result.originals.USD,0);assert.equal(result.missingCount,0);
    data.workspace.receipts[0].accountId='no-account';assert.throws(()=>validateFinanceWorkspace(data.workspace));
});

test('new project receipts keep currency, quote and account through partial/final projections',()=>{
    const w=ws(),ars=account('ARS');w.accounts=[ars];
    const receipt=buildFinanceReceipt({currency:'ARS',amount:500000,rate:1000,accountId:ars.id},{key:'income:new',type:'income',amount:500,date:'2026-10-23'},w);
    const movements=buildProjectIncomeMovements({historyProjects:[{id:'p',client:'QA',project:'Prueba',budgetNet:1000,deliveredDate:'2026-10-23',paymentReceipt:receipt,partialReleases:[{id:'r',date:'2026-10-23',netAmount:500,percent:50,receipt}]}]});
    assert.equal(movements.length,2);
    assert.ok(movements.every(m=>m.nativeCurrency==='ARS'&&m.accountId===ars.id));
    assert.equal(summarizeCurrency(buildWorkspaceMovements({workspace:w},movements),'ARS').totalMinor,100000000);
});

test('full backup round-trips FX transfers, original currencies and historical annotations',()=>{
    const ars=account('ARS'),usd=account('USD'),workspace={...ws(),accounts:[ars,usd]};
    workspace.transfers=[buildFinanceTransfer({fromId:ars.id,toId:usd.id,amount:180000,receivedAmount:100,date:'2026-10-23'},workspace)];
    const data={workspace,entries:[buildFinanceMovement(input('USD',1000,1000),workspace)],expenses:[]};
    const row=buildWorkspaceMovements(data)[0];workspace.receipts=[buildFinanceReceipt({currency:'USD',amount:1000,rate:1000},row,workspace)];
    const payload=createBackupPayload(key=>key==='finanzasData'?JSON.stringify(data):null);
    assert.deepEqual(JSON.parse(parseAndValidateBackupText(JSON.stringify(payload)).entries.find(([key])=>key==='finanzasData')[1]),data);
    const receipt=buildFinanceReceipt({currency:'USD',amount:'29.55',rate:1000},{key:'income:fraction',type:'income',date:'2026-10-23',amount:29.5548},workspace);
    const project={id:'fraction',project:'Parcial con precisión anterior',budgetNet:89.56,partialReleases:[{id:'r',netAmount:29.5548,date:'2026-10-23',receipt}]};
    const projectBackup=createBackupPayload(key=>key==='projectPulseData'?JSON.stringify([project]):null);
    assert.doesNotThrow(()=>parseAndValidateBackupText(JSON.stringify(projectBackup)));
});
