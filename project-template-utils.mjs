export const PROJECT_TEMPLATE_REGISTRY_VERSION = 1;

const VALID_PROJECT_SOURCES = new Set(['workana', 'external']);
const VALID_FEE_TYPES = new Set([
    '20',
    '15',
    '10',
    'direct',
    'paypal_direct',
    'custom'
]);
const VALID_TASK_URGENCIES = new Set(['no_urgente', 'urgente', 'muy_urgente']);

function normalizeText(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeOptionalNumber(value, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeFeeType(value) {
    const normalized = String(value ?? '20');
    return VALID_FEE_TYPES.has(normalized) ? normalized : '20';
}

function normalizeTemplateTask(task) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) return null;
    const text = normalizeText(task.text);
    if (!text) return null;

    const urgency = VALID_TASK_URGENCIES.has(task.urgency)
        ? task.urgency
        : 'urgente';

    return { text, urgency };
}

export function normalizeProjectTemplate(template, index = 0) {
    if (!template || typeof template !== 'object' || Array.isArray(template)) return null;

    const name = normalizeText(template.name);
    if (!name) return null;

    const tasks = Array.isArray(template.tasks)
        ? template.tasks.map(normalizeTemplateTask).filter(Boolean)
        : [];

    const includeBudget = template.includeBudget === true;
    const budgetGross = includeBudget
        ? normalizeOptionalNumber(template.budgetGross, { min: 0 })
        : null;

    return {
        id: normalizeText(template.id, `project-template-${index + 1}`),
        name,
        projectName: normalizeText(template.projectName),
        deliveryDays: normalizeOptionalNumber(template.deliveryDays, { min: 0.01 }),
        includeBudget,
        budgetGross,
        feeType: normalizeFeeType(template.feeType),
        manualPercent: normalizeOptionalNumber(template.manualPercent, { min: 0, max: 100 }) ?? 0,
        source: VALID_PROJECT_SOURCES.has(template.source) ? template.source : 'workana',
        summary: normalizeText(template.summary),
        phases: normalizeText(template.phases),
        tasks,
        createdAt: normalizeText(template.createdAt),
        updatedAt: normalizeText(template.updatedAt)
    };
}

export function normalizeProjectTemplateRegistry(value) {
    let source = value;
    if (typeof source === 'string') {
        try {
            source = JSON.parse(source);
        } catch {
            source = null;
        }
    }

    const templatesSource = Array.isArray(source)
        ? source
        : (source && typeof source === 'object' && Array.isArray(source.templates)
            ? source.templates
            : []);

    const seenIds = new Set();
    const templates = [];

    templatesSource.forEach((item, index) => {
        const normalized = normalizeProjectTemplate(item, index);
        if (!normalized || seenIds.has(normalized.id)) return;
        seenIds.add(normalized.id);
        templates.push(normalized);
    });

    return {
        version: PROJECT_TEMPLATE_REGISTRY_VERSION,
        templates
    };
}

export function buildProjectTemplate(source, {
    id,
    name,
    includeBudget = false,
    now = new Date().toISOString()
} = {}) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
        throw new Error('La plantilla necesita un nombre.');
    }

    const normalizedId = normalizeText(id);
    if (!normalizedId) {
        throw new Error('La plantilla necesita un identificador.');
    }

    const template = normalizeProjectTemplate({
        id: normalizedId,
        name: normalizedName,
        projectName: source?.project ?? source?.projectName ?? '',
        deliveryDays: source?.days ?? source?.deliveryDays,
        includeBudget,
        budgetGross: source?.budgetGross,
        feeType: source?.feeType,
        manualPercent: source?.manualPercent,
        source: source?.source,
        summary: source?.summary,
        phases: source?.phases,
        tasks: source?.tasks,
        createdAt: now,
        updatedAt: now
    });

    if (!template) {
        throw new Error('No se pudo construir una plantilla válida.');
    }
    return template;
}

export function upsertProjectTemplate(registry, template) {
    const normalizedRegistry = normalizeProjectTemplateRegistry(registry);
    const normalizedTemplate = normalizeProjectTemplate(template);
    if (!normalizedTemplate) {
        throw new Error('La plantilla no es válida.');
    }

    const existingIndex = normalizedRegistry.templates.findIndex(
        item => item.id === normalizedTemplate.id
    );
    if (existingIndex >= 0) {
        normalizedRegistry.templates[existingIndex] = normalizedTemplate;
    } else {
        normalizedRegistry.templates.push(normalizedTemplate);
    }
    return normalizedRegistry;
}

export function removeProjectTemplate(registry, templateId) {
    const normalizedRegistry = normalizeProjectTemplateRegistry(registry);
    const id = String(templateId ?? '');
    normalizedRegistry.templates = normalizedRegistry.templates.filter(
        item => item.id !== id
    );
    return normalizedRegistry;
}

export function cloneTemplateTasks(tasks, createId = (_, index) => Date.now() + index) {
    if (!Array.isArray(tasks)) return [];
    return tasks
        .map(normalizeTemplateTask)
        .filter(Boolean)
        .map((task, index) => ({
            id: createId(task, index),
            text: task.text,
            completed: false,
            urgency: task.urgency
        }));
}

export function getProjectTemplatePayload(template, createTaskId) {
    const normalized = normalizeProjectTemplate(template);
    if (!normalized) {
        return {
            summary: '',
            phases: '',
            tasks: []
        };
    }

    return {
        summary: normalized.summary,
        phases: normalized.phases,
        tasks: cloneTemplateTasks(normalized.tasks, createTaskId)
    };
}
