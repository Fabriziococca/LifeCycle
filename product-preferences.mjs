export const TODAY_QUICK_ACTIONS = Object.freeze({
    new_project: Object.freeze({
        label: 'Nuevo proyecto',
        description: 'Ir al alta de Proyectos y empezar por el cliente.',
        icon: 'ph-briefcase',
        moduleId: 'projects-section'
    }),
    add_income: Object.freeze({
        label: 'Registrar ingreso',
        description: 'Abrir directamente el formulario de ingresos.',
        icon: 'ph-trend-up',
        moduleId: 'finanzas-section'
    }),
    add_expense: Object.freeze({
        label: 'Registrar gasto',
        description: 'Abrir directamente el formulario de gastos.',
        icon: 'ph-trend-down',
        moduleId: 'finanzas-section'
    }),
    open_gym: Object.freeze({
        label: 'Entrenar',
        description: 'Ir a Sesiones para iniciar o continuar un entrenamiento.',
        icon: 'ph-barbell',
        moduleId: 'gym-section'
    }),
    new_tracker: Object.freeze({
        label: 'Nueva tarjeta',
        description: 'Abrir el creador central de tarjetas configurables.',
        icon: 'ph-stack-plus',
        moduleId: null
    })
});

export const DEFAULT_TODAY_QUICK_ACTIONS = Object.freeze([
    'new_project',
    'add_income',
    'add_expense',
    'open_gym'
]);

const QUICK_ACTION_IDS = new Set(Object.keys(TODAY_QUICK_ACTIONS));
const MAX_QUICK_ACTIONS = QUICK_ACTION_IDS.size;

export function createDefaultTodayPreferences() {
    return {
        quickActions: [...DEFAULT_TODAY_QUICK_ACTIONS]
    };
}

export function normalizeTodayPreferences(value, { strict = false } = {}) {
    if (
        value === null
        || value === undefined
        || typeof value !== 'object'
        || Array.isArray(value)
    ) {
        if (strict && value !== undefined) {
            throw new TypeError('"todayPreferences" debe ser un objeto.');
        }
        return createDefaultTodayPreferences();
    }

    if (strict && !Array.isArray(value.quickActions)) {
        throw new TypeError('"todayPreferences.quickActions" debe ser una lista.');
    }

    const candidates = Array.isArray(value.quickActions)
        ? value.quickActions
        : DEFAULT_TODAY_QUICK_ACTIONS;
    if (strict && candidates.length > MAX_QUICK_ACTIONS) {
        throw new TypeError(
            `No se pueden configurar más de ${MAX_QUICK_ACTIONS} accesos rápidos.`
        );
    }

    const quickActions = [];
    candidates.forEach(candidate => {
        if (!QUICK_ACTION_IDS.has(candidate)) {
            if (strict) {
                throw new TypeError(`El acceso rápido "${candidate}" no es compatible.`);
            }
            return;
        }
        if (!quickActions.includes(candidate)) quickActions.push(candidate);
    });

    return { quickActions };
}
