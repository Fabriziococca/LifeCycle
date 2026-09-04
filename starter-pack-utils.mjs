import {
    createCustomTracker,
    normalizeCustomTrackerRegistry
} from './custom-tracker-utils.mjs';

/**
 * Optional, privacy-safe starting points for an empty account. These are valid
 * custom-tracker inputs; applying them never copies the owner's data.
 */
export const STARTER_PACK_PRESETS = Object.freeze([
    Object.freeze({
        id: 'starter_phone_cleaning',
        title: 'Limpieza del celular',
        category: 'Higiene',
        description: 'Recordatorio semanal para limpiar funda y pantalla.',
        tracker: Object.freeze({
            section: 'hygiene', subsection: 'tecnologia', template: 'routine',
            name: 'Celular (Funda y Pantalla)', actionLabel: 'Registrar limpieza',
            cadence: Object.freeze({ unit: 'days', value: 7 }), intervalDays: 7,
            thresholds: Object.freeze({ yellow: 5, orange: 6, red: 7 }),
            icon: 'ph-phone', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    }),
    Object.freeze({
        id: 'starter_bedding',
        title: 'Cambio de ropa de cama',
        category: 'Higiene',
        description: 'Seguimiento semanal para sábanas y fundas.',
        tracker: Object.freeze({
            section: 'hygiene', subsection: 'dormitorio_bano', template: 'routine',
            name: 'Ropa de cama', actionLabel: 'Registrar cambio',
            cadence: Object.freeze({ unit: 'days', value: 7 }), intervalDays: 7,
            thresholds: Object.freeze({ yellow: 5, orange: 6, red: 7 }),
            icon: 'ph-bed', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    }),
    Object.freeze({
        id: 'starter_toothbrush',
        title: 'Recambio de cepillo dental',
        category: 'Higiene',
        description: 'Control trimestral de recambio del cepillo o cabezal.',
        tracker: Object.freeze({
            section: 'hygiene', subsection: 'cuidado_personal', template: 'consumable',
            name: 'Cepillo dental', actionLabel: 'Reemplazar',
            cadence: Object.freeze({ unit: 'days', value: 90 }), intervalDays: 90,
            thresholds: Object.freeze({ yellow: 75, orange: 85, red: 90 }),
            icon: 'ph-tooth', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    }),
    Object.freeze({
        id: 'starter_haircut',
        title: 'Corte de cabello',
        category: 'Cuidado',
        description: 'Seguimiento mensual de cuidado personal.',
        tracker: Object.freeze({
            section: 'grooming', subsection: 'mantenimiento', template: 'grooming',
            name: 'Pelo', actionLabel: 'Registrar corte',
            cadence: Object.freeze({ unit: 'days', value: 30 }), intervalDays: 30,
            thresholds: Object.freeze({ yellow: 21, orange: 27, red: 30 }),
            icon: 'ph-scissors', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    }),
    Object.freeze({
        id: 'starter_razor',
        title: 'Recambio de afeitadora',
        category: 'Cuidado',
        description: 'Control del cabezal o repuesto de afeitado.',
        tracker: Object.freeze({
            section: 'grooming', subsection: 'herramientas', template: 'consumable',
            name: 'Afeitadora (Repuesto)', actionLabel: 'Reemplazar',
            cadence: Object.freeze({ unit: 'days', value: 30 }), intervalDays: 30,
            thresholds: Object.freeze({ yellow: 21, orange: 27, red: 30 }),
            icon: 'ph-arrows-clockwise', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    }),
    Object.freeze({
        id: 'starter_lens_solution',
        title: 'Solución para lentes',
        category: 'Lentes',
        description: 'Seguimiento de apertura y recambio de solución limpiadora.',
        tracker: Object.freeze({
            section: 'lenses', subsection: 'insumos', template: 'consumable',
            name: 'Solución limpiadora', actionLabel: 'Abrir solución',
            cadence: Object.freeze({ unit: 'days', value: 90 }), intervalDays: 90,
            thresholds: Object.freeze({ yellow: 75, orange: 85, red: 90 }),
            icon: 'ph-drop', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    }),
    Object.freeze({
        id: 'starter_lens_case',
        title: 'Recambio de estuche de lentes',
        category: 'Lentes',
        description: 'Control trimestral del estuche de lentes de contacto.',
        tracker: Object.freeze({
            section: 'lenses', subsection: 'insumos', template: 'consumable',
            name: 'Estuche de lentes', actionLabel: 'Cambiar estuche',
            cadence: Object.freeze({ unit: 'days', value: 90 }), intervalDays: 90,
            thresholds: Object.freeze({ yellow: 75, orange: 85, red: 90 }),
            icon: 'ph-archive', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    }),
    Object.freeze({
        id: 'starter_clinical_checkup',
        title: 'Control médico anual',
        category: 'Salud',
        description: 'Seguimiento anual de una consulta clínica preventiva.',
        tracker: Object.freeze({
            section: 'health', subsection: 'controles', template: 'medical',
            name: 'Control clínico', actionLabel: 'Registrar control',
            cadence: Object.freeze({ unit: 'months', value: 12 }), intervalDays: 366,
            thresholds: Object.freeze({ warningDays: 30 }),
            icon: 'ph-heartbeat', instructions: '', behavior: Object.freeze({}),
            alert: Object.freeze({ enabled: false, time: '20:00', times: Object.freeze(['20:00']) })
        })
    })
]);

function canonicalName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('es');
}

function defaultIdFactory(preset, index) {
    const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
        || `${Date.now().toString(36)}${index.toString(36)}`;
    return `ct_starter_${preset.id.replace(/^starter_/, '')}_${random}`.slice(0, 96);
}

export function getStarterPresets() {
    return STARTER_PACK_PRESETS;
}

export function planStarterPackApplication({
    selectedPresetIds = [],
    registry: registryValue
} = {}) {
    const registry = normalizeCustomTrackerRegistry(registryValue);
    const selected = new Set(Array.isArray(selectedPresetIds) ? selectedPresetIds : []);
    const existingKeys = new Set(registry.trackers.map(tracker => (
        `${tracker.section}:${canonicalName(tracker.name)}`
    )));
    const planned = [];
    const skipped = [];

    STARTER_PACK_PRESETS.forEach(preset => {
        if (!selected.has(preset.id)) return;
        const key = `${preset.tracker.section}:${canonicalName(preset.tracker.name)}`;
        if (existingKeys.has(key)) {
            skipped.push({ preset, reason: 'duplicate' });
            return;
        }
        existingKeys.add(key);
        planned.push(preset);
    });

    return { registry, planned, skipped };
}

export function applyStarterPack({
    selectedPresetIds = [],
    registry: registryValue,
    now = new Date(),
    idFactory = defaultIdFactory,
    availableSlots = Number.POSITIVE_INFINITY
} = {}) {
    const timestamp = now instanceof Date ? new Date(now) : new Date(now);
    if (Number.isNaN(timestamp.getTime())) throw new TypeError('La fecha de aplicación no es válida.');

    const plan = planStarterPackApplication({ selectedPresetIds, registry: registryValue });
    if (plan.planned.length > availableSlots) {
        throw new RangeError('La selección supera el límite disponible de tarjetas.');
    }

    const registry = plan.registry;
    const created = [];
    plan.planned.forEach((preset, index) => {
        const sectionItems = registry.trackers.filter(tracker => (
            !tracker.archived
            && !tracker.deleted
            && tracker.section === preset.tracker.section
            && tracker.subsection === preset.tracker.subsection
        ));
        const order = Math.max(-1, ...sectionItems.map(tracker => tracker.order)) + 1;
        const tracker = createCustomTracker({
            ...preset.tracker,
            cadence: { ...preset.tracker.cadence },
            thresholds: { ...preset.tracker.thresholds },
            behavior: { ...preset.tracker.behavior },
            alert: {
                ...preset.tracker.alert,
                times: [...preset.tracker.alert.times]
            }
        }, {
            id: idFactory(preset, index),
            now: timestamp,
            order,
            customModules: registry.customModules
        });
        registry.trackers.push(tracker);
        registry.histories[tracker.id] = [];
        created.push({ preset, tracker });
    });

    return {
        registry: normalizeCustomTrackerRegistry(registry),
        created,
        skipped: plan.skipped
    };
}

// Compatibility helper for previous callers. It now returns valid tracker
// objects instead of an incompatible parallel schema.
export function buildStarterItemsToApply({
    selectedPresetIds = [],
    existingItems = [],
    now = new Date(),
    idFactory = defaultIdFactory
} = {}) {
    const registry = normalizeCustomTrackerRegistry({
        trackers: existingItems,
        histories: {}
    });
    return applyStarterPack({
        selectedPresetIds,
        registry,
        now,
        idFactory
    }).created.map(entry => entry.tracker);
}
