export const FINANCE_RECURRING_VERSION = 1;

const VALID_TYPES = new Set(['income', 'expense']);
const VALID_CURRENCIES = new Set(['USD', 'ARS']);
const VALID_INCOME_CATEGORIES = new Set(['discord', 'trading', 'extraordinary']);

function normalizeText(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function isValidISODate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
        parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day
    );
}

function normalizeIntervalMonths(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return 1;
    return Math.min(24, Math.max(1, parsed));
}

function normalizeCategory(type, value) {
    const category = normalizeText(value);
    if (type === 'income') {
        return VALID_INCOME_CATEGORIES.has(category) ? category : 'extraordinary';
    }
    return category || 'otros';
}

export function normalizeFinanceRecurringRule(rule, index = 0) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;

    const type = VALID_TYPES.has(rule.type) ? rule.type : null;
    const name = normalizeText(rule.name);
    const amount = Number(rule.amount);
    const nextDueDate = normalizeText(rule.nextDueDate);

    if (!type || !name || !(amount > 0) || !isValidISODate(nextDueDate)) {
        return null;
    }

    const anchorDayInput = Number.parseInt(rule.anchorDay, 10);
    const dateDay = Number(nextDueDate.slice(8, 10));
    const anchorDay = Number.isInteger(anchorDayInput)
        ? Math.min(31, Math.max(1, anchorDayInput))
        : dateDay;

    return {
        id: normalizeText(rule.id, `finance-recurring-${index + 1}`),
        type,
        name,
        category: normalizeCategory(type, rule.category),
        description: normalizeText(rule.description, name),
        amount,
        currency: VALID_CURRENCIES.has(rule.currency) ? rule.currency : 'USD',
        intervalMonths: normalizeIntervalMonths(rule.intervalMonths),
        anchorDay,
        nextDueDate,
        active: rule.active !== false,
        createdAt: normalizeText(rule.createdAt),
        updatedAt: normalizeText(rule.updatedAt)
    };
}

export function normalizeFinanceRecurringRules(value) {
    const source = Array.isArray(value) ? value : [];
    const seenIds = new Set();
    const rules = [];

    source.forEach((item, index) => {
        const normalized = normalizeFinanceRecurringRule(item, index);
        if (!normalized || seenIds.has(normalized.id)) return;
        seenIds.add(normalized.id);
        rules.push(normalized);
    });

    return rules;
}

export function buildFinanceRecurringRule(input, {
    id,
    now = new Date().toISOString()
} = {}) {
    const normalizedId = normalizeText(id);
    if (!normalizedId) throw new Error('El movimiento recurrente necesita un identificador.');

    const candidate = normalizeFinanceRecurringRule({
        ...input,
        id: normalizedId,
        createdAt: input?.createdAt || now,
        updatedAt: now
    });
    if (!candidate) {
        throw new Error('Completá un nombre, monto y próxima fecha válidos.');
    }
    return candidate;
}

export function upsertFinanceRecurringRule(rules, rule) {
    const normalizedRules = normalizeFinanceRecurringRules(rules);
    const normalizedRule = normalizeFinanceRecurringRule(rule);
    if (!normalizedRule) throw new Error('El movimiento recurrente no es válido.');

    const index = normalizedRules.findIndex(item => item.id === normalizedRule.id);
    if (index >= 0) normalizedRules[index] = normalizedRule;
    else normalizedRules.push(normalizedRule);
    return normalizedRules;
}

export function removeFinanceRecurringRule(rules, ruleId) {
    const id = String(ruleId || '');
    return normalizeFinanceRecurringRules(rules).filter(rule => rule.id !== id);
}

export function getDueFinanceRecurringRules(rules, today) {
    const localDate = String(today || '');
    if (!isValidISODate(localDate)) return [];
    return normalizeFinanceRecurringRules(rules)
        .filter(rule => rule.active && rule.nextDueDate <= localDate)
        .sort((left, right) => (
            left.nextDueDate.localeCompare(right.nextDueDate)
            || left.name.localeCompare(right.name, 'es')
        ));
}

export function getNextFinanceRecurringDate(currentDate, intervalMonths, anchorDay) {
    if (!isValidISODate(currentDate)) {
        throw new Error('La fecha actual no es válida.');
    }
    const [year, month] = currentDate.split('-').map(Number);
    const months = normalizeIntervalMonths(intervalMonths);
    const preferredDay = Math.min(31, Math.max(
        1,
        Number.parseInt(anchorDay, 10) || Number(currentDate.slice(8, 10))
    ));

    const targetMonthIndex = (month - 1) + months;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(
        targetYear,
        normalizedMonthIndex + 1,
        0
    )).getUTCDate();
    const targetDay = Math.min(preferredDay, lastDay);

    return [
        String(targetYear).padStart(4, '0'),
        String(normalizedMonthIndex + 1).padStart(2, '0'),
        String(targetDay).padStart(2, '0')
    ].join('-');
}

export function advanceFinanceRecurringRule(rule, {
    occurrenceDate,
    now = new Date().toISOString()
} = {}) {
    const normalized = normalizeFinanceRecurringRule(rule);
    if (!normalized) throw new Error('El movimiento recurrente no es válido.');
    const currentOccurrence = occurrenceDate || normalized.nextDueDate;
    if (!isValidISODate(currentOccurrence)) {
        throw new Error('La ocurrencia recurrente no tiene una fecha válida.');
    }

    return {
        ...normalized,
        nextDueDate: getNextFinanceRecurringDate(
            currentOccurrence,
            normalized.intervalMonths,
            normalized.anchorDay
        ),
        updatedAt: now
    };
}

export function hasRecordedFinanceOccurrence(data, ruleId, occurrenceDate) {
    const id = String(ruleId || '');
    const occurrence = String(occurrenceDate || '');
    if (!id || !occurrence) return false;

    const records = [
        ...(Array.isArray(data?.entries) ? data.entries : []),
        ...(Array.isArray(data?.expenses) ? data.expenses : [])
    ];
    return records.some(item => (
        String(item?.recurringRuleId || '') === id
        && String(item?.recurringOccurrence || '') === occurrence
    ));
}
