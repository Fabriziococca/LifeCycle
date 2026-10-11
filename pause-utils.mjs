// Pause periods are separate from real activity records: pausing never invents
// a completed action or rewrites the history. Shared by browser and Node 24.
export function normalizePauseState(value = {}) {
    value ||= {};
    const periods = Array.isArray(value.pausePeriods) ? value.pausePeriods : [];
    return {
        paused: value.paused === true,
        pausedAt: Number.isFinite(Date.parse(value.pausedAt))
            ? new Date(value.pausedAt).toISOString() : null,
        pausedKm: Number.isFinite(value.pausedKm) ? value.pausedKm : null,
        pausePeriods: periods.flatMap(period => {
            const start = Date.parse(period?.startedAt);
            const end = Date.parse(period?.endedAt);
            return Number.isFinite(start) && Number.isFinite(end) && end >= start
                ? [{ startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(),
                    ...(Number.isFinite(period.startedKm) && Number.isFinite(period.endedKm)
                        ? { startedKm: period.startedKm, endedKm: period.endedKm } : {}) }]
                : [];
        })
    };
}

export function setEntityPaused(entity, paused, now = new Date(), { currentKm = null } = {}) {
    const state = normalizePauseState(entity);
    if (state.paused === paused) return { ...entity, ...state };
    const timestamp = new Date(now).toISOString();
    if (paused) return { ...entity, ...state, paused: true, pausedAt: timestamp, pausedKm: currentKm, updatedAt: timestamp };
    return {
        ...entity, ...state, paused: false, pausedAt: null, pausedKm: null, updatedAt: timestamp,
        pausePeriods: state.pausedAt
            ? [...state.pausePeriods, { startedAt: state.pausedAt, endedAt: timestamp,
                ...(Number.isFinite(state.pausedKm) && Number.isFinite(currentKm)
                    ? { startedKm: state.pausedKm, endedKm: currentKm } : {}) }]
            : state.pausePeriods
    };
}

export function getPauseAdjustedKm(entity, since, currentKm) {
    const origin = Date.parse(since);
    const state = normalizePauseState(entity);
    const reference = state.paused && Number.isFinite(state.pausedKm) ? state.pausedKm : Number(currentKm) || 0;
    const ignored = state.pausePeriods.reduce((sum, period) => sum + (
        Date.parse(period.startedAt) >= origin && Number.isFinite(period.startedKm) && Number.isFinite(period.endedKm)
            ? Math.max(0, period.endedKm - period.startedKm) : 0
    ), 0);
    return Math.max(0, reference - ignored);
}

export function getPauseReference(entity, now = new Date()) {
    const reference = new Date(now);
    const pausedAt = Date.parse(entity?.pausedAt);
    return entity?.paused && Number.isFinite(pausedAt)
        ? new Date(Math.min(reference.getTime(), pausedAt)) : reference;
}

export function getPauseAdjustedDate(entity, date, now = new Date()) {
    const origin = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00.000Z` : date);
    if (!Number.isFinite(origin)) return date;
    const reference = getPauseReference(entity, now).getTime();
    // Merge intervals so imported overlapping periods cannot count twice.
    const periods = normalizePauseState(entity).pausePeriods
        .map(p => [Math.max(origin, Date.parse(p.startedAt)), Math.min(reference, Date.parse(p.endedAt))])
        .filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
    let duration = 0;
    let previousEnd = origin;
    for (const [start, end] of periods) {
        duration += Math.max(0, end - Math.max(start, previousEnd));
        previousEnd = Math.max(previousEnd, end);
    }
    return new Date(origin + duration).toISOString();
}
