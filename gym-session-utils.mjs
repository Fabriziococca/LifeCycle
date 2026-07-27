import { getLocalISODate } from './date-utils.mjs';

const VALID_DAYS = new Set([
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
]);

const MAX_EXERCISES = 100;
const MAX_SETS_PER_EXERCISE = 30;
const MAX_EXERCISE_NAME_LENGTH = 120;

function toNonNegativeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeSet(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const rirValue = value.rir === null || value.rir === '' || value.rir === undefined
        ? null
        : Math.min(10, Math.max(0, Math.trunc(toNonNegativeNumber(value.rir))));

    return {
        weight: toNonNegativeNumber(value.weight),
        reps: Math.trunc(toNonNegativeNumber(value.reps)),
        rir: rirValue,
        failed: Boolean(value.failed)
    };
}

export function normalizeActiveGymSession(value) {
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch {
            return null;
        }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (parsed.id === null || parsed.id === undefined) return null;
    if (!parsed.exercises || typeof parsed.exercises !== 'object' || Array.isArray(parsed.exercises)) {
        return null;
    }

    const exercises = {};
    Object.entries(parsed.exercises)
        .slice(0, MAX_EXERCISES)
        .forEach(([rawName, rawSets]) => {
            const name = String(rawName || '').trim().slice(0, MAX_EXERCISE_NAME_LENGTH);
            if (!name || !Array.isArray(rawSets)) return;

            exercises[name] = rawSets
                .slice(0, MAX_SETS_PER_EXERCISE)
                .map(normalizeSet)
                .filter(Boolean);
        });

    const day = VALID_DAYS.has(parsed.day) ? parsed.day : '';
    const startedAt = Number.isFinite(Date.parse(parsed.startedAt || ''))
        ? new Date(parsed.startedAt).toISOString()
        : null;
    const updatedAt = Number.isFinite(Date.parse(parsed.updatedAt || ''))
        ? new Date(parsed.updatedAt).toISOString()
        : startedAt;

    return {
        version: 1,
        id: parsed.id,
        date: typeof parsed.date === 'string' ? parsed.date.slice(0, 30) : '',
        day,
        startedAt,
        updatedAt,
        exercises
    };
}

export function createActiveGymSession({
    routine = [],
    selectedDay,
    now = new Date()
}) {
    const safeNow = Number.isFinite(now?.getTime?.()) ? new Date(now.getTime()) : new Date();
    const exercises = {};

    routine
        .filter(exercise => exercise?.day === selectedDay)
        .slice(0, MAX_EXERCISES)
        .forEach(exercise => {
            const name = String(exercise.name || '').trim().slice(0, MAX_EXERCISE_NAME_LENGTH);
            if (!name) return;

            const seriesCount = Math.min(
                MAX_SETS_PER_EXERCISE,
                Math.max(1, Math.trunc(toNonNegativeNumber(exercise.series, 3)))
            );
            exercises[name] = Array.from({ length: seriesCount }, () => ({
                weight: toNonNegativeNumber(exercise.weight),
                reps: Math.trunc(toNonNegativeNumber(exercise.reps)),
                rir: null,
                failed: false
            }));
        });

    const timestamp = safeNow.toISOString();
    return {
        version: 1,
        id: safeNow.getTime(),
        date: getLocalISODate(safeNow),
        day: VALID_DAYS.has(selectedDay) ? selectedDay : '',
        startedAt: timestamp,
        updatedAt: timestamp,
        exercises
    };
}
