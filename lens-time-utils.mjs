const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveLensStartDate(startValue, referenceDate = new Date()) {
    if (!startValue) return null;

    const now = referenceDate instanceof Date
        ? new Date(referenceDate)
        : new Date(referenceDate);
    const start = new Date(startValue);
    if (Number.isNaN(now.getTime()) || Number.isNaN(start.getTime())) return null;
    if (start <= now) return start;

    const previousDay = new Date(start);
    previousDay.setDate(previousDay.getDate() - 1);
    const elapsed = now - previousDay;
    return elapsed >= 0 && elapsed <= DAY_MS ? previousDay : null;
}
