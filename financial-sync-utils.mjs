import {reconcileFinanceSnapshot} from './finance-workspace-utils.mjs';
export const FINANCIAL_SYNC_KEYS=['finanzasData','lifecycle_subscriptions'];
export const financialBaseKey=userId=>`lifecycle_financial_sync_base:${userId}`;
const decode=value=>typeof value==='string'?JSON.parse(value):value;
export function readFinancialBase(storage,userId){
    try{return JSON.parse(storage.getItem(financialBaseKey(userId))||'{}');}catch{return {};}
}
export function rememberFinancialBase(storage,userId,document){
    const base=readFinancialBase(storage,userId);
    for(const key of FINANCIAL_SYNC_KEYS)if(document[key]!==undefined)base[key]=decode(document[key]);
    storage.setItem(financialBaseKey(userId),JSON.stringify(base));
}
export function mergeFinancialValue(key,base,local,remote){
    local=decode(local)||{};remote=decode(remote)||{};
    if(base!=null)return reconcileFinanceSnapshot(base,local,remote);
    // Upgrade a legacy durable queue without a common ancestor conservatively:
    // keep remote records, including renewals the old browser never observed.
    const empty=Object.fromEntries(Object.entries({...remote,...local}).map(([k,v])=>[k,Array.isArray(v)?[]:v&&typeof v==='object'?{}:undefined]));
    const merged=reconcileFinanceSnapshot(empty,local,remote);
    if(key==='lifecycle_subscriptions'){
        merged.subscriptions=(merged.subscriptions||[]).map(sub=>{
            const incoming=remote.subscriptions?.find(s=>s.id===sub.id);
            if(!incoming)return sub;
            const missing=(incoming.history||[]).filter(h=>h.type==='expense-recorded'&&!sub.history?.some(x=>x.occurrenceKey===h.occurrenceKey&&x.type===h.type));
            if(!missing.length)return sub;
            const history=new Map([...(sub.history||[]),...(incoming.history||[])].map(h=>[h.id,h]));
            return {...sub,nextRenewalDate:incoming.nextRenewalDate,lastExpenseRecordedPeriod:incoming.lastExpenseRecordedPeriod,
                history:[...history.values()].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)).slice(-5000)};
        });
    }
    return merged;
}
