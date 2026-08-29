export const RESOURCE_KEYS = Object.freeze({
    CUSTOM_MODULES: 'custom_modules',
    TRACKER_CARDS: 'tracker_cards',
    REMINDERS: 'reminders',
    TASKS: 'tasks',
    PROJECTS: 'projects',
    PROJECT_TEMPLATES: 'project_templates',
    FINANCE_TRANSACTIONS: 'finance_transactions',
    FINANCE_RECURRING_RULES: 'finance_recurring_rules',
    TRADING_EVENTS: 'trading_events',
    GYM_ROUTINE_EXERCISES: 'gym_routine_exercises',
    GYM_MEAL_TEMPLATES: 'gym_meal_templates',
    GYM_SUPPLEMENTS: 'gym_supplements',
    VEHICLE_ISSUES: 'vehicle_issues',
    BLOOD_TEST_FILES: 'blood_test_files',
    SYNCED_DOCUMENT_BYTES: 'synced_document_bytes',
    BLOOD_TEST_FILE_BYTES: 'blood_test_file_bytes'
});

export const FALLBACK_FRIEND_LIMITS = Object.freeze({
    [RESOURCE_KEYS.CUSTOM_MODULES]: 30,
    [RESOURCE_KEYS.TRACKER_CARDS]: 500,
    [RESOURCE_KEYS.REMINDERS]: 500,
    [RESOURCE_KEYS.TASKS]: 5_000,
    [RESOURCE_KEYS.PROJECTS]: 500,
    [RESOURCE_KEYS.PROJECT_TEMPLATES]: 100,
    [RESOURCE_KEYS.FINANCE_TRANSACTIONS]: 25_000,
    [RESOURCE_KEYS.FINANCE_RECURRING_RULES]: 500,
    [RESOURCE_KEYS.TRADING_EVENTS]: 1_000,
    [RESOURCE_KEYS.GYM_ROUTINE_EXERCISES]: 1_000,
    [RESOURCE_KEYS.GYM_MEAL_TEMPLATES]: 1_000,
    [RESOURCE_KEYS.GYM_SUPPLEMENTS]: 500,
    [RESOURCE_KEYS.VEHICLE_ISSUES]: 2_000,
    [RESOURCE_KEYS.BLOOD_TEST_FILES]: 1_000,
    [RESOURCE_KEYS.SYNCED_DOCUMENT_BYTES]: 5_242_880,
    [RESOURCE_KEYS.BLOOD_TEST_FILE_BYTES]: 15_728_640
});

const RESOURCE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

function normalizePositiveInteger(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function createFallbackResourcePolicy() {
    return {
        tier: 'friend',
        unlimited: false,
        limits: { ...FALLBACK_FRIEND_LIMITS }
    };
}

export function normalizeResourcePolicy(value) {
    const candidate = Array.isArray(value) ? value[0] : value;
    if (!candidate || typeof candidate !== 'object') {
        return createFallbackResourcePolicy();
    }

    const tier = candidate.tier === 'owner' ? 'owner' : 'friend';
    const serverLimits = candidate.limits && typeof candidate.limits === 'object'
        ? candidate.limits
        : {};
    const limits = { ...FALLBACK_FRIEND_LIMITS };

    Object.entries(serverLimits).forEach(([key, rawLimit]) => {
        const limit = normalizePositiveInteger(rawLimit);
        if (RESOURCE_KEY_PATTERN.test(key) && limit !== null) {
            limits[key] = limit;
        }
    });

    return {
        tier,
        unlimited: tier === 'owner' && candidate.unlimited === true,
        limits
    };
}

export function getResourceLimit(policy, resourceKey) {
    if (policy?.unlimited === true) return null;
    return normalizePositiveInteger(policy?.limits?.[resourceKey]);
}

export function evaluateResourceCapacity(
    policy,
    resourceKey,
    currentCount,
    requestedCount = 1
) {
    const current = Math.max(0, Number.isFinite(Number(currentCount))
        ? Math.trunc(Number(currentCount))
        : 0);
    const requested = Math.max(1, Number.isFinite(Number(requestedCount))
        ? Math.trunc(Number(requestedCount))
        : 1);

    if (policy?.unlimited === true) {
        return { allowed: true, limit: null, remaining: null };
    }

    const limit = getResourceLimit(policy, resourceKey);
    if (limit === null) {
        return { allowed: true, limit: null, remaining: null };
    }

    return {
        allowed: current + requested <= limit,
        limit,
        remaining: Math.max(0, limit - current)
    };
}

export function getTrackerRegistryResourceUsage(registry) {
    const customModules = Array.isArray(registry?.customModules)
        ? registry.customModules
        : [];
    const trackerCards = Array.isArray(registry?.trackers)
        ? registry.trackers.filter(tracker => tracker?.deleted !== true)
        : [];

    return {
        [RESOURCE_KEYS.CUSTOM_MODULES]: customModules.length,
        [RESOURCE_KEYS.TRACKER_CARDS]: trackerCards.length
    };
}

export function getRecurringReminderRegistryResourceUsage(registry) {
    const reminders = Array.isArray(registry?.reminders)
        ? registry.reminders
        : [];

    return {
        [RESOURCE_KEYS.REMINDERS]: reminders.length
    };
}
