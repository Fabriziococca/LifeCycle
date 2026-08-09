import {
    appendVehicleCardRecord,
    buildVehicleAlertDefinitions,
    createVehicleCard,
    getVehicleAlertKey,
    getVehicleCardLastRecord,
    getVehicleCardState,
    migrateVehicleCatalog,
    normalizeVehicleCatalog,
    removeVehicleCardRecord,
    updateVehicleCard,
    VEHICLE_CARD_ICONS,
    VEHICLE_CARD_SECTIONS,
    VEHICLE_CARD_TYPES,
    VEHICLE_CATALOG_FIELD
} from '../vehicle-catalog-utils.mjs?v=20260801-vehicle-catalog';
import { getLocalISODate } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

const DEPRECATED_VEHICLE_ALERT_KEYS = Object.freeze([
    'vehicle_oil',
    'vehicle_align',
    'vehicle_rot',
    'vehicle_replace',
    'vehicle_docs_check',
    'vehicle_fluids_check'
]);

const LEGACY_ELEMENT_MAP = Object.freeze({
    oil: Object.freeze({ rootId: 'vehicle-oil-card', titleSelector: '.card-header h3', actionSelector: '#btn-add-oil-service' }),
    align: Object.freeze({ rootId: 'vehicle-align-item', titleSelector: 'h4', actionSelector: '#btn-record-align' }),
    rot: Object.freeze({ rootId: 'vehicle-rotation-item', titleSelector: 'h4', actionSelector: '#btn-record-rot' }),
    replace: Object.freeze({ rootId: 'vehicle-replace-item', titleSelector: 'h4', actionSelector: '#btn-add-replace-service' }),
    refrigerante: Object.freeze({ rootId: 'fluid-card-refrigerante', titleSelector: 'h4', actionSelector: '#btn-check-refrigerante' }),
    sapito: Object.freeze({ rootId: 'fluid-card-sapito', titleSelector: 'h4', actionSelector: '#btn-check-sapito' }),
    escobillas: Object.freeze({ rootId: 'fluid-card-escobillas', titleSelector: 'h4', actionSelector: '#btn-check-escobillas' }),
    extintor: Object.freeze({ rootId: 'fluid-card-extintor', titleSelector: 'h4', actionSelector: '#btn-save-extintor' }),
    dni: Object.freeze({ rootId: 'doc-card-dni', titleSelector: 'h4' }),
    license: Object.freeze({ rootId: 'doc-card-license', titleSelector: 'h4' }),
    insurance: Object.freeze({ rootId: 'doc-card-insurance', titleSelector: 'h4' }),
    vtv: Object.freeze({ rootId: 'doc-card-vtv', titleSelector: 'h4' })
});

function parseOptionalInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function formatNumber(value) {
    return Number.isFinite(Number(value))
        ? Number(value).toLocaleString('es-AR')
        : '-';
}

function typeLabel(card) {
    return VEHICLE_CARD_TYPES[card.type]?.label || 'Tarjeta de vehículo';
}

export class VehicleCatalogModule {
    constructor(vehicleModule) {
        this.vehicle = vehicleModule;
        this.app = vehicleModule.controller;
        this.catalog = normalizeVehicleCatalog(null);
        this.editingId = null;
        this.recordingId = null;
        this.pendingDeleteIds = new Set();
        this.lastDialogTrigger = null;
        this.loadFromVehicleData();
        this.ensureEditorDialog();
        this.ensureRecordDialog();
        this.setupRuntimeListeners();
    }

    hasLegacyVehicleData() {
        return [
            'vehicle_odometer',
            'vehicle_maintenance_log',
            'vehicle_tracker_data',
            'vehicle_issues'
        ].some(key => localStorage.getItem(key) !== null);
    }

    loadFromVehicleData({ persistMigration = false } = {}) {
        const source = this.vehicle.trackerData?.[VEHICLE_CATALOG_FIELD];
        const result = migrateVehicleCatalog({
            catalogValue: source,
            trackerData: this.vehicle.trackerData,
            maintenanceLog: this.vehicle.maintenanceLog,
            hasLegacyData: this.hasLegacyVehicleData()
        });
        this.catalog = result.catalog;
        this.vehicle.trackerData[VEHICLE_CATALOG_FIELD] = this.catalog;
        this.lastMigration = result;

        if (result.migrated) {
            localStorage.setItem(
                'vehicle_tracker_data',
                JSON.stringify(this.vehicle.trackerData)
            );
            if (persistMigration) {
                this.app.triggerDataSync?.('vehicle_tracker_data');
            }
        }
        return result;
    }

    reload() {
        this.loadFromVehicleData({ persistMigration: true });
        this.renderRuntime();
        this.app.customTrackers?.renderManager?.();
        return this.lastMigration?.migrated === true;
    }

    getCards({ includeArchived = true, includeDeleted = false } = {}) {
        return this.catalog.cards
            .filter(card => includeArchived || !card.archived)
            .filter(card => includeDeleted || !card.deleted)
            .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order);
    }

    getCard(cardId) {
        return this.catalog.cards.find(card => card.id === cardId) || null;
    }

    getLegacyCard(legacyId) {
        return this.catalog.cards.find(card => card.legacyId === legacyId) || null;
    }

    getRecords(cardId) {
        return this.catalog.records[cardId] || [];
    }

    getLastRecord(cardId) {
        return getVehicleCardLastRecord(this.catalog, cardId);
    }

    getState(cardOrId, now = new Date()) {
        const card = typeof cardOrId === 'string'
            ? this.getCard(cardOrId)
            : cardOrId;
        if (!card) return null;
        return getVehicleCardState(card, this.getRecords(card.id), {
            currentKm: this.vehicle.odometer,
            now
        });
    }

    getAlertDefinitions() {
        return buildVehicleAlertDefinitions(this.catalog);
    }

    getManagedAlertKeys() {
        return new Set([
            ...DEPRECATED_VEHICLE_ALERT_KEYS,
            ...this.catalog.cards.map(card => getVehicleAlertKey(card))
        ]);
    }

    migrateAlertConfigs(configsValue = {}) {
        const configs = configsValue && typeof configsValue === 'object' && !Array.isArray(configsValue)
            ? { ...configsValue }
            : {};
        this.catalog.cards.forEach(card => {
            const key = getVehicleAlertKey(card);
            if (configs[key]) return;
            const legacyConfig = card.legacyAlertGroup
                ? configs[card.legacyAlertGroup]
                : null;
            configs[key] = {
                enabled: legacyConfig?.enabled ?? card.alert.enabled,
                time: legacyConfig?.time || card.alert.time,
                days: Array.isArray(legacyConfig?.days) ? legacyConfig.days : []
            };
        });
        return configs;
    }

    syncCardAlertConfig(card) {
        if (!card) return;
        let configs = this.app.alerts?.configs;
        if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
            try {
                configs = JSON.parse(localStorage.getItem('alerts_config') || '{}');
            } catch {
                configs = {};
            }
        }
        const key = getVehicleAlertKey(card);
        configs[key] = {
            ...(configs[key] || {}),
            enabled: card.alert.enabled === true,
            time: card.alert.time,
            days: Array.isArray(configs[key]?.days) ? configs[key].days : []
        };
        localStorage.setItem('alerts_config', JSON.stringify(configs));
        if (this.app.alerts) this.app.alerts.configs = configs;
        this.app.triggerDataSync?.('alerts_config');
    }

    getCardAlertConfig(card) {
        if (!card) return null;
        let configs = this.app.alerts?.configs;
        if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
            try {
                configs = JSON.parse(localStorage.getItem('alerts_config') || '{}');
            } catch {
                configs = {};
            }
        }
        return configs[getVehicleAlertKey(card)] || card.alert;
    }

    removeCardAlertConfig(card) {
        if (!card) return;
        let configs;
        try {
            configs = JSON.parse(localStorage.getItem('alerts_config') || '{}');
        } catch {
            configs = {};
        }
        const key = getVehicleAlertKey(card);
        delete configs[key];
        localStorage.setItem('alerts_config', JSON.stringify(configs));
        if (this.app.alerts) {
            delete this.app.alerts.configs[key];
        }
        this.app.triggerDataSync?.('alerts_config');
    }

    persist({ message = '' } = {}) {
        this.catalog = normalizeVehicleCatalog(this.catalog);
        this.vehicle.trackerData[VEHICLE_CATALOG_FIELD] = this.catalog;
        this.vehicle.saveTrackerData();
        this.vehicle.render();
        this.app.customTrackers?.renderManager?.();
        if (this.app.alerts) {
            this.app.alerts.loadData();
            this.app.alerts.renderTabs?.();
            this.app.alerts.renderContent?.();
        }
        this.app.notificationsCenter?.updateBadge();
        if (message) this.app.showToast?.(message);
    }

    mirrorLegacyRecord(legacyId, record) {
        const card = this.getLegacyCard(legacyId);
        if (!card || card.deleted) return;
        this.catalog = appendVehicleCardRecord(this.catalog, card.id, record);
        this.vehicle.trackerData[VEHICLE_CATALOG_FIELD] = this.catalog;
        localStorage.setItem(
            'vehicle_tracker_data',
            JSON.stringify(this.vehicle.trackerData)
        );
        this.app.triggerDataSync?.('vehicle_tracker_data');
    }

    removeMirroredRecord(recordId) {
        this.catalog.cards.forEach(card => {
            this.catalog = removeVehicleCardRecord(this.catalog, card.id, recordId);
        });
        this.vehicle.trackerData[VEHICLE_CATALOG_FIELD] = this.catalog;
        localStorage.setItem(
            'vehicle_tracker_data',
            JSON.stringify(this.vehicle.trackerData)
        );
        this.app.triggerDataSync?.('vehicle_tracker_data');
    }

    recordCard(cardId, {
        date = getLocalISODate(),
        km = null,
        details = {}
    } = {}) {
        const card = this.getCard(cardId);
        if (!card || card.archived || card.deleted) return false;
        const record = {
            id: `vcr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            date,
            ...(km !== null ? { km } : {}),
            details
        };
        this.catalog = appendVehicleCardRecord(this.catalog, cardId, record);

        if (card.source?.kind === 'maintenance') {
            const entry = {
                id: record.id,
                type: card.source.key,
                date: record.date,
                km: Number(record.km) || this.vehicle.odometer,
                details: record.details
            };
            this.vehicle.maintenanceLog.push(entry);
            this.vehicle.maintenanceLog.sort((a, b) => (
                (Number(b.km) || 0) - (Number(a.km) || 0)
                || String(b.date).localeCompare(String(a.date))
            ));
            this.vehicle.saveMaintenanceLog();
        } else if (card.source?.kind === 'tracker') {
            this.vehicle.trackerData[card.source.key] = record.date;
        }

        this.persist({ message: `${card.name}: registro guardado.` });
        return true;
    }

    removeRecord(cardId, recordId) {
        this.catalog = removeVehicleCardRecord(this.catalog, cardId, recordId);
        const card = this.getCard(cardId);
        if (card?.source?.kind === 'maintenance') {
            this.vehicle.maintenanceLog = this.vehicle.maintenanceLog
                .filter(entry => entry.id !== recordId);
            this.vehicle.saveMaintenanceLog();
        }
        this.persist();
    }

    setupRuntimeListeners() {
        const root = document.getElementById('vehiculo-section');
        root?.addEventListener('click', event => {
            const actionButton = event.target.closest('[data-vehicle-card-action]');
            if (!actionButton) return;
            const cardId = actionButton.dataset.vehicleCardId;
            const action = actionButton.dataset.vehicleCardAction;
            if (action === 'edit-config') {
                this.openManagerEditor(cardId);
            } else if (action === 'record') {
                const card = this.getCard(cardId);
                if (card?.type === 'check') {
                    this.recordCard(cardId);
                } else if (card?.type === 'maintenance') {
                    this.openRecordDialog(cardId, actionButton);
                }
            } else if (action === 'save-document') {
                const input = root.querySelector(
                    `[data-vehicle-document-input="${CSS.escape(cardId)}"]`
                );
                if (!input?.value) {
                    void this.app.showMessage({
                        title: 'Falta la fecha',
                        message: 'Seleccioná una fecha de vencimiento antes de guardar.',
                        tone: 'warning'
                    });
                    return;
                }
                this.recordCard(cardId, { date: input.value });
            }
        });
    }

    openManagerEditor(cardId) {
        const card = this.getCard(cardId);
        const manager = this.app.customTrackers;
        if (!card || card.archived || card.deleted || !manager) return false;

        manager.activeCategoryFilter = 'vehicle';
        manager.managerSearchQuery = '';
        this.app.saveUiState?.({ trackerManagerFilter: 'vehicle' });
        if (!this.app.openProfileTab?.('seguimientos')) return false;

        requestAnimationFrame(() => {
            const editButton = manager.managerRoot?.querySelector(
                `[data-vehicle-manager-action="edit"][data-vehicle-card-id="${card.id}"]`
            );
            const row = editButton?.closest('.custom-manager-row');
            row?.classList.add('is-targeted');
            row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            this.openEditor(card.id, editButton || null);
            if (row) {
                setTimeout(() => row.classList.remove('is-targeted'), 1800);
            }
        });
        return true;
    }

    ensureLegacyEditButton(root, title, card) {
        const host = title?.parentElement;
        if (!root || !host || !card) return;

        host.classList.add('vehicle-config-title-host');
        host.classList.toggle('is-root', host === root);
        let button = host.querySelector(
            ':scope > [data-vehicle-card-action="edit-config"]'
        );
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'vehicle-config-edit icon-btn icon-btn-sm';
            button.dataset.vehicleCardAction = 'edit-config';
            button.innerHTML = '<i class="ph ph-pencil-simple" aria-hidden="true"></i>';
            host.appendChild(button);
        }
        button.dataset.vehicleCardId = card.id;
        button.setAttribute('aria-label', `Editar configuración de ${card.name}`);
        button.dataset.tooltip = 'Editar configuración';
    }

    applyLegacyVisibility() {
        Object.entries(LEGACY_ELEMENT_MAP).forEach(([legacyId, config]) => {
            const card = this.getLegacyCard(legacyId);
            const root = document.getElementById(config.rootId);
            if (!root) return;
            const visible = Boolean(card && !card.archived && !card.deleted);
            root.classList.toggle('hidden', !visible);
            if (!card) return;
            root.dataset.vehicleCardId = card.id;
            const title = root.querySelector(config.titleSelector);
            if (title) title.textContent = card.name;
            this.ensureLegacyEditButton(root, title, card);
            const icon = Array.from(root.querySelectorAll('i'))
                .find(candidate => !candidate.closest('.vehicle-config-edit'));
            if (icon) icon.className = `ph ${card.icon}`;
            const action = config.actionSelector
                ? root.querySelector(config.actionSelector)
                : null;
            if (action) {
                const icon = action.querySelector('i');
                action.replaceChildren();
                if (icon) action.appendChild(icon);
                action.appendChild(document.createTextNode(` ${card.actionLabel}`));
            }
        });

        const tireIds = ['align', 'rot', 'replace'];
        const fluidIds = ['refrigerante', 'sapito', 'escobillas', 'extintor'];
        const docIds = ['dni', 'license', 'insurance', 'vtv'];
        document.getElementById('vehicle-tires-card')?.classList.toggle(
            'hidden',
            !tireIds.some(id => {
                const card = this.getLegacyCard(id);
                return card && !card.archived && !card.deleted;
            })
        );
        document.getElementById('vehicle-fluids-card')?.classList.toggle(
            'hidden',
            !fluidIds.some(id => {
                const card = this.getLegacyCard(id);
                return card && !card.archived && !card.deleted;
            })
        );
        document.getElementById('vehicle-docs-card')?.classList.toggle(
            'hidden',
            !docIds.some(id => {
                const card = this.getLegacyCard(id);
                return card && !card.archived && !card.deleted;
            })
        );
    }

    renderRuntime() {
        this.applyLegacyVisibility();
        this.renderDynamicSection('maintenance', 'vehicle-custom-maintenance-cards');
        this.renderDynamicSection('documents', 'vehicle-custom-document-cards');
    }

    renderDynamicSection(section, hostId) {
        const host = document.getElementById(hostId);
        if (!host) return;
        const cards = this.getCards({ includeArchived: false })
            .filter(card => !card.legacyId && card.section === section);
        host.innerHTML = cards.map(card => this.renderRuntimeCard(card)).join('');
        host.classList.toggle('hidden', cards.length === 0);
    }

    renderRuntimeCard(card) {
        const state = this.getState(card);
        const last = state?.last;
        const safeName = escapeHtml(card.name);
        const safeAction = escapeHtml(card.actionLabel);
        const safeIcon = escapeHtml(card.icon);
        const status = escapeHtml(state?.label || 'Sin registros');
        const lastText = last
            ? `${this.vehicle.formatDate(last.date)}${last.km !== undefined ? ` · ${formatNumber(last.km)} km` : ''}`
            : 'Nunca';
        let detail = 'El primer registro activa el seguimiento.';
        if (card.type === 'maintenance' && last) {
            const values = [];
            if (state.remainingKm !== null) values.push(`${formatNumber(state.remainingKm)} km restantes`);
            if (state.remainingDays !== null) values.push(`${state.remainingDays} días restantes`);
            detail = values.join(' · ') || 'Mantenimiento registrado.';
        } else if (card.type === 'check' && last) {
            detail = `${state.elapsedDays} de ${card.intervalDays} días desde el último control.`;
        } else if (card.type === 'document' && last) {
            detail = status;
        }

        const action = card.type === 'document'
            ? `
                <div class="vehicle-dynamic-document-action">
                    <input type="date" class="date-input" data-vehicle-document-input="${card.id}" value="${escapeHtml(last?.date || '')}" aria-label="Vencimiento de ${safeName}">
                    <button type="button" class="btn btn-primary" data-vehicle-card-action="save-document" data-vehicle-card-id="${card.id}">
                        <i class="ph ph-floppy-disk"></i> ${safeAction}
                    </button>
                </div>
            `
            : `
                <button type="button" class="btn btn-record" data-vehicle-card-action="record" data-vehicle-card-id="${card.id}">
                    <i class="ph ph-check-circle"></i> ${safeAction}
                </button>
            `;

        return `
            <article class="card vehicle-dynamic-card" data-vehicle-card-id="${card.id}" data-tone="${state?.tone || 'new'}">
                <div class="card-header">
                    <div class="icon-container"><i class="ph ${safeIcon}"></i></div>
                    <div class="vehicle-dynamic-card-title">
                        <h3>${safeName}</h3>
                        <span>${escapeHtml(typeLabel(card))}</span>
                    </div>
                    <div class="vehicle-dynamic-card-header-actions">
                        <span class="badge ${state?.tone === 'red' ? 'red' : (state?.tone === 'orange' ? 'orange' : (state?.tone === 'green' ? 'green' : 'gray'))}">${status}</span>
                        <button type="button" class="vehicle-config-edit icon-btn icon-btn-sm" data-vehicle-card-action="edit-config" data-vehicle-card-id="${card.id}" aria-label="Editar configuración de ${safeName}" data-tooltip="Editar configuración">
                            <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body vehicle-dynamic-card-body">
                    <div class="vehicle-dynamic-card-state">
                        <span>Último: <strong>${escapeHtml(lastText)}</strong></span>
                        <small>${escapeHtml(detail)}</small>
                    </div>
                    ${action}
                </div>
            </article>
        `;
    }

    normalizeManagerSearchText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('es')
            .trim();
    }

    getManagerCardsMatching(query = '') {
        const normalizedQuery = this.normalizeManagerSearchText(query);
        return this.getCards().filter(card => {
            if (!normalizedQuery) return true;
            return this.normalizeManagerSearchText([
                card.name,
                typeLabel(card),
                VEHICLE_CARD_SECTIONS[card.section]?.label
            ].filter(Boolean).join(' ')).includes(normalizedQuery);
        });
    }

    renderManagerSection({ query = '' } = {}) {
        const normalizedQuery = this.normalizeManagerSearchText(query);
        const allActive = this.getCards({ includeArchived: false });
        const allArchived = this.getCards().filter(card => card.archived);
        const matchingIds = new Set(
            this.getManagerCardsMatching(query).map(card => card.id)
        );
        const active = allActive.filter(card => matchingIds.has(card.id));
        const archived = allArchived.filter(card => matchingIds.has(card.id));
        const groups = Object.entries(VEHICLE_CARD_SECTIONS).map(([sectionKey, section]) => ({
            key: sectionKey,
            label: section.label,
            cards: active.filter(card => card.section === sectionKey)
        })).filter(group => group.cards.length > 0);
        const archivedLabel = allArchived.length
            ? ` · ${allArchived.length} ${allArchived.length === 1 ? 'archivada' : 'archivadas'}`
            : '';
        const filteredLabel = normalizedQuery
            ? ` · ${active.length + archived.length} ${active.length + archived.length === 1 ? 'coincidencia' : 'coincidencias'}`
            : '';

        if (normalizedQuery && active.length + archived.length === 0) return '';

        return `
            <section class="custom-manager-section" data-manager-section="vehicle">
                <div class="custom-manager-section-header">
                    <div>
                        <span class="custom-manager-section-icon"><i class="ph ph-car"></i></span>
                        <span>
                            <h3>Vehículo</h3>
                            <small>${allActive.length} ${allActive.length === 1 ? 'activa' : 'activas'}${archivedLabel}${filteredLabel}</small>
                        </span>
                    </div>
                    <button type="button" class="custom-manager-add" data-vehicle-manager-action="new" aria-label="Crear tarjeta de vehículo" data-tooltip="Crear tarjeta de vehículo">
                        <i class="ph ph-plus"></i>
                    </button>
                </div>
                <div class="custom-manager-list">
                    ${groups.length ? groups.map(group => `
                        <div class="custom-manager-group">
                            <div class="custom-manager-group-label">
                                <span>${escapeHtml(group.label)}</span>
                                <small>${group.cards.length}</small>
                            </div>
                            <div class="custom-manager-sortable-list">
                                ${group.cards.map(card => this.renderManagerRow(card)).join('')}
                            </div>
                        </div>
                    `).join('') : `
                        <p class="custom-manager-empty">
                            ${normalizedQuery
                                ? 'No hay tarjetas activas que coincidan con la búsqueda.'
                                : 'No hay tarjetas activas en Vehículo.'}
                        </p>
                    `}
                    ${archived.length ? `
                        <details class="custom-manager-archived" ${
                            normalizedQuery
                            || archived.some(card => this.pendingDeleteIds.has(card.id))
                                ? 'open'
                                : ''
                        }>
                            <summary>
                                <span><i class="ph ph-archive" aria-hidden="true"></i> Archivadas</span>
                                <span class="custom-manager-archived-count">${archived.length}</span>
                            </summary>
                            <div class="custom-manager-archived-grid">
                                ${archived.map(card => this.renderManagerRow(card, true)).join('')}
                            </div>
                        </details>
                    ` : ''}
                </div>
            </section>
        `;
    }

    renderManagerRow(card, archived = false) {
        const pendingDelete = this.pendingDeleteIds.has(card.id);
        const safeName = escapeHtml(card.name);
        const safeType = escapeHtml(typeLabel(card));
        const safeIcon = escapeHtml(card.icon);
        if (pendingDelete) {
            return `
                <div class="custom-manager-row archived" data-vehicle-card-id="${card.id}">
                    <span class="custom-manager-row-name">
                        <i class="ph ph-warning"></i>
                        <span><strong>¿Borrar ${safeName} y todo su historial?</strong><small>Esta acción no se puede deshacer.</small></span>
                    </span>
                    <span class="custom-manager-row-actions">
                        <button type="button" class="text-action" data-vehicle-manager-action="cancel-delete" data-vehicle-card-id="${card.id}">Cancelar</button>
                        <button type="button" class="text-action danger" data-vehicle-manager-action="confirm-delete" data-vehicle-card-id="${card.id}">Borrar</button>
                    </span>
                </div>
            `;
        }
        return `
            <div class="custom-manager-row ${archived ? 'archived' : ''}" data-vehicle-card-id="${card.id}">
                <span class="custom-manager-row-name">
                    <i class="ph ${safeIcon}"></i>
                    <span><strong>${safeName}</strong><small>${safeType}</small></span>
                </span>
                <span class="custom-manager-row-actions">
                    ${archived ? `
                        <button type="button" data-vehicle-manager-action="restore" data-vehicle-card-id="${card.id}" aria-label="Restaurar ${safeName}" data-tooltip="Restaurar tarjeta"><i class="ph ph-arrow-counter-clockwise"></i></button>
                    ` : `
                        <button type="button" data-vehicle-manager-action="edit" data-vehicle-card-id="${card.id}" aria-label="Editar ${safeName}" data-tooltip="Editar tarjeta"><i class="ph ph-pencil-simple"></i></button>
                        <button type="button" data-vehicle-manager-action="archive" data-vehicle-card-id="${card.id}" aria-label="Archivar ${safeName}" data-tooltip="Archivar tarjeta"><i class="ph ph-archive"></i></button>
                    `}
                    <button type="button" class="danger" data-vehicle-manager-action="request-delete" data-vehicle-card-id="${card.id}" aria-label="Borrar definitivamente ${safeName}" data-tooltip="Borrar definitivamente"><i class="ph ph-trash"></i></button>
                </span>
            </div>
        `;
    }

    handleManagerClick(event) {
        const button = event.target.closest('[data-vehicle-manager-action]');
        if (!button) return false;
        const action = button.dataset.vehicleManagerAction;
        const cardId = button.dataset.vehicleCardId;
        if (action === 'new') {
            this.openEditor(null, button);
        } else if (action === 'edit') {
            this.openEditor(cardId, button);
        } else if (action === 'archive') {
            this.archiveCard(cardId);
        } else if (action === 'restore') {
            this.restoreCard(cardId);
        } else if (action === 'request-delete') {
            this.pendingDeleteIds.add(cardId);
            this.app.customTrackers?.renderManager?.();
        } else if (action === 'cancel-delete') {
            this.pendingDeleteIds.delete(cardId);
            this.app.customTrackers?.renderManager?.();
        } else if (action === 'confirm-delete') {
            this.deleteCard(cardId);
        }
        return true;
    }

    archiveCard(cardId) {
        const card = this.getCard(cardId);
        if (!card || card.archived || card.deleted) return;
        this.catalog = updateVehicleCard(this.catalog, cardId, { archived: true });
        this.persist();
        this.app.showUndo?.(`${card.name} fue archivada.`, () => {
            this.catalog = updateVehicleCard(this.catalog, cardId, { archived: false });
            this.persist();
        });
    }

    restoreCard(cardId) {
        const card = this.getCard(cardId);
        if (!card || card.deleted) return;
        this.catalog = updateVehicleCard(this.catalog, cardId, { archived: false });
        this.persist({ message: `${card.name} volvió a estar activa.` });
    }

    deleteCard(cardId) {
        const card = this.getCard(cardId);
        if (!card) return;
        this.removeCardAlertConfig(card);
        if (card.source?.kind === 'maintenance') {
            this.vehicle.maintenanceLog = this.vehicle.maintenanceLog
                .filter(entry => entry.type !== card.source.key);
            this.vehicle.saveMaintenanceLog();
        } else if (card.source?.kind === 'tracker') {
            this.vehicle.trackerData[card.source.key] = '';
        }
        this.catalog.cards = this.catalog.cards.filter(item => item.id !== cardId);
        delete this.catalog.records[cardId];
        this.pendingDeleteIds.delete(cardId);
        this.persist({ message: `${card.name} y su historial fueron eliminados.` });
    }

    ensureEditorDialog() {
        document.getElementById('vehicle-card-dialog')?.remove();
        const dialog = document.createElement('div');
        dialog.id = 'vehicle-card-dialog';
        dialog.className = 'custom-tracker-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'vehicle-card-dialog-title');
        dialog.innerHTML = `
            <div class="custom-tracker-dialog-card">
                <div class="custom-tracker-dialog-header">
                    <div>
                        <span class="custom-trackers-eyebrow">Vehículo</span>
                        <h2 id="vehicle-card-dialog-title">Nueva tarjeta</h2>
                        <p>Creá mantenimientos, controles o vencimientos sin tocar código.</p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-vehicle-editor-action="close" aria-label="Cerrar editor"><i class="ph ph-x"></i></button>
                </div>
                <form id="vehicle-card-form">
                    <div class="custom-tracker-form-grid">
                        <div class="input-group custom-form-wide">
                            <label for="vehicle-card-name">Nombre</label>
                            <input id="vehicle-card-name" class="text-input" maxlength="80" required>
                        </div>
                        <div class="input-group">
                            <label for="vehicle-card-type">Tipo</label>
                            <select id="vehicle-card-type" class="time-input">
                                ${Object.entries(VEHICLE_CARD_TYPES).map(([key, meta]) => `<option value="${key}">${escapeHtml(meta.label)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="vehicle-card-section">Ubicación</label>
                            <select id="vehicle-card-section" class="time-input">
                                ${Object.entries(VEHICLE_CARD_SECTIONS).map(([key, meta]) => `<option value="${key}">${escapeHtml(meta.label)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="vehicle-card-action-label">Acción principal</label>
                            <input id="vehicle-card-action-label" class="text-input" maxlength="80">
                        </div>
                        <div class="input-group">
                            <label for="vehicle-card-icon">Ícono</label>
                            <select id="vehicle-card-icon" class="time-input">
                                ${Object.entries(VEHICLE_CARD_ICONS).map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group" data-vehicle-field="interval-km">
                            <label for="vehicle-card-interval-km">Repetir cada</label>
                            <div class="custom-number-with-unit"><input id="vehicle-card-interval-km" type="number" class="number-input" min="1"><span>km</span></div>
                        </div>
                        <div class="input-group" data-vehicle-field="warning-km">
                            <label for="vehicle-card-warning-km">Avisar cuando falten</label>
                            <div class="custom-number-with-unit"><input id="vehicle-card-warning-km" type="number" class="number-input" min="1"><span>km</span></div>
                        </div>
                        <div class="input-group" data-vehicle-field="interval-days">
                            <label for="vehicle-card-interval-days">Repetir cada</label>
                            <div class="custom-number-with-unit"><input id="vehicle-card-interval-days" type="number" class="number-input" min="1" max="3650"><span>días</span></div>
                        </div>
                        <div class="input-group" data-vehicle-field="warning-days">
                            <label for="vehicle-card-warning-days">Avisar con anticipación</label>
                            <div class="custom-number-with-unit"><input id="vehicle-card-warning-days" type="number" class="number-input" min="1" max="3650"><span>días</span></div>
                        </div>
                    </div>
                    <div class="custom-tracker-alert-block">
                        <label class="custom-tracker-alert-toggle">
                            <input id="vehicle-card-alert-enabled" type="checkbox">
                            <span class="custom-alert-icon"><i class="ph ph-bell-ringing"></i></span>
                            <span class="custom-alert-copy"><strong>Notificación push</strong><small>Avisar cuando la tarjeta requiera atención.</small></span>
                            <span class="custom-alert-switch" aria-hidden="true"><span></span></span>
                        </label>
                        <div class="input-group custom-tracker-alert-time-wrap">
                            <label for="vehicle-card-alert-time">Hora</label>
                            <input id="vehicle-card-alert-time" type="time" class="time-input" value="23:00">
                        </div>
                    </div>
                    <p id="vehicle-card-form-error" class="custom-tracker-form-error hidden" role="alert"></p>
                    <div class="custom-tracker-dialog-actions">
                        <button type="button" class="btn btn-secondary" data-vehicle-editor-action="close">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="ph ph-floppy-disk"></i> Guardar tarjeta</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(dialog);
        this.editorDialog = dialog;
        this.editorForm = dialog.querySelector('#vehicle-card-form');
        dialog.addEventListener('click', event => {
            if (event.target === dialog || event.target.closest('[data-vehicle-editor-action="close"]')) {
                this.closeEditor();
            }
        });
        dialog.querySelector('#vehicle-card-type')?.addEventListener('change', () => {
            this.updateEditorFields();
        });
        this.editorForm?.addEventListener('submit', event => {
            event.preventDefault();
            this.saveEditor();
        });
    }

    openEditor(cardId = null, trigger = null) {
        const card = cardId ? this.getCard(cardId) : null;
        const alertConfig = this.getCardAlertConfig(card);
        this.editingId = card?.id || null;
        this.lastDialogTrigger = trigger || document.activeElement;
        this.editorDialog.querySelector('#vehicle-card-dialog-title').textContent = card
            ? `Editar ${card.name}`
            : 'Nueva tarjeta de vehículo';
        this.editorDialog.querySelector('#vehicle-card-name').value = card?.name || '';
        this.editorDialog.querySelector('#vehicle-card-type').value = card?.type || 'maintenance';
        this.editorDialog.querySelector('#vehicle-card-section').value = card?.section || 'maintenance';
        this.editorDialog.querySelector('#vehicle-card-action-label').value = card?.actionLabel || VEHICLE_CARD_TYPES.maintenance.defaultAction;
        this.editorDialog.querySelector('#vehicle-card-icon').value = card?.icon || VEHICLE_CARD_TYPES.maintenance.defaultIcon;
        this.editorDialog.querySelector('#vehicle-card-interval-km').value = card?.intervalKm || '';
        this.editorDialog.querySelector('#vehicle-card-warning-km').value = card?.warningKm || '';
        this.editorDialog.querySelector('#vehicle-card-interval-days').value = card?.intervalDays || '';
        this.editorDialog.querySelector('#vehicle-card-warning-days').value = card?.warningDays || '';
        this.editorDialog.querySelector('#vehicle-card-alert-enabled').checked = alertConfig?.enabled !== false;
        this.editorDialog.querySelector('#vehicle-card-alert-time').value = alertConfig?.time || card?.alert?.time || '23:00';
        const hasHistory = card ? this.getRecords(card.id).length > 0 : false;
        this.editorDialog.querySelector('#vehicle-card-type').disabled = hasHistory;
        this.editorDialog.querySelector('#vehicle-card-form-error').classList.add('hidden');
        this.updateEditorFields();
        this.editorDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => this.editorDialog.querySelector('#vehicle-card-name')?.focus());
    }

    closeEditor() {
        if (this.editorDialog?.classList.contains('hidden')) return;
        this.editorDialog.classList.add('hidden');
        document.body.classList.remove('modal-open');
        this.editingId = null;
        const trigger = this.lastDialogTrigger;
        this.lastDialogTrigger = null;
        requestAnimationFrame(() => trigger?.isConnected && trigger.focus?.());
    }

    updateEditorFields() {
        const type = this.editorDialog.querySelector('#vehicle-card-type').value;
        const section = this.editorDialog.querySelector('#vehicle-card-section');
        if (type !== 'document') {
            section.value = 'maintenance';
            section.disabled = true;
        } else {
            section.disabled = false;
        }
        this.editorDialog.querySelector('[data-vehicle-field="interval-km"]').classList.toggle('hidden', type !== 'maintenance');
        this.editorDialog.querySelector('[data-vehicle-field="warning-km"]').classList.toggle('hidden', type !== 'maintenance');
        this.editorDialog.querySelector('[data-vehicle-field="interval-days"]').classList.toggle('hidden', type === 'document');
        this.editorDialog.querySelector('[data-vehicle-field="warning-days"]').classList.toggle('hidden', false);
    }

    saveEditor() {
        const error = this.editorDialog.querySelector('#vehicle-card-form-error');
        try {
            const wasEditing = Boolean(this.editingId);
            const type = this.editorDialog.querySelector('#vehicle-card-type').value;
            const section = type === 'document'
                ? this.editorDialog.querySelector('#vehicle-card-section').value
                : 'maintenance';
            const input = {
                name: this.editorDialog.querySelector('#vehicle-card-name').value,
                type,
                section,
                actionLabel: this.editorDialog.querySelector('#vehicle-card-action-label').value,
                icon: this.editorDialog.querySelector('#vehicle-card-icon').value,
                intervalKm: type === 'maintenance'
                    ? parseOptionalInteger(this.editorDialog.querySelector('#vehicle-card-interval-km').value)
                    : null,
                warningKm: type === 'maintenance'
                    ? parseOptionalInteger(this.editorDialog.querySelector('#vehicle-card-warning-km').value)
                    : null,
                intervalDays: type === 'document'
                    ? null
                    : parseOptionalInteger(this.editorDialog.querySelector('#vehicle-card-interval-days').value),
                warningDays: parseOptionalInteger(this.editorDialog.querySelector('#vehicle-card-warning-days').value),
                alert: {
                    enabled: this.editorDialog.querySelector('#vehicle-card-alert-enabled').checked,
                    time: this.editorDialog.querySelector('#vehicle-card-alert-time').value || '23:00'
                }
            };
            if (this.editingId) {
                this.catalog = updateVehicleCard(this.catalog, this.editingId, input);
            } else {
                const order = this.getCards().filter(card => card.section === section).length;
                const card = createVehicleCard(input, { order });
                this.catalog.cards.push(card);
                this.catalog.records[card.id] = [];
            }
            const savedCard = this.editingId
                ? this.getCard(this.editingId)
                : this.catalog.cards[this.catalog.cards.length - 1];
            this.syncCardAlertConfig(savedCard);
            this.closeEditor();
            this.persist({ message: wasEditing ? 'Tarjeta actualizada.' : 'Tarjeta creada.' });
        } catch (caught) {
            error.textContent = caught?.message || 'No se pudo guardar la tarjeta.';
            error.classList.remove('hidden');
        }
    }

    ensureRecordDialog() {
        document.getElementById('vehicle-record-dialog')?.remove();
        const dialog = document.createElement('div');
        dialog.id = 'vehicle-record-dialog';
        dialog.className = 'custom-tracker-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'vehicle-record-dialog-title');
        dialog.innerHTML = `
            <div class="custom-tracker-dialog-card vehicle-record-dialog-card">
                <div class="custom-tracker-dialog-header">
                    <div><span class="custom-trackers-eyebrow">Vehículo</span><h2 id="vehicle-record-dialog-title">Registrar mantenimiento</h2><p>Guardá la fecha y el kilometraje reales del servicio.</p></div>
                    <button type="button" class="custom-dialog-close" data-vehicle-record-action="close" aria-label="Cerrar registro"><i class="ph ph-x"></i></button>
                </div>
                <form id="vehicle-record-form">
                    <div class="custom-tracker-form-grid">
                        <div class="input-group"><label for="vehicle-record-date">Fecha</label><input id="vehicle-record-date" type="date" class="date-input" required></div>
                        <div class="input-group"><label for="vehicle-record-km">Kilometraje</label><input id="vehicle-record-km" type="number" class="number-input" min="0" required></div>
                    </div>
                    <p id="vehicle-record-error" class="custom-tracker-form-error hidden" role="alert"></p>
                    <div class="custom-tracker-dialog-actions">
                        <button type="button" class="btn btn-secondary" data-vehicle-record-action="close">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="ph ph-check"></i> Registrar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(dialog);
        this.recordDialog = dialog;
        dialog.addEventListener('click', event => {
            if (event.target === dialog || event.target.closest('[data-vehicle-record-action="close"]')) {
                this.closeRecordDialog();
            }
        });
        dialog.querySelector('#vehicle-record-form')?.addEventListener('submit', event => {
            event.preventDefault();
            const date = dialog.querySelector('#vehicle-record-date').value;
            const km = parseOptionalInteger(dialog.querySelector('#vehicle-record-km').value);
            const error = dialog.querySelector('#vehicle-record-error');
            if (!date || km === null) {
                error.textContent = 'Ingresá una fecha y un kilometraje válidos.';
                error.classList.remove('hidden');
                return;
            }
            const cardId = this.recordingId;
            this.closeRecordDialog();
            this.recordCard(cardId, { date, km });
        });
    }

    openRecordDialog(cardId, trigger = null) {
        const card = this.getCard(cardId);
        if (!card) return;
        this.recordingId = cardId;
        this.lastDialogTrigger = trigger || document.activeElement;
        this.recordDialog.querySelector('#vehicle-record-dialog-title').textContent = card.name;
        this.recordDialog.querySelector('#vehicle-record-date').value = getLocalISODate();
        this.recordDialog.querySelector('#vehicle-record-km').value = String(this.vehicle.odometer || 0);
        this.recordDialog.querySelector('#vehicle-record-error').classList.add('hidden');
        this.recordDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => this.recordDialog.querySelector('#vehicle-record-date')?.focus());
    }

    closeRecordDialog() {
        if (this.recordDialog?.classList.contains('hidden')) return;
        this.recordDialog.classList.add('hidden');
        document.body.classList.remove('modal-open');
        this.recordingId = null;
        const trigger = this.lastDialogTrigger;
        this.lastDialogTrigger = null;
        requestAnimationFrame(() => trigger?.isConnected && trigger.focus?.());
    }

    getOverdueItems(now = new Date()) {
        return this.getCards({ includeArchived: false }).flatMap(card => {
            const state = this.getState(card, now);
            if (!state?.shouldNotify) return [];
            return [{
                module: 'vehicle',
                id: card.id,
                name: card.name,
                icon: card.icon,
                desc: state.label,
                completable: card.type !== 'document',
                vehicleTab: card.section === 'documents' ? 'docs' : 'maint'
            }];
        });
    }

    completeCard(cardId) {
        const card = this.getCard(cardId);
        if (!card || card.type === 'document') return false;
        return this.recordCard(cardId, {
            date: getLocalISODate(),
            ...(card.type === 'maintenance' ? { km: this.vehicle.odometer } : {})
        });
    }
}
