const COMPACT_FORMATTERS = new Map();

function getCompactFormatter(locale, maximumFractionDigits) {
    const key = `${locale}:${maximumFractionDigits}`;
    if (!COMPACT_FORMATTERS.has(key)) {
        COMPACT_FORMATTERS.set(key, new Intl.NumberFormat(locale, {
            notation: 'compact',
            compactDisplay: 'short',
            minimumFractionDigits: 0,
            maximumFractionDigits
        }));
    }
    return COMPACT_FORMATTERS.get(key);
}

export function getCompactCurrencyDisplay(amountUsd, {
    currency = 'USD',
    arsRate = null,
    locale = 'es-AR'
} = {}) {
    const normalizedAmount = Number(amountUsd);
    const safeAmount = Number.isFinite(normalizedAmount) ? normalizedAmount : 0;
    const normalizedCurrency = currency === 'ARS' ? 'ARS' : 'USD';
    const normalizedRate = Number(arsRate);
    const hasValidArsRate = Number.isFinite(normalizedRate) && normalizedRate > 0;
    const displayCurrency = normalizedCurrency === 'ARS' && !hasValidArsRate
        ? 'USD'
        : normalizedCurrency;
    const displayAmount = displayCurrency === 'ARS'
        ? safeAmount * normalizedRate
        : safeAmount;
    const absoluteAmount = Math.abs(displayAmount);
    const maximumFractionDigits = absoluteAmount >= 1_000_000 ? 2 : 1;
    const formattedAmount = absoluteAmount >= 1_000
        ? getCompactFormatter(locale, maximumFractionDigits).format(displayAmount)
        : new Intl.NumberFormat(locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: displayCurrency === 'USD' ? 2 : 0
        }).format(displayAmount);

    return `${displayCurrency} ${formattedAmount}`;
}
