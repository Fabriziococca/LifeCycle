import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyIncomeSeries, financeIncomeSource } from '../finance-income-chart.mjs';
import { summarizeCurrency } from '../finance-currency-utils.mjs';
const usd=(category,amount,date='2026-10-10')=>({type:'income',category,amount,date,nativeCurrency:'USD',nativeAmountMinor:amount*100,legacyEquivalent:false});

test('monthly income includes software, trading, retainers and other receipts together while excluding expenses and transfers',()=>{
    const movements=[usd('freelance',100),usd('trading',200),{...usd('other',50),origin:'retainer'},usd('extraordinary',25),{...usd('trading',999),type:'expense'},{amountMinor:99999,type:'transfer',date:'2026-10-10'},usd('freelance',10,'2025-10-10')];
    const before=structuredClone(movements),series=monthlyIncomeSeries(movements,'2026-10','USD',{mode:'current',rate:1800});
    assert.equal(series.length,12);assert.equal(series[0].month,'2025-11');assert.equal(series[11].month,'2026-10');
    assert.equal(series[11].plotMinor,37500);assert.equal(series[11].count,4);assert.equal(series[0].count,0);
    assert.equal(monthlyIncomeSeries(movements,'2026-10','USD',{},'trading')[11].totalMinor,20000);
    assert.equal(monthlyIncomeSeries(movements,'2026-10','USD',{},'software')[11].totalMinor,15000);
    assert.equal(monthlyIncomeSeries(movements,'2026-10','USD',{},'other')[11].totalMinor,2500);
    assert.equal(financeIncomeSource({category:' Trading '}),'trading');
    assert.deepEqual(movements,before);
});

test('chart values follow the same current/historical conversion and estimate rules as the ledger',()=>{
    const movements=[usd('freelance',1000),{type:'income',category:'trading',date:'2026-10-10',amount:500,nativeCurrency:'ARS',nativeAmountMinor:50000000,exchangeRate:1000,legacyEquivalent:false},
        {type:'income',category:'extraordinary',date:'2026-10-10',amount:100,legacyEquivalent:true}];
    for(const currency of ['USD','ARS']) for(const mode of ['current','historical']) {
        const options={mode,rate:1800},series=monthlyIncomeSeries(movements,'2026-10',currency,options),report=summarizeCurrency(movements,currency,options);
        assert.equal(series[11].totalMinor,report.totalMinor);assert.equal(series[11].estimatedCount,report.estimatedCount);
    }
    assert.equal(monthlyIncomeSeries(movements,'2026-10','USD',{mode:'current',rate:1800})[11].plotMinor,137778);
    const pending=monthlyIncomeSeries(movements,'2026-10','ARS',{mode:'historical'})[11];
    assert.equal(pending.totalMinor,50000000);assert.equal(pending.plotMinor,null,'partial or missing quotes must not look like a zero or a complete total');
    assert.equal(pending.missingCount,2);
});

test('empty months, year rollover and malformed month boundaries are explicit',()=>{
    const series=monthlyIncomeSeries([],'2026-01','USD',{});
    assert.equal(series[0].month,'2025-02');assert.equal(series.at(-1).month,'2026-01');
    assert.ok(series.every(row=>row.count===0&&row.plotMinor===0));
    for(const month of ['2026-00','2026-13','2026-1','','0000-01'])assert.throws(()=>monthlyIncomeSeries([],month,'USD',{}));
});
