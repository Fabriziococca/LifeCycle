import {
    createCustomTracker,
    createEmptyCustomTrackerRegistry,
    CUSTOM_ALERT_PREFIX,
    DEFAULT_BLOOD_STUDY_TRACKER_ID,
    DEFAULT_ROBOT_TRACKER_ID,
    CUSTOM_TRACKER_FIELD,
    CUSTOM_TRACKER_SCHEMA_VERSION,
    CUSTOM_TRACKER_SECTIONS,
    LEGACY_CUSTOM_TRACKER_FIELD,
    normalizeCustomTrackerRegistry
} from './custom-tracker-utils.mjs?v=20260811-special-trackers';
import {
    GROOMING_RULES,
    itemsConfig,
    LENS_LIMITS,
    ZONES
} from './utils.js';

const LENS_TRACKERS = Object.freeze([
    {
        id: 'lenses',
        key: 'lensDate',
        name: 'Lentes de Contacto',
        limit: LENS_LIMITS.lenses,
        icon: 'ph-eye',
        actionLabel: 'Nuevo par',
        alertKey: 'lenses_replace',
        behavior: { stockKey: 'lensStock', decrementStock: true }
    },
    {
        id: 'solution',
        key: 'solutionDate',
        name: 'Solución Limpiadora',
        limit: LENS_LIMITS.solution,
        icon: 'ph-drop',
        actionLabel: 'Abrir solución',
        alertKey: 'lenses_solution'
    },
    {
        id: 'case',
        key: 'caseDate',
        name: 'Estuche de Lentes',
        limit: LENS_LIMITS.case,
        icon: 'ph-archive',
        actionLabel: 'Cambiar estuche',
        alertKey: 'lenses_case'
    },
    {
        id: 'systane',
        key: 'systaneDate',
        name: 'Gotas Systane',
        limit: LENS_LIMITS.systane,
        icon: 'ph-eyedropper',
        actionLabel: 'Abrir gotas',
        alertKey: 'lenses_droplets'
    },
    {
        id: 'cloth_wash',
        key: 'clothWashDate',
        name: 'Pañuelo (Lavado)',
        limit: LENS_LIMITS.clothWash,
        icon: 'ph-spray',
        actionLabel: 'Lavar pañuelo',
        alertKey: 'glasses_cloth_wash'
    },
    {
        id: 'cloth_change',
        key: 'clothChangeDate',
        name: 'Pañuelo (Cambio)',
        limit: LENS_LIMITS.clothChange,
        icon: 'ph-arrows-clockwise',
        actionLabel: 'Cambiar pañuelo',
        alertKey: 'glasses_cloth_replace'
    }
]);

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseStoredJson(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function hasStoredRecordData(value, ignoredKeys = []) {
    if (!isRecord(value)) return false;
    const ignored = new Set(ignoredKeys);
    return Object.keys(value).some(key => !ignored.has(key));
}

function getAlertConfig(alertsConfig, alertKey, {
    enabled = true,
    time = '23:00'
} = {}) {
    const stored = isRecord(alertsConfig?.[alertKey])
        ? alertsConfig[alertKey]
        : {};
    return {
        enabled: typeof stored.enabled === 'boolean' ? stored.enabled : enabled,
        time: typeof stored.time === 'string' ? stored.time : time
    };
}

function flattenInstructions(instructions) {
    if (!Array.isArray(instructions)) {
        return typeof instructions === 'string' ? instructions.trim() : '';
    }
    return instructions
        .map(instruction => {
            if (!isRecord(instruction)) return '';
            const step = typeof instruction.step === 'string'
                ? instruction.step.trim()
                : '';
            const text = typeof instruction.text === 'string'
                ? instruction.text.trim()
                : '';
            if (!step) return text;
            if (!text) return step;
            return `${step}: ${text}`;
        })
        .filter(Boolean)
        .join('\n\n');
}

function toHistory(value) {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
}

function getHygieneActionLabel(type) {
    if (type === 'change') return 'Registrar cambio';
    if (type === 'clean') return 'Registrar limpieza';
    if (type === 'brush') return 'Registrar cepillado';
    return 'Registrar lavado';
}

function getGroomingActionLabel(zoneId) {
    if (zoneId === 'barba') return 'Registrar afeitado';
    if (zoneId === 'pelo' || zoneId === 'unas_manos' || zoneId === 'unas_pies') {
        return 'Registrar corte';
    }
    if (zoneId === 'hoja_gillette') return 'Renovar hoja';
    return 'Registrar depilación';
}

function getGroomingIcon(zoneId) {
    if (zoneId === 'barba' || zoneId === 'unas_pies') return 'ph-scissors';
    if (zoneId === 'unas_manos') return 'ph-hand-palm';
    if (zoneId === 'hoja_gillette') return 'ph-sparkle';
    return 'ph-user';
}

function sanitizeIdPart(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 72);
}

function createMigratedTracker(input, {
    id,
    now,
    order
}) {
    return createCustomTracker({
        ...input,
        createdAt: now.toISOString()
    }, {
        id,
        now,
        order
    });
}

function appendTracker(registry, tracker, history) {
    if (registry.trackers.some(existing => existing.id === tracker.id)) return;
    registry.trackers.push(tracker);
    registry.histories[tracker.id] = toHistory(history);
}

function getNextOrder(registry, section, subsection) {
    return Math.max(
        -1,
        ...registry.trackers
            .filter(tracker => (
                tracker.section === section
                && tracker.subsection === subsection
            ))
            .map(tracker => Number(tracker.order) || 0)
    ) + 1;
}

function migrateBuiltInHygiene(registry, {
    hygieneData,
    alertsConfig,
    now
}) {
    const orderByCategory = new Map();
    itemsConfig.forEach(item => {
        const order = orderByCategory.get(item.category) || 0;
        orderByCategory.set(item.category, order + 1);
        const alert = getAlertConfig(alertsConfig, item.id);
        const mode = (
            item.category === 'tecnologia'
            || item.id === 'esponja_africana'
            || item.id === 'cepillo_dientes'
        ) ? 'history' : 'single';

        appendTracker(
            registry,
            createMigratedTracker({
                section: 'hygiene',
                subsection: item.category,
                template: 'routine',
                name: item.name,
                actionLabel: getHygieneActionLabel(item.type),
                cadence: { unit: 'days', value: item.limits.red },
                intervalDays: item.limits.red,
                thresholds: item.limits,
                icon: item.icon,
                instructions: flattenInstructions(item.instructions),
                group: item.group ? {
                    id: item.group,
                    name: item.groupName || item.group,
                    icon: item.groupIcon || item.icon
                } : null,
                legacySource: {
                    kind: 'hygiene',
                    key: item.id,
                    mode
                },
                alertKey: item.id,
                alert
            }, {
                id: `trk_hygiene_${sanitizeIdPart(item.id)}`,
                now,
                order
            }),
            hygieneData?.[item.id]
        );
    });
}

function migrateBuiltInGrooming(registry, {
    groomingData,
    alertsConfig,
    now
}) {
    const orderBySubsection = new Map();
    ZONES.forEach(zone => {
        const subsection = zone.isTool ? 'herramientas' : 'mantenimiento';
        const order = orderBySubsection.get(subsection) || 0;
        orderBySubsection.set(subsection, order + 1);
        const limits = GROOMING_RULES[zone.id]?.limits || {
            yellow: 20,
            orange: 25,
            red: 30
        };
        const red = limits.red || 30;
        const yellow = limits.yellow || Math.max(1, Math.floor(red * 0.7));
        const orange = limits.orange || Math.max(yellow, Math.floor(red * 0.85));
        const alert = getAlertConfig(alertsConfig, zone.id);

        appendTracker(
            registry,
            createMigratedTracker({
                section: 'grooming',
                subsection,
                template: 'grooming',
                name: zone.name,
                actionLabel: getGroomingActionLabel(zone.id),
                cadence: { unit: 'days', value: red },
                intervalDays: red,
                thresholds: { yellow, orange, red },
                icon: getGroomingIcon(zone.id),
                instructions: '',
                behavior: zone.id === 'barba' ? { prediction: 'beard' } : {},
                legacySource: {
                    kind: 'grooming',
                    key: zone.id,
                    mode: 'history'
                },
                alertKey: zone.id,
                alert
            }, {
                id: `trk_grooming_${sanitizeIdPart(zone.id)}`,
                now,
                order
            }),
            groomingData?.[zone.id]
        );
    });
}

function migrateBuiltInLenses(registry, {
    lensData,
    alertsConfig,
    now
}) {
    LENS_TRACKERS.forEach((item, order) => {
        const yellow = Math.max(1, Math.floor(item.limit * 0.7));
        const orange = Math.max(yellow, Math.floor(item.limit * 0.85));
        const alert = getAlertConfig(alertsConfig, item.alertKey);

        appendTracker(
            registry,
            createMigratedTracker({
                section: 'lenses',
                subsection: 'insumos',
                template: 'consumable',
                name: item.name,
                actionLabel: item.actionLabel,
                cadence: { unit: 'days', value: item.limit },
                intervalDays: item.limit,
                thresholds: { yellow, orange, red: item.limit },
                icon: item.icon,
                instructions: '',
                behavior: item.behavior || {},
                legacySource: {
                    kind: 'lens',
                    key: item.key,
                    mode: 'single'
                },
                alertKey: item.alertKey,
                alert
            }, {
                id: `trk_lenses_${sanitizeIdPart(item.id)}`,
                now,
                order
            }),
            lensData?.[item.key]
        );
    });
}

function migrateBuiltInHealth(registry, {
    healthData,
    alertsConfig,
    now
}) {
    const controls = isRecord(healthData) && Object.keys(healthData).length > 0
        ? healthData
        : {
            dentista: { lastVisit: null, frequencyMonths: 6, history: [] },
            oculista: { lastVisit: null, frequencyMonths: 6, history: [] }
        };

    Object.entries(controls).forEach(([key, value], order) => {
        if (!isRecord(value)) return;
        const normalizedKey = sanitizeIdPart(key) || `control_${order + 1}`;
        const isDentist = normalizedKey === 'dentista';
        const isEyeDoctor = normalizedKey === 'oculista';
        const name = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        const alertKey = isDentist
            ? 'dentista'
            : `${CUSTOM_ALERT_PREFIX}trk_health_${normalizedKey}`;
        const alert = getAlertConfig(alertsConfig, alertKey, {
            enabled: isDentist,
            time: '23:00'
        });
        const frequencyMonths = Math.min(
            120,
            Math.max(1, Number(value.frequencyMonths) || 6)
        );
        const history = Array.isArray(value.history)
            ? value.history
            : toHistory(value.lastVisit);
        if (value.lastVisit && !history.includes(value.lastVisit)) {
            history.unshift(value.lastVisit);
        }

        appendTracker(
            registry,
            createMigratedTracker({
                section: 'health',
                subsection: 'controles',
                template: 'medical',
                name,
                actionLabel: 'Registrar visita',
                cadence: { unit: 'months', value: frequencyMonths },
                intervalDays: Math.round(frequencyMonths * 30.5),
                thresholds: { warningDays: 30 },
                icon: isDentist
                    ? 'ph-first-aid'
                    : (isEyeDoctor ? 'ph-eye' : 'ph-heartbeat'),
                instructions: '',
                legacySource: {
                    kind: 'health',
                    key,
                    mode: 'medical'
                },
                alertKey,
                alert
            }, {
                id: `trk_health_${normalizedKey}`,
                now,
                order
            }),
            history
        );
    });
}

function migrateV1CustomTrackers(registry, {
    legacyRegistry,
    alertsConfig,
    now
}) {
    if (!isRecord(legacyRegistry) || !Array.isArray(legacyRegistry.trackers)) return;
    const histories = isRecord(legacyRegistry.histories)
        ? legacyRegistry.histories
        : {};

    legacyRegistry.trackers.forEach(candidate => {
        if (!isRecord(candidate) || typeof candidate.id !== 'string') return;
        if (!CUSTOM_TRACKER_SECTIONS[candidate.section]) return;
        const sectionConfig = CUSTOM_TRACKER_SECTIONS[candidate.section];
        const subsection = sectionConfig.subsections[candidate.subsection]
            ? candidate.subsection
            : sectionConfig.defaultSubsection;
        const alertKey = `${CUSTOM_ALERT_PREFIX}${candidate.id}`;
        const storedAlert = getAlertConfig(alertsConfig, alertKey, {
            enabled: candidate.alert?.enabled === true,
            time: candidate.alert?.time || '23:00'
        });
        const order = getNextOrder(
            registry,
            candidate.section,
            subsection
        );

        try {
            const tracker = createMigratedTracker({
                section: candidate.section,
                subsection,
                template: sectionConfig.defaultTemplate,
                name: candidate.name,
                actionLabel: candidate.actionLabel,
                cadence: {
                    unit: 'days',
                    value: Number(candidate.intervalDays) || 30
                },
                intervalDays: Number(candidate.intervalDays) || 30,
                icon: candidate.icon || sectionConfig.defaultIcon,
                instructions: candidate.instructions || '',
                archived: candidate.archived === true,
                alertKey,
                alert: storedAlert
            }, {
                id: candidate.id,
                now,
                order
            });
            tracker.archived = candidate.archived === true;
            tracker.createdAt = candidate.createdAt || tracker.createdAt;
            tracker.updatedAt = candidate.updatedAt || tracker.updatedAt;
            appendTracker(registry, tracker, histories[candidate.id]);
        } catch {
            // Una entrada dañada de V1 no debe impedir migrar el resto.
        }
    });
}

function migrateSpecialTrackers(registry, {
    hygieneData,
    bloodTests,
    alertsConfig,
    hasLegacyAccountData,
    now
}) {
    let added = 0;
    const hasRobotTracker = registry.trackers.some(
        tracker => tracker.id === DEFAULT_ROBOT_TRACKER_ID
    );
    const legacyRobot = isRecord(hygieneData?.robot_cleaner)
        ? hygieneData.robot_cleaner
        : null;
    if (!hasRobotTracker && legacyRobot) {
        const robotAlert = getAlertConfig(alertsConfig, 'robot');
        const isRobotPending = legacyRobot.status === 'dirty';
        const legacyActivationIsValid = Number.isFinite(
            Date.parse(legacyRobot.marked_dirty_at)
        );
        const intervalHours = Math.min(
            48,
            Math.max(1, Number(alertsConfig?.robot?.interval_hours) || 6)
        );
        appendTracker(
            registry,
            createMigratedTracker({
                section: 'hygiene',
                subsection: 'tecnologia',
                template: 'state-reminder',
                name: 'Robot Aspiradora',
                actionLabel: 'Listo, ya lo lavé',
                cadence: { unit: 'days', value: 1 },
                thresholds: { yellow: 1, orange: 1, red: 1 },
                icon: 'ph-robot',
                instructions: 'Cuando el robot quede pendiente de lavado, iniciá los avisos. Al lavarlo, marcá la tarea como resuelta para detenerlos.',
                behavior: {
                    startActionLabel: 'Marcar como sucio',
                    intervalHours
                },
                state: {
                    active: isRobotPending,
                    activatedAt: isRobotPending
                        ? (legacyActivationIsValid
                            ? legacyRobot.marked_dirty_at
                            : now.toISOString())
                        : null
                },
                alertKey: 'robot',
                alert: robotAlert
            }, {
                id: DEFAULT_ROBOT_TRACKER_ID,
                now,
                order: getNextOrder(registry, 'hygiene', 'tecnologia')
            }),
            []
        );
        added += 1;
    }

    const safeBloodTests = Array.isArray(bloodTests) ? bloodTests : [];
    const hasBloodTracker = registry.trackers.some(
        tracker => tracker.id === DEFAULT_BLOOD_STUDY_TRACKER_ID
    );
    if (!hasBloodTracker && (hasLegacyAccountData || safeBloodTests.length > 0)) {
        const alertKey = `${CUSTOM_ALERT_PREFIX}${DEFAULT_BLOOD_STUDY_TRACKER_ID}`;
        appendTracker(
            registry,
            createMigratedTracker({
                section: 'health',
                subsection: 'controles',
                template: 'medical-study',
                name: 'Análisis de Sangre',
                actionLabel: 'Agregar estudio',
                cadence: { unit: 'days', value: 360 },
                thresholds: { yellow: 270, orange: 330, red: 360 },
                icon: 'ph-test-tube',
                instructions: '',
                alertKey,
                alert: getAlertConfig(alertsConfig, alertKey)
            }, {
                id: DEFAULT_BLOOD_STUDY_TRACKER_ID,
                now,
                order: getNextOrder(registry, 'health', 'controles')
            }),
            safeBloodTests.map(entry => entry?.date).filter(Boolean)
        );
        added += 1;
    }

    return added;
}

export function readLegacyTrackerSnapshot(storage) {
    const hygieneData = parseStoredJson(
        storage?.getItem?.('hygiene_tracker_data'),
        null
    );
    const groomingData = parseStoredJson(
        storage?.getItem?.('groomingData_v2'),
        null
    );
    const healthData = parseStoredJson(
        storage?.getItem?.('health_medical_data'),
        null
    );
    const alertsConfig = parseStoredJson(
        storage?.getItem?.('alerts_config'),
        {}
    );
    const bloodTests = parseStoredJson(
        storage?.getItem?.('health_blood_tests'),
        []
    );
    const lensData = Object.fromEntries(
        LENS_TRACKERS.map(item => [item.key, storage?.getItem?.(item.key)])
    );

    return {
        hygieneData,
        groomingData,
        healthData,
        bloodTests,
        alertsConfig,
        lensData,
        hasLegacyAccountData: Boolean(
            hasStoredRecordData(hygieneData, [
                CUSTOM_TRACKER_FIELD,
                LEGACY_CUSTOM_TRACKER_FIELD
            ])
            || hasStoredRecordData(groomingData)
            || hasStoredRecordData(healthData)
            || (Array.isArray(bloodTests) && bloodTests.length > 0)
            || Object.values(lensData).some(Boolean)
        )
    };
}

export function migrateLegacyTrackerRegistry({
    hygieneData = null,
    groomingData = null,
    healthData = null,
    bloodTests = [],
    lensData = {},
    alertsConfig = {},
    hasLegacyAccountData = false,
    now = new Date()
} = {}) {
    const timestamp = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(timestamp.getTime())) {
        throw new Error('La fecha de migración no es válida.');
    }

    const existingV2 = hygieneData?.[CUSTOM_TRACKER_FIELD];
    if (
        isRecord(existingV2)
        && [2, CUSTOM_TRACKER_SCHEMA_VERSION].includes(existingV2.version)
    ) {
        const versionUpgraded = existingV2.version !== CUSTOM_TRACKER_SCHEMA_VERSION;
        const registry = normalizeCustomTrackerRegistry(existingV2);
        const specialsAdded = migrateSpecialTrackers(registry, {
            hygieneData,
            bloodTests,
            alertsConfig,
            hasLegacyAccountData,
            now: timestamp
        });
        return {
            registry: normalizeCustomTrackerRegistry(registry),
            migrated: versionUpgraded || specialsAdded > 0,
            report: {
                source: `v${existingV2.version}`,
                total: registry.trackers.length,
                specialsAdded,
                versionUpgraded
            }
        };
    }

    const registry = createEmptyCustomTrackerRegistry();
    if (hasLegacyAccountData) {
        migrateBuiltInHygiene(registry, { hygieneData, alertsConfig, now: timestamp });
        migrateBuiltInGrooming(registry, { groomingData, alertsConfig, now: timestamp });
        migrateBuiltInLenses(registry, { lensData, alertsConfig, now: timestamp });
        migrateBuiltInHealth(registry, { healthData, alertsConfig, now: timestamp });
    }
    migrateV1CustomTrackers(registry, {
        legacyRegistry: hygieneData?.[LEGACY_CUSTOM_TRACKER_FIELD],
        alertsConfig,
        now: timestamp
    });
    migrateSpecialTrackers(registry, {
        hygieneData,
        bloodTests,
        alertsConfig,
        hasLegacyAccountData,
        now: timestamp
    });

    registry.migration = {
        migratedAt: timestamp.toISOString(),
        sourceVersion: hygieneData?.[LEGACY_CUSTOM_TRACKER_FIELD] ? 1 : 0,
        migratedTrackerCount: registry.trackers.length
    };
    const normalized = normalizeCustomTrackerRegistry(registry);
    return {
        registry: normalized,
        migrated: true,
        report: {
            source: hasLegacyAccountData ? 'legacy' : 'empty',
            total: normalized.trackers.length,
            bySection: Object.fromEntries(
                Object.keys(CUSTOM_TRACKER_SECTIONS).map(section => [
                    section,
                    normalized.trackers.filter(tracker => tracker.section === section).length
                ])
            )
        }
    };
}
