import { summarizeCurrency } from './finance-currency-utils.mjs';

export function financeIncomeSource(movement) {
    const category=String(movement.category||'').trim().toLocaleLowerCase();
    if (category==='trading' || movement.origin==='saylor') return 'trading';
    if (category==='freelance' || category==='software' || movement.origin==='retainer' || movement.sourceLabel==='Proyecto') return 'software';
    return 'other';
}

// Uses the same projected ledger as the dashboard, never account balances,
// transfers, trading reminders, open positions or another copy of project income.
export function monthlyIncomeSeries(movements, endMonth, currency, options, source='all') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth)) throw new Error('Mes inválido para el gráfico.');
    const [year,month]=endMonth.split('-').map(Number),end=year*12+month-1;
    if(year<1||end<12)throw new Error('Mes fuera del rango del gráfico.');
    return Array.from({length:12},(_,index)=>{
        const ordinal=end-11+index,key=`${String(Math.floor(ordinal/12)).padStart(4,'0')}-${String(ordinal%12+1).padStart(2,'0')}`;
        const list=movements.filter(item=>item.type==='income'&&item.date?.slice(0,7)===key&&(source==='all'||financeIncomeSource(item)===source));
        const report=summarizeCurrency(list,currency,options);
        return {month:key,count:list.length,...report,plotMinor:report.missingCount?null:report.totalMinor};
    });
}
