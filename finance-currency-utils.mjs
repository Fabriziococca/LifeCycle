// Reporting never rewrites a receipt or revalues historical income at today's rate.
export const validFinanceRate = value => Number.isFinite(Number(value)) && Number(value) >= .000001 && Number(value) <= 1_000_000;

export function historicalMinor(movement, currency) {
    if (!movement.legacyEquivalent && movement.nativeCurrency === currency) return movement.nativeAmountMinor;
    const usd = Number(movement.amount);
    if (!Number.isFinite(usd)) return null;
    if (currency === 'USD') return usd * 100;
    const rate = movement.nativeCurrency === 'ARS' && !movement.legacyEquivalent
        ? movement.exchangeRate : movement.valuationRate;
    return validFinanceRate(rate) ? usd * Number(rate) * 100 : null;
}

export function summarizeCurrency(movements, currency) {
    const result = { totalMinor: 0, missingCount: 0, missingUsd: 0, originals: { USD: 0, ARS: 0 }, legacyUsd: 0, legacyCount: 0 };
    for (const movement of movements) {
        if (movement.legacyEquivalent) { result.legacyUsd += Number(movement.amount) || 0; result.legacyCount++; }
        else result.originals[movement.nativeCurrency] += movement.nativeAmountMinor;
        const value = historicalMinor(movement, currency);
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
