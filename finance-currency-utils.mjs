// Display valuation never rewrites a receipt or its historical quote.
export const validFinanceRate = value => Number.isFinite(Number(value)) && Number(value) >= .000001 && Number(value) <= 1_000_000;

export const financeValuationMode = value => value === 'historical' ? 'historical' : 'current';
export const estimatedFinanceValue = (movement, currency, mode) => Boolean(movement.legacyEquivalent
    || (mode === 'historical' && currency === 'USD' && movement.rateSource === 'saved-equivalent'));

export function reportMinor(movement, currency, { mode = 'historical', rate } = {}) {
    if (mode !== 'current') return historicalMinor(movement, currency);
    if (!movement.legacyEquivalent && movement.nativeCurrency === currency) return movement.nativeAmountMinor;
    // Unknown originals remain unknown. Their saved USD equivalent is a reference,
    // not evidence that the original payment was received in dollars.
    const amount = movement.legacyEquivalent ? Number(movement.amount) * 100 : movement.nativeAmountMinor;
    if (!Number.isFinite(amount)) return null;
    const original = movement.legacyEquivalent ? 'USD' : movement.nativeCurrency;
    if (original === currency || amount === 0) return amount;
    if (!validFinanceRate(rate)) return null;
    return original === 'USD' ? amount * Number(rate) : amount / Number(rate);
}

export function historicalMinor(movement, currency) {
    if (!movement.legacyEquivalent && movement.nativeCurrency === currency) return movement.nativeAmountMinor;
    const usd = !movement.legacyEquivalent && movement.nativeCurrency === 'USD' ? movement.nativeAmountMinor / 100 : Number(movement.amount);
    if (!Number.isFinite(usd)) return null;
    if (currency === 'USD') return usd * 100;
    const rate = movement.nativeCurrency === 'ARS' && !movement.legacyEquivalent
        ? movement.exchangeRate : movement.valuationRate;
    return validFinanceRate(rate) ? usd * Number(rate) * 100 : null;
}

export function summarizeCurrency(movements, currency, options) {
    const result = { totalMinor: 0, missingCount: 0, missingUsd: 0, estimatedCount:0, originals: { USD: 0, ARS: 0 }, legacyUsd: 0, legacyCount: 0 };
    for (const movement of movements) {
        if (movement.legacyEquivalent) { result.legacyUsd += Number(movement.amount) || 0; result.legacyCount++; }
        else result.originals[movement.nativeCurrency] += movement.nativeAmountMinor;
        if (estimatedFinanceValue(movement,currency,options?.mode||'historical')) result.estimatedCount++;
        const value = reportMinor(movement, currency, options);
        if (value === null) { result.missingCount++; result.missingUsd += Number(movement.amount) || 0; }
        else result.totalMinor += value;
    }
    result.totalMinor = Math.round(result.totalMinor);
    return result;
}

export function currentBalanceValue(balances, currency, rate) {
    let total = 0, missing = false;
    const originals = { USD: 0, ARS: 0 };
    for (const { currency: code, balance } of balances) {
        originals[code] += balance;
        if (code === currency) total += balance;
        else if (balance !== 0) {
            if (!validFinanceRate(rate)) missing = true;
            else total += code === 'USD' ? balance * rate : balance / rate;
        }
    }
    return { totalMinor: missing ? null : Math.round(total), originals };
}

// Old receipts with no FX quote remain explicitly incomplete in ARS reports.
// A quote may be suggested only for a receipt dated today, never for a past date.
export function suggestedReceiptRate(date, today, cache) {
    return date === today && cache?.isFresh && validFinanceRate(cache.rate) ? Number(cache.rate) : null;
}
