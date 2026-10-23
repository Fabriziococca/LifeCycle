import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOriginalConfirmation, confirmUsdOriginals, buildWorkspaceMovements, validateFinanceWorkspace, buildFinanceReceipt } from '../finance-workspace-utils.mjs';
import { summarizeCurrency } from '../finance-currency-utils.mjs';
import { createBackupPayload, parseAndValidateBackupText } from '../backup-utils.mjs';
const workspace=()=>({version:1,accounts:[],budgets:[],transfers:[]});
const old=(id,amount=200.01)=>({id,date:'2026-09-10',description:id,category:'PC',amount});

test('confirming the original ARS expense keeps 309000 ARS at every later rate without rewriting the old USD reference',()=>{
    const data={expenses:[old('PC')],workspace:workspace()},before=structuredClone(data.expenses);
    const movement=buildWorkspaceMovements(data)[0];
    data.workspace.receipts=[buildOriginalConfirmation({currency:'ARS',amount:309000},movement,data.workspace)];
    validateFinanceWorkspace(data.workspace);
    for(const rate of [1000,1800,2400]) {
        const rows=buildWorkspaceMovements(data),ars=summarizeCurrency(rows,'ARS',{mode:'current',rate});
        assert.equal(ars.totalMinor,30900000);assert.equal(ars.estimatedCount,0);
        assert.equal(summarizeCurrency(rows,'USD',{mode:'current',rate}).totalMinor,Math.round(30900000/rate));
        assert.equal(summarizeCurrency(rows,'USD',{mode:'historical'}).estimatedCount,1);
    }
    assert.deepEqual(data.expenses,before);
    assert.equal(data.workspace.receipts[0].amountUsd,200.01);
    assert.equal(data.workspace.receipts[0].valuationRate,undefined);
    assert.equal(data.workspace.receipts[0].rateSource,'saved-equivalent');
});

test('confirmation can correct actual original USD while keeping its prior reference as an antecedent',()=>{
    const data={entries:[old('original',100.123456)],workspace:workspace()};
    data.workspace.receipts=[buildOriginalConfirmation({currency:'USD',amount:101},buildWorkspaceMovements(data)[0],data.workspace)];
    validateFinanceWorkspace(data.workspace);
    const rows=buildWorkspaceMovements(data);
    assert.equal(rows[0].amount,100.123456);assert.equal(rows[0].nativeAmountMinor,10100);
    assert.equal(summarizeCurrency(rows,'USD').totalMinor,10100);
    assert.equal(summarizeCurrency(rows,'ARS').missingCount,1);
    assert.equal(summarizeCurrency(rows,'USD').estimatedCount,0);
});

test('batch confirmation is atomic, limited to selected unknown income, and preserves sources and unrelated receipts',()=>{
    const data={entries:[old('one',10),old('two',20.123456),old('untouched',30)],expenses:[old('expense',40)],workspace:workspace()};
    const before=structuredClone(data),rows=buildWorkspaceMovements(data);
    const selected=rows.filter(item=>['one','two'].includes(item.id)).map(item=>({key:item.key,fingerprint:JSON.stringify(item)}));
    const result=confirmUsdOriginals(data.workspace,rows,selected);
    assert.deepEqual(data,before);assert.equal(result.receipts.length,2);
    const after=buildWorkspaceMovements({...data,workspace:result});
    assert.equal(after.find(item=>item.id==='expense').legacyEquivalent,true);
    assert.equal(after.find(item=>item.id==='untouched').legacyEquivalent,true);
    assert.equal(after.find(item=>item.id==='two').nativeAmountMinor,2012);
    assert.equal(after.find(item=>item.id==='two').amount,20.123456);
    for(const selection of [[],[selected[0],selected[0]],[{...selected[0],fingerprint:'stale'}],rows.filter(item=>item.type==='expense').map(item=>({key:item.key,fingerprint:JSON.stringify(item)})),Array(201).fill(selected[0])]) assert.throws(()=>confirmUsdOriginals(data.workspace,rows,selection));
    assert.throws(()=>confirmUsdOriginals(result,after,selected));
    assert.throws(()=>confirmUsdOriginals(data.workspace,rows.filter(item=>item.id!=='two'),selected));
    assert.deepEqual(data,before);
});

test('confirmations round-trip backups, invalidate on source edits, and reject forged amounts, rates, timestamps and accounts',()=>{
    const data={entries:[old('income',50)],expenses:[old('PC')],workspace:workspace()};
    data.workspace.receipts=buildWorkspaceMovements(data).map(item=>buildOriginalConfirmation({currency:item.type==='income'?'USD':'ARS',amount:item.type==='income'?50:309000},item,data.workspace));
    const receipt=data.workspace.receipts.find(item=>item.nativeCurrency==='ARS');
    for(const patch of [{nativeAmountMinor:1},{exchangeRate:1},{rateSource:'market'},{originalConfirmedAt:true},{originalConfirmedAt:'yesterday'},{accountId:'missing'},{valuationRate:1800}]) assert.throws(()=>validateFinanceWorkspace({...data.workspace,receipts:[{...receipt,...patch}]}));
    const payload=createBackupPayload(key=>key==='finanzasData'?JSON.stringify(data):null);
    const restored=JSON.parse(parseAndValidateBackupText(JSON.stringify(payload)).entries.find(([key])=>key==='finanzasData')[1]);
    assert.deepEqual(restored,data);
    restored.expenses[0].amount=250;
    assert.equal(buildWorkspaceMovements(restored).find(item=>item.type==='expense').legacyEquivalent,true);
});

test('an explicit historical quote survives confirming unchanged USD; displaced quotes stay as an antecedent',()=>{
    const data={entries:[old('income',100)],workspace:workspace()},row=buildWorkspaceMovements(data)[0];
    data.workspace.receipts=[buildFinanceReceipt({currency:'unknown',rate:1500},row,data.workspace)];
    const annotated=buildWorkspaceMovements(data)[0];
    data.workspace.receipts=[buildOriginalConfirmation({currency:'USD',amount:100},annotated,data.workspace)];
    validateFinanceWorkspace(data.workspace);assert.equal(summarizeCurrency(buildWorkspaceMovements(data),'ARS').totalMinor,15000000);
    data.workspace.receipts=[buildOriginalConfirmation({currency:'ARS',amount:140000},annotated,data.workspace)];
    validateFinanceWorkspace(data.workspace);assert.equal(data.workspace.receipts[0].priorValuationRate,1500);
    assert.equal(summarizeCurrency(buildWorkspaceMovements(data),'ARS').totalMinor,14000000);
});
