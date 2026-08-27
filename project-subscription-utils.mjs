function parseSubscription(value) {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function normalizeProjectSubscription(value) {
    const parsed = parseSubscription(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const plan = String(parsed.plan || '').trim();
    const cost = Number(parsed.cost);
    const cycle = Number(parsed.cycle);
    const startDate = String(parsed.startDate || '').trim();
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? new Date(`${startDate}T12:00:00`)
        : null;

    if (
        !plan
        || !Number.isFinite(cost)
        || cost < 0
        || !Number.isInteger(cycle)
        || cycle < 1
        || cycle > 120
        || !parsedDate
        || Number.isNaN(parsedDate.getTime())
    ) {
        return null;
    }

    return { plan, cost, cycle, startDate };
}
