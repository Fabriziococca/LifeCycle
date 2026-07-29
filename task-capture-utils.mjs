const FREELANCE_CATEGORY = 'Freelance';
const VALID_URGENCIES = new Set([
    'no_urgente',
    'urgente',
    'muy_urgente'
]);

export function getTaskCaptureCategories(categories) {
    if (!Array.isArray(categories)) return [];

    const unique = new Set();
    categories.forEach((category) => {
        const normalized = String(category ?? '').trim();
        if (!normalized || normalized === FREELANCE_CATEGORY) return;
        unique.add(normalized);
    });

    return [...unique];
}

export function createTaskRecord(
    draft,
    {
        categories = [],
        existingIds = [],
        now = () => Date.now()
    } = {}
) {
    const text = String(draft?.text ?? '').trim();
    if (!text) {
        throw new Error('Escribí qué tarea querés recordar.');
    }

    const availableCategories = getTaskCaptureCategories(categories);
    const category = String(draft?.category ?? '').trim();
    if (!availableCategories.includes(category)) {
        throw new Error('Elegí una carpeta válida para guardar la tarea.');
    }

    const urgency = VALID_URGENCIES.has(draft?.urgency)
        ? draft.urgency
        : 'no_urgente';
    const timestamp = Number(now());
    const safeTimestamp = Number.isFinite(timestamp) && timestamp >= 0
        ? Math.trunc(timestamp)
        : Date.now();
    const usedIds = new Set(existingIds.map(id => String(id)));
    let id = safeTimestamp;
    while (usedIds.has(String(id))) id += 1;

    return {
        id,
        text,
        category,
        urgency,
        completed: false,
        createdAt: new Date(safeTimestamp).toISOString()
    };
}
