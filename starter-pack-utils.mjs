/**
 * starter-pack-utils.mjs
 * Plantillas y configuración inicial opcional para cuentas nuevas.
 * Fase F (Tanda 26).
 *
 * Provee un catálogo curado de tarjetas y recordatorios predeterminados
 * con vista previa, selección granular, sin copiar datos personales,
 * fechas privadas ni historiales del propietario.
 */

export const STARTER_PACK_PRESETS = Object.freeze([
    {
        id: 'starter_cepillo',
        moduleId: 'higiene',
        title: 'Recambio de cepillo dental',
        periodDays: 90,
        category: 'Higiene',
        icon: 'ph-sparkle',
        description: 'Recomendación odontológica estándar para recambio de cepillo o cabezal.'
    },
    {
        id: 'starter_pelo',
        moduleId: 'cuidado',
        title: 'Corte de cabello',
        periodDays: 30,
        category: 'Cuidado Personal',
        icon: 'ph-scissors',
        description: 'Mantenimiento periódico de estética y cuidado personal.'
    },
    {
        id: 'starter_lentes',
        moduleId: 'lentes',
        title: 'Limpieza profunda de cristales',
        periodDays: 7,
        category: 'Lentes',
        icon: 'ph-eye',
        description: 'Limpieza e inspección de armazón y tratamiento antirreflejo.'
    },
    {
        id: 'starter_chequeo_medico',
        moduleId: 'salud',
        title: 'Control médico clínico anual',
        periodDays: 365,
        category: 'Salud',
        icon: 'ph-heartbeat',
        description: 'Consulta preventiva y revisión general de rutina.'
    },
    {
        id: 'starter_aceite_auto',
        moduleId: 'vehiculo',
        title: 'Cambio de aceite y filtro',
        periodDays: 180,
        category: 'Vehículo',
        icon: 'ph-car',
        description: 'Control de lubricante y fluidos de motor cada 6 meses o 10.000 km.'
    },
    {
        id: 'starter_seguro_auto',
        moduleId: 'vehiculo',
        title: 'Vencimiento de póliza de seguro',
        periodDays: 30,
        category: 'Vehículo',
        icon: 'ph-shield-check',
        description: 'Aviso de renovación y pago mensual de seguro.'
    }
]);

/**
 * Devuelve la lista de plantillas disponibles para vista previa.
 *
 * @returns {typeof STARTER_PACK_PRESETS}
 */
export function getStarterPresets() {
    return STARTER_PACK_PRESETS;
}

/**
 * Aplica una selección de plantillas sobre un catálogo o registro existente
 * evitando duplicados por nombre y garantizando campos limpios (sin datos privados).
 *
 * @param {Object} options
 * @param {string[]} options.selectedPresetIds - IDs de plantillas elegidas
 * @param {Array<{ title?: string, name?: string }>} [options.existingItems=[]] - Items ya existentes
 * @returns {Array<Object>} Elementos nuevos a incorporar
 */
export function buildStarterItemsToApply({ selectedPresetIds = [], existingItems = [] } = {}) {
    const existingNames = new Set(
        existingItems
            .map(item => String(item.title || item.name || '').trim().toLowerCase())
            .filter(Boolean)
    );

    const itemsToCreate = [];

    for (const preset of STARTER_PACK_PRESETS) {
        if (!selectedPresetIds.includes(preset.id)) continue;

        const cleanName = preset.title.trim().toLowerCase();
        if (existingNames.has(cleanName)) {
            // No duplicar si ya existe
            continue;
        }

        existingNames.add(cleanName);
        itemsToCreate.push({
            id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            moduleId: preset.moduleId,
            title: preset.title,
            periodDays: preset.periodDays,
            icon: preset.icon,
            category: preset.category,
            notes: preset.description,
            isArchived: false,
            history: [], // Historial completamente limpio
            createdAt: new Date().toISOString()
        });
    }

    return itemsToCreate;
}
