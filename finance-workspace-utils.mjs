import { validFinanceRate } from './finance-currency-utils.mjs';
// Additive model: existing entries, expenses and source occurrence IDs stay intact.
// Native cents are used for accounts/budgets; legacy USD equivalents are explicit.
const CURRENCIES = ['ARS', 'USD'];
const MAX_MINOR = 1_000_000_000_000;
const id = prefix => `${prefix}_${crypto.randomUUID()}`;
const requiredText = (value, label, max = 100) => {
    const text = String(value || '').trim();
    if (!text || text.length > max) throw new Error(`${label}: completá entre 1 y ${max} caracteres.`);
    return text;
};
const currency = value => {
    if (!CURRENCIES.includes(value)) throw new Error('Moneda no compatible.');
    return value;
};
export function moneyToMinor(value, { signed = false, zero = false } = {}) {
    const text = String(value).trim().replace(',', '.');
    if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error('Ingresá un importe con hasta dos decimales.');
    const result = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_MINOR || (!signed && result < 0) || (!zero && result === 0)) {
        throw new Error('El importe está fuera del rango permitido.');
    }
    return result;
}
export function financeWorkspace(data) {
    if (data.workspace && data.workspace.version !== 1) throw new Error('Esta versión de Finanzas requiere actualizar la aplicación.');
    return data.workspace || { version: 1, accounts: [], budgets: [], transfers: [] };
}
export function financeDate(value) {
    const text = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || new Date(`${text}T12:00:00Z`).toISOString().slice(0, 10) !== text) {
        throw new Error('Ingresá una fecha válida.');
    }
    return text;
}
export function buildFinanceAccount(input, existing = null) {
    const kind = input.kind || 'bank';
    if (!['cash', 'bank', 'wallet', 'credit'].includes(kind)) throw new Error('Tipo de cuenta no válido.');
    if (existing && (input.currency !== existing.currency || kind !== existing.kind)) {
        throw new Error('La moneda y el tipo no cambian: creá otra cuenta para conservar la contabilidad.');
    }
    const opening = moneyToMinor(input.opening, { signed: kind !== 'credit', zero: true });
    const result = { ...existing, id: existing?.id || id('account'), name: requiredText(input.name, 'Nombre'),
        currency: currency(input.currency), kind, openingMinor: (kind === 'credit' ? -opening : opening) || 0,
        archived: existing?.archived || false };
    if (kind === 'credit') {
        result.limitMinor = moneyToMinor(input.limit, { zero: true });
        for (const key of ['closingDay', 'dueDay']) {
            const day = Number(input[key]);
            if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Cierre y vencimiento: usá días entre 1 y 31.');
            result[key] = day;
        }
    }
    return result;
}
export function buildFinanceMovement(input, workspace, existing = null) {
    if (!['income', 'expense'].includes(input.type)) throw new Error('Tipo de movimiento no válido.');
    if (input.currency === 'unknown' && existing?.id != null && !(CURRENCIES.includes(existing.nativeCurrency) && Number.isSafeInteger(existing.nativeAmountMinor))) {
        const result={...existing,date:financeDate(input.date),category:requiredText(input.category,'Categoría',80),description:requiredText(input.description,'Detalle',300)};
        delete result.valuationRate;
        if (String(input.rate??'').trim()) {
            if(!validFinanceRate(input.rate))throw new Error('Cotización histórica inválida.');
            result.valuationRate=Number(input.rate);
        }
        return result;
    }
    const nativeCurrency = currency(input.currency), nativeAmountMinor = moneyToMinor(input.amount);
    const rate = nativeCurrency === 'USD' ? 1 : Number(input.rate);
    if (!Number.isFinite(rate) || rate < 0.000001 || rate > 1_000_000) throw new Error('Ingresá la cotización ARS por USD usada para este movimiento.');
    const accountId = input.accountId || null;
    if (accountId) {
        const account = workspace.accounts.find(item => item.id === accountId);
        if (!account || (account.archived && existing?.accountId !== accountId) || account.currency !== nativeCurrency) throw new Error('Elegí una cuenta activa en la misma moneda.');
    }
    const result = { ...existing, id: existing?.id ?? id('movement'), date: financeDate(input.date),
        category: requiredText(input.category, 'Categoría', 80), description: requiredText(input.description, 'Detalle', 300),
        amount: nativeAmountMinor / 100 / rate, nativeCurrency, nativeAmountMinor, exchangeRate: rate,
        accountId, origin: existing?.origin || 'manual-v2' };
    delete result.valuationRate;
    if (nativeCurrency === 'USD' && String(input.rate ?? '').trim()) {
        if (!validFinanceRate(input.rate)) throw new Error('La cotización histórica debe ser ARS por 1 USD.');
        result.valuationRate = Number(input.rate);
    }
    return result;
}
export function buildFinanceTransfer(input, workspace) {
    const from = workspace.accounts.find(account => account.id === input.fromId);
    const to = workspace.accounts.find(account => account.id === input.toId);
    if (!from || !to || from.archived || to.archived || from.id === to.id) throw new Error('Elegí dos cuentas activas diferentes.');
    const amountMinor = moneyToMinor(input.amount);
    const result = { id: id('transfer'), fromId: from.id, toId: to.id, currency: from.currency,
        amountMinor, date: financeDate(input.date), description: String(input.description || 'Traspaso').trim().slice(0, 300) };
    if (from.currency !== to.currency) {
        if (from.kind === 'credit' || to.kind === 'credit') throw new Error('La conversión es entre cuentas de dinero, no tarjetas de crédito.');
        result.receivedCurrency = to.currency;
        result.receivedAmountMinor = moneyToMinor(input.receivedAmount);
        result.exchangeRate = from.currency === 'ARS' ? amountMinor / result.receivedAmountMinor : result.receivedAmountMinor / amountMinor;
        if (!validFinanceRate(result.exchangeRate)) throw new Error('Revisá los importes enviados y recibidos.');
    }
    return result;
}

// Metadata for external sources is keyed to the exact saved movement. It does
// not create another income, alter its USD history, or modify source documents.
export function buildFinanceReceipt(input, movement, workspace) {
    const identity = { key: movement.key, date: movement.date, amountUsd: movement.amount,
        ...(movement.sourceFingerprint ? { sourceFingerprint:movement.sourceFingerprint } : {}) };
    if (input.currency === 'unknown') {
        if (!validFinanceRate(input.rate)) throw new Error('Indicá la cotización de ese cobro para completar su equivalente histórico en ARS.');
        return { ...identity, valuationRate: Number(input.rate) };
    }
    const item = buildFinanceMovement({ ...input, type: movement.type, date: movement.date,
        description: movement.description || 'Cobro', category: movement.category || 'otros' }, workspace);
    if (Math.abs(item.amount - movement.amount) > .0050001) throw new Error('El importe y la cotización deben coincidir con el equivalente USD guardado. Corregí el cobro desde su origen si corresponde.');
    return { ...identity,
        nativeCurrency: item.nativeCurrency, nativeAmountMinor: item.nativeAmountMinor,
        exchangeRate: item.exchangeRate, ...(item.valuationRate ? { valuationRate: item.valuationRate } : {}), accountId: item.accountId };
}

// User confirmation is independent of the old saved USD reference. A derived
// ratio connects both values for compatibility; it is never a market FX quote.
export function buildOriginalConfirmation(input, movement, workspace, confirmedAt = new Date().toISOString()) {
    const nativeCurrency = currency(input.currency), nativeAmountMinor = moneyToMinor(input.amount);
    if (!Number.isFinite(movement.amount) || movement.amount <= 0 || typeof confirmedAt!=='string' || !Number.isFinite(Date.parse(confirmedAt)) || new Date(confirmedAt).toISOString()!==confirmedAt) throw new Error('Registro original inválido.');
    const exchangeRate = nativeCurrency === 'USD' ? 1 : nativeAmountMinor / 100 / movement.amount;
    if (!validFinanceRate(exchangeRate)) throw new Error('El importe confirmado no es compatible con el equivalente guardado. Revisá el registro desde su origen.');
    const previousAccount = workspace.accounts.find(item => item.id === movement.accountId && item.currency === nativeCurrency);
    const keepQuote = nativeCurrency==='USD' && Math.abs(nativeAmountMinor/100-movement.amount)<=.0050001 && validFinanceRate(movement.valuationRate);
    return { key:movement.key, date:financeDate(movement.date), amountUsd:movement.amount,
        ...(movement.sourceFingerprint ? { sourceFingerprint:movement.sourceFingerprint } : {}),
        nativeCurrency, nativeAmountMinor, exchangeRate, accountId:previousAccount?.id || null,
        originalConfirmedAt:confirmedAt, ...(nativeCurrency === 'ARS' ? { rateSource:'saved-equivalent' } : {}),
        ...(keepQuote?{valuationRate:movement.valuationRate}:{}),
        ...(!keepQuote&&validFinanceRate(movement.valuationRate||movement.priorValuationRate)?{priorValuationRate:movement.valuationRate||movement.priorValuationRate}:{}) };
}

export function confirmUsdOriginals(workspace, movements, selections) {
    if (!Array.isArray(selections) || !selections.length || selections.length > 200 || new Set(selections.map(item=>item.key)).size !== selections.length) throw new Error('Seleccioná entre 1 y 200 ingresos distintos.');
    const confirmations = selections.map(selection => {
        const movement = movements.find(item=>item.key===selection.key);
        if (!movement || JSON.stringify(movement)!==selection.fingerprint) throw new Error('Un ingreso seleccionado cambió. Cerrá y revisá la selección nuevamente.');
        if (movement.type!=='income' || !movement.legacyEquivalent) throw new Error('Sólo se confirman ingresos con moneda original pendiente.');
        return buildOriginalConfirmation({currency:'USD',amount:(Math.round(movement.amount*100)/100).toFixed(2)},movement,workspace);
    });
    const keys = new Set(confirmations.map(item=>item.key));
    const result = {...workspace,receipts:[...(workspace.receipts||[]).filter(item=>!keys.has(item.key)),...confirmations]};
    validateFinanceWorkspace(result);
    return result;
}
export function buildFinanceBudget(input, workspace, existingId = null) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) throw new Error('Elegí un mes válido.');
    const result = { id: existingId || id('budget'), month: input.month, category: requiredText(input.category, 'Categoría', 80),
        currency: currency(input.currency), limitMinor: moneyToMinor(input.amount) };
    if (workspace.budgets.some(item => item.id !== existingId && item.month === result.month && item.currency === result.currency
        && item.category.toLocaleLowerCase() === result.category.toLocaleLowerCase())) throw new Error('Ya existe un presupuesto para esa categoría, moneda y mes.');
    return result;
}
export const financeSourceFingerprint = entry => JSON.stringify([entry.date,entry.amount,entry.nativeCurrency,entry.nativeAmountMinor,entry.exchangeRate,entry.valuationRate,entry.accountId]);
export function buildWorkspaceMovements(data, combinedIncome = data.entries || []) {
    const map = (entry, type) => {
        const native = CURRENCIES.includes(entry.nativeCurrency) && Number.isSafeInteger(entry.nativeAmountMinor);
        const own = (data.entries || []).some(item => String(item.id) === String(entry.id));
        const key = `${type}:${entry.id}`.replace(/^income:proj-partial-(active|hist)-/, 'income:proj-partial-');
        const sourceFingerprint = financeSourceFingerprint(entry);
        const detail = data.workspace?.receipts?.find(item => item.key === key && item.date === entry.date && item.amountUsd === entry.amount && (!item.sourceFingerprint || item.sourceFingerprint === sourceFingerprint));
        return { ...entry, ...(detail || {}), type, key, nativeCurrency: detail?.nativeCurrency || (native ? entry.nativeCurrency : 'USD'),
            nativeAmountMinor: detail?.nativeAmountMinor ?? (native ? entry.nativeAmountMinor : Math.round(Number(entry.amount || 0) * 100)),
            legacyEquivalent: !detail?.nativeCurrency && !native, editable: entry.origin !== 'saylor' && (type === 'income' ? own : !entry.subscriptionId),
            ...(detail?.originalConfirmedAt ? { valuationRate:detail.valuationRate } : {}),
            sourceFingerprint, sourceLabel: entry.origin === 'retainer' ? 'Mantenimiento' : entry.origin === 'saylor' ? 'Saylor' : entry.subscriptionId ? 'Suscripción' : type === 'income' && !own ? 'Proyecto' : entry.recurringRuleId ? 'Recurrente' : 'Manual' };
    };
    return [...combinedIncome.map(entry => map(entry, 'income')), ...(data.expenses || []).map(entry => map(entry, 'expense'))]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.key.localeCompare(b.key));
}
export function accountBalanceMinor(account, movements, transfers, asOf = null) {
    let balance = account.openingMinor;
    for (const movement of movements) {
        if (asOf && movement.date > asOf) continue;
        if (movement.accountId === account.id && movement.nativeCurrency === account.currency) {
            balance += (movement.type === 'income' ? 1 : -1) * movement.nativeAmountMinor;
        }
    }
    for (const transfer of transfers) {
        if (asOf && transfer.date > asOf) continue;
        if (transfer.voidedAt) continue;
        if (transfer.fromId === account.id && transfer.currency === account.currency) balance -= transfer.amountMinor;
        if (transfer.toId === account.id && (transfer.receivedCurrency || transfer.currency) === account.currency) balance += transfer.receivedAmountMinor ?? transfer.amountMinor;
    }
    return balance;
}
export function budgetSpentMinor(budget, movements) {
    return movements.filter(item => item.type === 'expense' && item.date?.slice(0, 7) === budget.month
        && item.nativeCurrency === budget.currency && item.category?.toLocaleLowerCase() === budget.category.toLocaleLowerCase())
        .reduce((sum, item) => sum + item.nativeAmountMinor, 0);
}
// An RPC may return after the user has edited another local finance record.
// Apply the server snapshot only to unchanged fields; merge record collections
// by ID so unrelated remote rows survive without undoing local edits/deletions.
export function reconcileFinanceSnapshot(base, local, remote) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const merge = (before, current, incoming) => {
        if (same(before, current)) return structuredClone(incoming);
        if (same(before, incoming)) return structuredClone(current);
        if ([before, current, incoming].every(Array.isArray) && [...before, ...current, ...incoming].every(item => item && item.id != null)) {
            const original = new Map(before.map(item=>[String(item.id),item]));
            const pending = new Map(current.map(item=>[String(item.id),item]));
            const result = incoming.filter(item=>!original.has(String(item.id)) || pending.has(String(item.id)))
                .map(item=>pending.has(String(item.id)) ? merge(original.get(String(item.id)),pending.get(String(item.id)),item) : structuredClone(item));
            const ids = new Set(result.map(item=>String(item.id)));
            return [...result, ...current.filter(item=>!ids.has(String(item.id)) && (!original.has(String(item.id)) || !same(item,original.get(String(item.id))))).map(item=>structuredClone(item))];
        }
        const object = value => value && typeof value==='object' && !Array.isArray(value);
        if ([before,current,incoming].every(object)) {
            return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(current),...Object.keys(incoming)])]
                .map(key=>[key,merge(before[key],current[key],incoming[key])]).filter(([,value])=>value!==undefined));
        }
        return structuredClone(current);
    };
    return merge(base,local,remote);
}
export function validateFinanceWorkspace(workspace) {
    if (!workspace || workspace.version !== 1) throw new Error('Versión de cuentas y presupuestos no compatible.');
    for (const key of ['accounts', 'budgets', 'transfers']) {
        if (!Array.isArray(workspace[key])) throw new Error(`Finanzas: ${key} debe ser una lista.`);
        const ids = new Set();
        for (const item of workspace[key]) {
            if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('Identificador financiero inválido o duplicado.');
            ids.add(item.id);
        }
    }
    const minor = value => { if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MINOR) throw new Error('Importe financiero inválido.'); };
    for (const account of workspace.accounts) {
        requiredText(account.name, 'Cuenta'); currency(account.currency); minor(account.openingMinor);
        if (typeof account.archived !== 'boolean' || !['cash', 'bank', 'wallet', 'credit'].includes(account.kind)) throw new Error('Cuenta inválida.');
        if (account.kind === 'credit') {
            minor(account.limitMinor);
            if (account.limitMinor < 0 || ![account.closingDay, account.dueDay].every(day => Number.isInteger(day) && day >= 1 && day <= 31)) throw new Error('Tarjeta inválida.');
        }
    }
    for (const budget of workspace.budgets) {
        minor(budget.limitMinor);
        buildFinanceBudget({ ...budget, amount: budget.limitMinor / 100 }, { budgets: [] }, budget.id);
    }
    for (const transfer of workspace.transfers) {
        minor(transfer.amountMinor); currency(transfer.currency); financeDate(transfer.date);
        if (transfer.voidedAt !== undefined && !Number.isFinite(Date.parse(transfer.voidedAt))) throw new Error('Anulación de traspaso inválida.');
        const from = workspace.accounts.find(item => item.id === transfer.fromId), to = workspace.accounts.find(item => item.id === transfer.toId);
        if (transfer.amountMinor <= 0 || !from || !to || from.id === to.id || from.currency !== transfer.currency) throw new Error('Traspaso inválido.');
        if (from.currency !== to.currency) {
            minor(transfer.receivedAmountMinor);
            const rate = from.currency === 'ARS' ? transfer.amountMinor / transfer.receivedAmountMinor : transfer.receivedAmountMinor / transfer.amountMinor;
            if (from.kind === 'credit' || to.kind === 'credit' || transfer.receivedCurrency !== to.currency || transfer.receivedAmountMinor <= 0 || !validFinanceRate(rate) || Math.abs(rate - transfer.exchangeRate) > .000001) throw new Error('Conversión inválida.');
        } else if (transfer.receivedCurrency !== undefined || transfer.receivedAmountMinor !== undefined) throw new Error('Traspaso de la misma moneda inválido.');
    }
    if (workspace.receipts !== undefined) {
        if (!Array.isArray(workspace.receipts)) throw new Error('Datos de cobros inválidos.');
        const keys = new Set();
        for (const receipt of workspace.receipts) {
            if (!receipt || typeof receipt.key !== 'string' || !/^(income|expense):.+$/.test(receipt.key) || keys.has(receipt.key) || !Number.isFinite(receipt.amountUsd) || receipt.amountUsd <= 0) throw new Error('Identificador de cobro inválido.');
            keys.add(receipt.key);
            financeDate(receipt.date);
            if (receipt.sourceFingerprint !== undefined && (typeof receipt.sourceFingerprint !== 'string' || receipt.sourceFingerprint.length > 2000)) throw new Error('Referencia de cobro inválida.');
            if (receipt.originalConfirmedAt !== undefined) {
                const built = buildOriginalConfirmation({currency:receipt.nativeCurrency,amount:receipt.nativeAmountMinor/100},
                    {key:receipt.key,date:receipt.date,amount:receipt.amountUsd,accountId:receipt.accountId,valuationRate:receipt.valuationRate},workspace,receipt.originalConfirmedAt);
                if (built.exchangeRate!==receipt.exchangeRate || built.rateSource!==receipt.rateSource || built.accountId!==receipt.accountId || built.valuationRate!==receipt.valuationRate || (receipt.priorValuationRate!==undefined&&!validFinanceRate(receipt.priorValuationRate))) throw new Error('Confirmación de importe original inválida.');
                continue;
            }
            if (!receipt.nativeCurrency) {
                if (!validFinanceRate(receipt.valuationRate) || receipt.nativeAmountMinor !== undefined || receipt.accountId) throw new Error('Cotización histórica inválida.');
                continue;
            }
            const built = buildFinanceReceipt({ currency: receipt.nativeCurrency, amount: receipt.nativeAmountMinor / 100,
                rate: receipt.nativeCurrency === 'ARS' ? receipt.exchangeRate : receipt.valuationRate,
                accountId: receipt.accountId }, { key: receipt.key, date: receipt.date, amount: receipt.amountUsd, type: receipt.key.split(':')[0] },
                { accounts: workspace.accounts.map(account => ({ ...account, archived: false })) });
            if (built.exchangeRate !== receipt.exchangeRate) throw new Error('Cotización del cobro inválida.');
        }
    }
    return workspace;
}
