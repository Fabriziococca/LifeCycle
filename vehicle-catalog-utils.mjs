export const VEHICLE_CATALOG_FIELD = 'vehicleCatalog';
export const VEHICLE_CATALOG_VERSION = 1;
export const VEHICLE_ALERT_PREFIX = 'vehicle_card:';

export const VEHICLE_CARD_TYPES = Object.freeze({
    maintenance: Object.freeze({
        label: 'Mantenimiento por kilometraje o tiempo',
        defaultIcon: 'ph-wrench',
        defaultAction: 'Registrar mantenimiento'
    }),
    check: Object.freeze({
        label: 'Control periódico',
        defaultIcon: 'ph-check-circle',
        defaultAction: 'Registrar control'
    }),
    document: Object.freeze({
        label: 'Documento o vencimiento',
        defaultIcon: 'ph-file-text',
        defaultAction: 'Guardar vencimiento'
    })
});

export const VEHICLE_CARD_SECTIONS = Object.freeze({
    maintenance: Object.freeze({ label: 'Mantenimiento y controles' }),
    documents: Object.freeze({ label: 'Documentación' })
});

export const VEHICLE_CARD_ICONS = Object.freeze({
    'ph-drop-half-bottom': 'Aceite',
    'ph-arrows-clockwise': 'Neumáticos',
    'ph-wrench': 'Mantenimiento',
    'ph-gauge': 'Kilometraje',
    'ph-thermometer-cold': 'Refrigerante',
    'ph-drop': 'Líquido',
    'ph-arrows-left-right': 'Escobillas',
    'ph-fire-extinguisher': 'Matafuegos',
    'ph-identification-card': 'Identificación',
    'ph-cardholder': 'Registro',
    'ph-shield-checkered': 'Seguro',
    'ph-file-text': 'Documento',
    'ph-check-circle': 'Control',
    'ph-car': 'Vehículo'
});

const CARD_ID_PATTERN = /^vc_[a-z0-9_-]{3,96}$/;
const ALERT_KEY_PATTERN = /^[a-z0-9:_-]{3,120}$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const LEGACY_CARDS = Object.freeze([
    {
        id: 'vc_oil', legacyId: 'oil', name: 'Aceite y Filtros',
        type: 'maintenance', section: 'maintenance', icon: 'ph-drop-half-bottom',
        actionLabel: 'Registrar cambio', intervalKm: 10000, intervalDays: 365,
        warningKm: 1000, warningDays: 30, alertKey: 'vehicle_oil', alertTime: '23:00',
        source: { kind: 'maintenance', key: 'Aceite y Filtros' }
    },
    {
        id: 'vc_alignment', legacyId: 'align', name: 'Alineación & Balanceo',
        type: 'maintenance', section: 'maintenance', icon: 'ph-wrench',
        actionLabel: 'Alinear y balancear hoy', intervalKm: 10000, intervalDays: null,
        warningKm: 1000, warningDays: null, alertKey: 'vehicle_align', alertTime: '23:00',
        source: { kind: 'maintenance', key: 'Alineación & Balanceo' }
    },
    {
        id: 'vc_rotation', legacyId: 'rot', name: 'Rotación de Neumáticos',
        type: 'maintenance', section: 'maintenance', icon: 'ph-arrows-clockwise',
        actionLabel: 'Rotar neumáticos hoy', intervalKm: 10000, intervalDays: null,
        warningKm: 1000, warningDays: null, alertKey: 'vehicle_rot', alertTime: '23:00',
        source: { kind: 'maintenance', key: 'Rotación de Neumáticos' }
    },
    {
        id: 'vc_tires', legacyId: 'replace', name: 'Reemplazo de Neumáticos',
        type: 'maintenance', section: 'maintenance', icon: 'ph-arrows-clockwise',
        actionLabel: 'Registrar neumáticos nuevos', intervalKm: 60000, intervalDays: null,
        warningKm: 1000, warningDays: null, alertKey: 'vehicle_replace', alertTime: '23:00',
        source: { kind: 'maintenance', key: 'Reemplazo de Neumáticos' }
    },
    {
        id: 'vc_coolant', legacyId: 'refrigerante', name: 'Refrigerante de Motor',
        type: 'check', section: 'maintenance', icon: 'ph-thermometer-cold',
        actionLabel: 'Revisado o cargado hoy', intervalKm: null, intervalDays: 90,
        warningKm: null, warningDays: 15, alertKey: 'vehicle_card:vc_coolant', alertTime: '09:00',
        source: { kind: 'tracker', key: 'refrigeranteDate' }, legacyAlertGroup: 'vehicle_fluids_check'
    },
    {
        id: 'vc_washer', legacyId: 'sapito', name: 'Limpiavidrios (Sapito)',
        type: 'check', section: 'maintenance', icon: 'ph-drop',
        actionLabel: 'Revisado o cargado hoy', intervalKm: null, intervalDays: 45,
        warningKm: null, warningDays: 10, alertKey: 'vehicle_card:vc_washer', alertTime: '09:00',
        source: { kind: 'tracker', key: 'sapitoDate' }, legacyAlertGroup: 'vehicle_fluids_check'
    },
    {
        id: 'vc_wipers', legacyId: 'escobillas', name: 'Escobillas Limpiaparabrisas',
        type: 'check', section: 'maintenance', icon: 'ph-arrows-left-right',
        actionLabel: 'Registrar cambio', intervalKm: null, intervalDays: 240,
        warningKm: null, warningDays: 60, alertKey: 'vehicle_card:vc_wipers', alertTime: '09:00',
        source: { kind: 'tracker', key: 'escobillasDate' }, legacyAlertGroup: 'vehicle_fluids_check'
    },
    {
        id: 'vc_extinguisher', legacyId: 'extintor', name: 'Matafuegos (Extintor)',
        type: 'document', section: 'maintenance', icon: 'ph-fire-extinguisher',
        actionLabel: 'Guardar vencimiento', intervalKm: null, intervalDays: null,
        warningKm: null, warningDays: 30, alertKey: 'vehicle_card:vc_extinguisher', alertTime: '09:00',
        source: { kind: 'tracker', key: 'extintorDate' }, legacyAlertGroup: 'vehicle_fluids_check'
    },
    {
        id: 'vc_dni', legacyId: 'dni', name: 'DNI (Documento Nacional de Identidad)',
        type: 'document', section: 'documents', icon: 'ph-identification-card',
        actionLabel: 'Guardar vencimiento', intervalKm: null, intervalDays: null,
        warningKm: null, warningDays: 30, alertKey: 'vehicle_card:vc_dni', alertTime: '09:00',
        source: { kind: 'tracker', key: 'dniExpDate' }, legacyAlertGroup: 'vehicle_docs_check'
    },
    {
        id: 'vc_license', legacyId: 'license', name: 'Registro de Conducir',
        type: 'document', section: 'documents', icon: 'ph-cardholder',
        actionLabel: 'Guardar vencimiento', intervalKm: null, intervalDays: null,
        warningKm: null, warningDays: 30, alertKey: 'vehicle_card:vc_license', alertTime: '09:00',
        source: { kind: 'tracker', key: 'licenseExpDate' }, legacyAlertGroup: 'vehicle_docs_check'
    },
    {
        id: 'vc_insurance', legacyId: 'insurance', name: 'Seguro del Auto',
        type: 'document', section: 'documents', icon: 'ph-shield-checkered',
        actionLabel: 'Guardar vencimiento', intervalKm: null, intervalDays: null,
        warningKm: null, warningDays: 7, alertKey: 'vehicle_card:vc_insurance', alertTime: '09:00',
        source: { kind: 'tracker', key: 'insuranceExpDate' }, legacyAlertGroup: 'vehicle_docs_check'
    },
    {
        id: 'vc_vtv', legacyId: 'vtv', name: 'VTV (Verificación Técnica Vehicular)',
        type: 'document', section: 'documents', icon: 'ph-wrench',
        actionLabel: 'Guardar vencimiento', intervalKm: null, intervalDays: null,
        warningKm: null, warningDays: 30, alertKey: 'vehicle_card:vc_vtv', alertTime: '09:00',
        source: { kind: 'tracker', key: 'vtvExpDate' }, legacyAlertGroup: 'vehicle_docs_check'
    }
]);

function cleanText(value, fallback = '', maxLength = 100) {
    const text = typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim()
        : '';
    return (text || fallback).slice(0, maxLength);
}

function normalizeOptionalInteger(value, { min = 1, max = 1_000_000 } = {}) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max
        ? parsed
        : null;
}

function normalizeDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return '';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day
    ) ? value : '';
}

function normalizeRecord(value, fallbackId = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const date = normalizeDate(value.date);
    if (!date) return null;
    const id = cleanText(value.id, fallbackId, 100);
    if (!id || UNSAFE_KEYS.has(id.toLowerCase())) return null;
    const km = normalizeOptionalInteger(value.km, { min: 0, max: 10_000_000 });
    const details = value.details && typeof value.details === 'object' && !Array.isArray(value.details)
        ? { ...value.details }
        : {};
    return {
        id,
        date,
        ...(km !== null ? { km } : {}),
        details
    };
}

function normalizeCard(value, fallbackOrder = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = cleanText(value.id, '', 100).toLowerCase();
    const type = Object.hasOwn(VEHICLE_CARD_TYPES, value.type)
        ? value.type
        : '';
    const section = Object.hasOwn(VEHICLE_CARD_SECTIONS, value.section)
        ? value.section
        : (type === 'document' ? 'documents' : 'maintenance');
    const name = cleanText(value.name, '', 80);
    if (!CARD_ID_PATTERN.test(id) || !type || !name) return null;
    if (type !== 'document' && section === 'documents') return null;

    const icon = Object.hasOwn(VEHICLE_CARD_ICONS, value.icon)
        ? value.icon
        : VEHICLE_CARD_TYPES[type].defaultIcon;
    const alertKey = ALERT_KEY_PATTERN.test(value.alertKey || '')
        ? value.alertKey
        : `${VEHICLE_ALERT_PREFIX}${id}`;
    const alertTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(value.alert?.time || '')
        ? value.alert.time
        : (section === 'documents' ? '09:00' : '23:00');
    const source = value.source && typeof value.source === 'object' && !Array.isArray(value.source)
        ? {
            kind: ['maintenance', 'tracker'].includes(value.source.kind)
                ? value.source.kind
                : '',
            key: cleanText(value.source.key, '', 100)
        }
        : null;

    return {
        id,
        legacyId: cleanText(value.legacyId, '', 40) || null,
        name,
        type,
        section,
        icon,
        actionLabel: cleanText(
            value.actionLabel,
            VEHICLE_CARD_TYPES[type].defaultAction,
            80
        ),
        intervalKm: normalizeOptionalInteger(value.intervalKm),
        intervalDays: normalizeOptionalInteger(value.intervalDays, { max: 3650 }),
        warningKm: normalizeOptionalInteger(value.warningKm),
        warningDays: normalizeOptionalInteger(value.warningDays, { max: 3650 }),
        alertKey,
        alert: {
            enabled: value.alert?.enabled !== false,
            time: alertTime
        },
        source: source?.kind && source.key ? source : null,
        legacyAlertGroup: ['vehicle_docs_check', 'vehicle_fluids_check'].includes(value.legacyAlertGroup)
            ? value.legacyAlertGroup
            : null,
        order: normalizeOptionalInteger(value.order, { min: 0, max: 10000 }) ?? fallbackOrder,
        archived: value.archived === true,
        deleted: value.deleted === true,
        createdAt: cleanText(value.createdAt, '', 40) || null,
        updatedAt: cleanText(value.updatedAt, '', 40) || null,
        deletedAt: cleanText(value.deletedAt, '', 40) || null
    };
}

function emptyCatalog() {
    return {
        version: VEHICLE_CATALOG_VERSION,
        cards: [],
        records: {}
    };
}

function assertVehicleCardIntervals(card) {
    if (card.type === 'maintenance' && !card.intervalKm && !card.intervalDays) {
        throw new TypeError('El mantenimiento necesita un intervalo por kilómetros o días.');
    }
    if (card.type === 'check' && !card.intervalDays) {
        throw new TypeError('El control periódico necesita un intervalo en días.');
    }
    if (card.warningKm && !card.intervalKm) {
        throw new TypeError('El aviso por kilómetros necesita un intervalo por kilómetros.');
    }
    if (card.warningKm && card.intervalKm && card.warningKm > card.intervalKm) {
        throw new TypeError('El aviso por kilómetros no puede superar el intervalo.');
    }
    if (card.type !== 'document' && card.warningDays && !card.intervalDays) {
        throw new TypeError('El aviso por días necesita un intervalo en días.');
    }
    if (
        card.type !== 'document'
        && card.warningDays
        && card.intervalDays
        && card.warningDays > card.intervalDays
    ) {
        throw new TypeError('El aviso por días no puede superar el intervalo.');
    }
}

export function normalizeVehicleCatalog(value, { strict = false } = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
    const cards = [];
    const seenIds = new Set();
    (Array.isArray(source.cards) ? source.cards : []).forEach((candidate, index) => {
        const card = normalizeCard(candidate, index);
        if (!card || seenIds.has(card.id)) {
            if (strict) throw new TypeError(`Tarjeta de vehículo inválida en cards[${index}].`);
            return;
        }
        if (strict) assertVehicleCardIntervals(card);
        seenIds.add(card.id);
        cards.push(card);
    });

    const records = {};
    const recordSource = source.records && typeof source.records === 'object' && !Array.isArray(source.records)
        ? source.records
        : {};
    Object.entries(recordSource).forEach(([cardId, values]) => {
        if (!seenIds.has(cardId) || !Array.isArray(values)) {
            if (strict) throw new TypeError(`Historial de vehículo inválido para ${cardId}.`);
            return;
        }
        const seenRecordIds = new Set();
        records[cardId] = values.flatMap((candidate, index) => {
            const record = normalizeRecord(candidate, `vcr_${cardId}_${index}`);
            if (!record || seenRecordIds.has(record.id)) {
                if (strict) throw new TypeError(`Registro de vehículo inválido en ${cardId}[${index}].`);
                return [];
            }
            seenRecordIds.add(record.id);
            return [record];
        });
    });
    cards.forEach(card => {
        if (!records[card.id]) records[card.id] = [];
    });

    return {
        version: VEHICLE_CATALOG_VERSION,
        cards: cards.sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order),
        records
    };
}

export function validateVehicleCatalog(value) {
    return normalizeVehicleCatalog(value, { strict: true });
}

function legacyRecordsForCard(definition, trackerData, maintenanceLog) {
    if (definition.source.kind === 'maintenance') {
        return maintenanceLog
            .filter(entry => entry?.type === definition.source.key)
            .flatMap((entry, index) => {
                const record = normalizeRecord(entry, `vcr_${definition.id}_${index}`);
                return record ? [record] : [];
            });
    }
    const date = normalizeDate(trackerData?.[definition.source.key]);
    return date
        ? [{ id: `vcr_${definition.id}_legacy`, date, details: {} }]
        : [];
}

export function migrateVehicleCatalog({
    catalogValue,
    trackerData = {},
    maintenanceLog = [],
    hasLegacyData = false,
    now = new Date()
} = {}) {
    if (catalogValue && typeof catalogValue === 'object' && !Array.isArray(catalogValue)) {
        return {
            catalog: normalizeVehicleCatalog(catalogValue),
            migrated: false,
            seededLegacyCards: false
        };
    }
    if (!hasLegacyData) {
        return {
            catalog: emptyCatalog(),
            migrated: true,
            seededLegacyCards: false
        };
    }

    const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
    const records = {};
    const cards = LEGACY_CARDS.map((definition, order) => {
        const card = normalizeCard({
            ...definition,
            order,
            alert: { enabled: true, time: definition.alertTime },
            createdAt: timestamp,
            updatedAt: timestamp
        }, order);
        records[card.id] = legacyRecordsForCard(
            definition,
            trackerData,
            Array.isArray(maintenanceLog) ? maintenanceLog : []
        );
        return card;
    });

    return {
        catalog: normalizeVehicleCatalog({
            version: VEHICLE_CATALOG_VERSION,
            cards,
            records
        }),
        migrated: true,
        seededLegacyCards: true
    };
}

export function createVehicleCard(input, {
    id,
    order = 0,
    now = new Date()
} = {}) {
    const generatedId = id || `vc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
    const card = normalizeCard({
        ...input,
        id: generatedId,
        alertKey: input?.alertKey || `${VEHICLE_ALERT_PREFIX}${generatedId}`,
        order,
        archived: false,
        deleted: false,
        createdAt: timestamp,
        updatedAt: timestamp
    }, order);
    if (!card) throw new TypeError('Los datos de la tarjeta de vehículo no son válidos.');
    assertVehicleCardIntervals(card);
    return card;
}

export function updateVehicleCard(catalogValue, cardId, patch, {
    now = new Date()
} = {}) {
    const catalog = normalizeVehicleCatalog(catalogValue);
    const index = catalog.cards.findIndex(card => card.id === cardId);
    if (index < 0) throw new TypeError('La tarjeta de vehículo no existe.');
    const current = catalog.cards[index];
    const hasRecords = (catalog.records[cardId] || []).length > 0;
    if (hasRecords && patch?.type && patch.type !== current.type) {
        throw new TypeError('No se puede cambiar el tipo de una tarjeta con historial.');
    }
    const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
    const next = normalizeCard({
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
        id: current.id,
        legacyId: current.legacyId,
        source: current.source,
        alertKey: current.alertKey,
        legacyAlertGroup: current.legacyAlertGroup,
        createdAt: current.createdAt,
        updatedAt: timestamp
    }, current.order);
    if (!next) throw new TypeError('Los cambios de la tarjeta no son válidos.');
    assertVehicleCardIntervals(next);
    catalog.cards[index] = next;
    return normalizeVehicleCatalog(catalog);
}

export function appendVehicleCardRecord(catalogValue, cardId, recordValue) {
    const catalog = normalizeVehicleCatalog(catalogValue);
    const card = catalog.cards.find(item => item.id === cardId && !item.deleted);
    if (!card) throw new TypeError('La tarjeta de vehículo no existe o fue eliminada.');
    const record = normalizeRecord(recordValue, `vcr_${Date.now().toString(36)}`);
    if (!record) throw new TypeError('El registro de vehículo no es válido.');
    const existing = catalog.records[cardId] || [];
    catalog.records[cardId] = [record, ...existing.filter(item => item.id !== record.id)];
    return catalog;
}

export function removeVehicleCardRecord(catalogValue, cardId, recordId) {
    const catalog = normalizeVehicleCatalog(catalogValue);
    catalog.records[cardId] = (catalog.records[cardId] || [])
        .filter(record => record.id !== recordId);
    return catalog;
}

export function getVehicleCardLastRecord(catalogValue, cardId) {
    const catalog = normalizeVehicleCatalog(catalogValue);
    const card = catalog.cards.find(item => item.id === cardId);
    if (!card) return null;
    const records = [...(catalog.records[cardId] || [])];
    records.sort((a, b) => {
        if (card.type === 'maintenance') {
            return (Number(b.km) || 0) - (Number(a.km) || 0)
                || b.date.localeCompare(a.date);
        }
        return b.date.localeCompare(a.date);
    });
    return records[0] || null;
}

function calendarDayNumber(value) {
    if (typeof value === 'string') {
        const date = normalizeDate(value);
        if (!date) return null;
        const [year, month, day] = date.split('-').map(Number);
        return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    ) / 86_400_000);
}

export function getVehicleCardState(cardValue, records = [], {
    currentKm = 0,
    now = new Date()
} = {}) {
    const card = normalizeCard(cardValue);
    if (!card) return null;
    const catalog = normalizeVehicleCatalog({ cards: [card], records: { [card.id]: records } });
    const last = getVehicleCardLastRecord(catalog, card.id);
    if (!last) {
        return {
            tone: 'new',
            label: 'Sin registros',
            last: null,
            shouldNotify: false,
            remainingKm: null,
            remainingDays: null
        };
    }

    const todayNumber = calendarDayNumber(now);
    const recordNumber = calendarDayNumber(last.date);
    if (card.type === 'document') {
        const remainingDays = recordNumber - todayNumber;
        const shouldNotify = remainingDays <= (card.warningDays ?? 30);
        return {
            tone: remainingDays <= 0 ? 'red' : (shouldNotify ? 'orange' : 'green'),
            label: remainingDays < 0
                ? `Vencido hace ${Math.abs(remainingDays)} días`
                : (remainingDays === 0 ? 'Vence hoy' : `Vence en ${remainingDays} días`),
            last,
            shouldNotify,
            remainingKm: null,
            remainingDays
        };
    }

    const elapsedDays = recordNumber === null || todayNumber === null
        ? null
        : Math.max(0, todayNumber - recordNumber);
    const remainingDays = card.intervalDays && elapsedDays !== null
        ? card.intervalDays - elapsedDays
        : null;
    const remainingKm = card.intervalKm
        ? (Number(last.km) || 0) + card.intervalKm - (Number(currentKm) || 0)
        : null;
    const due = (remainingDays !== null && remainingDays <= 0)
        || (remainingKm !== null && remainingKm <= 0);
    const warning = !due && (
        (remainingDays !== null && card.warningDays && remainingDays <= card.warningDays)
        || (remainingKm !== null && card.warningKm && remainingKm <= card.warningKm)
    );
    return {
        tone: due ? 'red' : (warning ? 'orange' : 'green'),
        label: due ? 'Vencido' : (warning ? 'Próximo' : 'Al día'),
        last,
        shouldNotify: due,
        remainingKm,
        remainingDays,
        elapsedDays
    };
}

export function getVehicleAlertKey(cardOrId) {
    if (cardOrId && typeof cardOrId === 'object' && ALERT_KEY_PATTERN.test(cardOrId.alertKey || '')) {
        return cardOrId.alertKey;
    }
    const id = typeof cardOrId === 'string' ? cardOrId : '';
    return `${VEHICLE_ALERT_PREFIX}${id}`;
}

export function buildVehicleAlertDefinitions(catalogValue) {
    const catalog = normalizeVehicleCatalog(catalogValue);
    return catalog.cards
        .filter(card => !card.archived && !card.deleted)
        .map(card => ({
            key: getVehicleAlertKey(card),
            name: card.name,
            category: 'vehiculo',
            type: 'interval',
            defaultEnabled: card.alert.enabled === true,
            defaultTime: card.alert.time,
            defaultDays: []
        }));
}

export function getLegacyVehicleCards() {
    return LEGACY_CARDS.map((card, order) => normalizeCard({
        ...card,
        order,
        alert: { enabled: true, time: card.alertTime }
    }, order));
}
