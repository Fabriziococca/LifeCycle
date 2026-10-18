'use strict';
const { normalizeSubscriptionRegistry } = require('./subscription-utils.mjs');
const { EXCHANGE_RATE_PROVIDERS, parseExchangeRate } = require('./exchange-rate-utils.mjs');
const { throwIfAborted } = require('./operational-resilience');

// Uses the same five-minute scheduler, including accounts with no Push devices.
// The database rechecks eligibility under a row lock; local snapshots cannot
// authorize a charge after pause, cancellation, date or amount edits.
class SubscriptionRenewalWorker {
    constructor(db, { resolveRate = null, maxOperations = 64 } = {}) {
        this.db = db;
        this.resolveRate = resolveRate || (signal => this.exchangeRate(signal));
        this.maxOperations = maxOperations;
        this.rate = null;
        this.state = { lastAttemptAt:null, lastSuccessAt:null, lastFailureAt:null,
            consecutiveFailures:0, processed:0, duplicates:0, failed:0, deferred:0 };
    }

    snapshot() { return {...this.state}; }

    async exchangeRate(signal) {
        if (this.rate && Date.now()-this.rate.at < 30*60000) return this.rate.value;
        for (const provider of EXCHANGE_RATE_PROVIDERS) {
            throwIfAborted(signal);
            try {
                const response = await fetch(provider.url, {signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000)});
                if (!response.ok) continue;
                const value = parseExchangeRate(provider.key, await response.json());
                this.rate = {value,at:Date.now()};
                return value;
            } catch (error) { throwIfAborted(signal); }
        }
        throw new Error('No current ARS exchange rate available');
    }

    async run(rows, {signal=null, now=new Date()} = {}) {
        const changed = new Set();
        const today = new Date(new Date(now).getTime()-3*3600000).toISOString().slice(0,10);
        const summary = {processed:0,duplicates:0,failed:0,deferred:0};
        this.state.lastAttemptAt = new Date(now).toISOString();
        let operations = 0, ratePromise = null;
        for (const row of rows) {
            for (const sub of normalizeSubscriptionRegistry(row.data?.lifecycle_subscriptions).subscriptions) {
                if (sub.status!=='active'||sub.billingMode!=='paid'||!sub.autoRenew||!sub.autoRecordExpense||sub.cost<=0) continue;
                let date = sub.nextRenewalDate, periods = 0;
                while (date && date<=today) {
                    throwIfAborted(signal);
                    if (operations>=this.maxOperations || periods>=24) { summary.deferred++; break; }
                    operations++; periods++;
                    try {
                        if (sub.currency==='ARS' && !ratePromise) ratePromise=Promise.resolve().then(()=>this.resolveRate(signal));
                        const rate = sub.currency==='ARS' ? await ratePromise : null;
                        let query=this.db.rpc('renew_subscription_for_scheduler',{
                            p_user_id:row.user_id,p_subscription_id:sub.id,p_due_date:date,p_ars_per_usd:rate
                        });
                        if (signal) query=query.abortSignal(signal);
                        const {data,error}=await query;
                        throwIfAborted(signal);
                        if (error) throw error;
                        if (!data || (!data.created && !data.duplicate)) throw new Error('Invalid renewal result');
                        if (data.created) summary.processed++; else summary.duplicates++;
                        changed.add(row.user_id);
                        const next=data.next_date;
                        if (!next || next<=date) break;
                        date=next;
                    } catch (error) {
                        throwIfAborted(signal);
                        summary.failed++;
                        break;
                    }
                }
            }
        }
        Object.assign(this.state,summary);
        if (summary.failed) {
            this.state.lastFailureAt=new Date().toISOString();
            this.state.consecutiveFailures++;
        } else {
            this.state.lastSuccessAt=new Date().toISOString();
            this.state.consecutiveFailures=0;
        }
        return {changed,summary};
    }
}
module.exports = {SubscriptionRenewalWorker};
