import {
    APP_MODULES,
    appendCustomTrackerRecords,
    buildCustomAlertDefinitions,
    createCustomTracker,
    CUSTOM_MODULE_COLORS,
    CUSTOM_MODULE_CARD_RESOLUTIONS,
    CUSTOM_MODULE_ICONS,
    CUSTOM_TRACKER_FIELD,
    CUSTOM_TRACKER_ICONS,
    CUSTOM_TRACKER_TEMPLATES,
    DEFAULT_BLOOD_STUDY_TRACKER_ID,
    DEFAULT_ROBOT_TRACKER_ID,
    deleteCustomModulePermanently,
    deleteCustomTrackerPermanently,
    getAppModules,
    getCustomAlertKey,
    getCustomModuleDeletionPlan,
    getCustomModuleHostId,
    getCustomModuleSectionId,
    getCustomTrackerSections,
    getCustomTrackerState,
    isMedicalStudyTracker,
    isStateReminderTracker,
    normalizeCustomTrackerDayThresholds,
    normalizeCustomTrackerRegistry,
    normalizeNavigationPreferences
} from '../custom-tracker-utils.mjs?v=20260829-module-delete';
import {
    RESOURCE_KEYS,
    createFallbackResourcePolicy,
    evaluateResourceCapacity,
    getTrackerRegistryResourceUsage
} from '../resource-policy.mjs?v=20260829-feature-limits';
import {
    migrateLegacyTrackerRegistry,
    readLegacyTrackerSnapshot
} from '../tracker-migration.mjs?v=20260828-permanent-delete';
import {
    combineLocalDateWithTime,
    DateUtils,
    getLocalISODate
} from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import { createIconPicker } from '../icon-picker-utils.mjs?v=20260818-icon-preview';
import {
    normalizeTodayPreferences,
    TODAY_QUICK_ACTIONS
} from '../product-preferences.mjs?v=20260729-product-preferences';
import Sortable from '../vendor/sortable.complete.esm.js?v=1.15.7';

const STATUS_META = Object.freeze({
    new: { label: 'Sin registros', color: 'var(--text-secondary)' },
    green: { label: 'Al día', color: 'var(--status-green)' },
    yellow: { label: 'Próximo', color: 'var(--status-yellow)' },
    orange: { label: 'Atención', color: 'var(--status-orange)' },
    red: { label: 'Vencido', color: 'var(--status-red)' }
});

const ACTION_PRESETS = Object.freeze([
    'Registrar limpieza',
    'Registrar lavado',
    'Registrar cambio',
    'Registrar cuidado',
    'Registrar control',
    'Registrar visita',
    'Registrar corte',
    'Registrar afeitado',
    'Registrar depilación',
    'Renovar',
    'Abrir',
    'Reemplazar',
    'Registrar'
]);

const ICON_LABELS = Object.freeze({
    'ph-sparkle': 'Limpieza',
    'ph-check-circle': 'Control',
    'ph-drop': 'Agua',
    'ph-scissors': 'Cuidado',
    'ph-eye': 'Lentes',
    'ph-heartbeat': 'Salud',
    'ph-tooth': 'Dental',
    'ph-first-aid': 'Médico',
    'ph-first-aid-kit': 'Estudio médico',
    'ph-calendar-check': 'Calendario',
    'ph-package': 'Insumo',
    'ph-phone': 'Celular',
    'ph-mouse': 'Mouse',
    'ph-headphones': 'Auriculares',
    'ph-paint-brush': 'Lavado',
    'ph-hand-palm': 'Toalla o manos',
    'ph-bed': 'Dormitorio',
    'ph-moon': 'Descanso',
    'ph-laptop': 'Computadora',
    'ph-wrench': 'Mantenimiento',
    'ph-archive': 'Estuche',
    'ph-eyedropper': 'Gotas',
    'ph-spray': 'Lavado',
    'ph-spray-bottle': 'Spray',
    'ph-drop-half': 'Líquido',
    'ph-user': 'Persona',
    'ph-user-focus': 'Cuidado personal',
    'ph-arrows-clockwise': 'Reemplazo'
});

export class CustomTrackersModule {
    constructor(appController) {
        this.app = appController;
        this.app.customTrackers = this;
        this.registry = this.loadRegistry();
        this.pendingDeleteIds = new Set();
        this.pendingHistoryDeleteKeys = new Set();
        this.historyDialogTrackerId = null;
        this.historyDialogTrigger = null;
        this.historyEditMode = false;
        this.instructionsDialogTrackerId = null;
        this.instructionsDialogTrigger = null;
        this.editingModuleId = null;
        this.lastModuleDialogTrigger = null;
        this.deletingModuleId = null;
        this.lastModuleDeleteTrigger = null;
        this.moduleDeletionBusy = false;
        this.editingId = null;
        this.lastDialogTrigger = null;
        this.toastTimer = null;
        this.reorderContext = null;
        this.bulkContext = null;
        this.sortableInstances = [];
        this.activeCategoryFilter = this.app.uiState?.trackerManagerFilter || 'all';
        this.managerSearchQuery = '';

        this.managerRoot = document.getElementById('tab-seguimientos');
        this.managerSummary = document.getElementById('custom-trackers-manager-summary');
        this.managerFeedback = document.getElementById('custom-trackers-manager-feedback');
        this.newTrackerButton = document.getElementById('btn-new-custom-tracker');
        this.orderTrackersButton = document.getElementById('btn-order-custom-trackers');
        this.managerOrderActions = document.getElementById('custom-trackers-order-actions');
        this.modulesRoot = document.getElementById('tab-modulos');
        this.modulesSummary = document.getElementById('module-visibility-summary');
        this.modulesFeedback = document.getElementById('module-visibility-feedback');
        this.customModulesSummary = document.getElementById('custom-modules-summary');
        this.customModulesFeedback = document.getElementById('custom-modules-feedback');
        this.newModuleButton = document.getElementById('btn-new-custom-module');
        this.todayActionsSummary = document.getElementById('today-actions-summary');
        this.todayActionsCount = document.getElementById('today-actions-count');
        this.todayActionsFeedback = document.getElementById('today-actions-feedback');

        this.ensureCustomModuleRuntime();
        this.ensureRuntimeOrderControls();
        this.ensureHistoryDialog();
        this.ensureInstructionsDialog();
        this.ensureEditorDialog();
        this.ensureModuleEditorDialog();
        this.ensureModuleDeletionDialog();
        this.setupManagerListeners();
        this.setupModuleListeners();
        this.setupRuntimeListeners();
        this.renderAll();
        this.applyModuleVisibility();
        this.app.health?.bindLegacyStudiesToTracker?.(DEFAULT_BLOOD_STUDY_TRACKER_ID);
    }

    loadRegistry() {
        const snapshot = readLegacyTrackerSnapshot(localStorage);
        const result = migrateLegacyTrackerRegistry(snapshot);
        const registry = normalizeCustomTrackerRegistry(result.registry);
        this.lastMigration = result;
        if (this.app.hygiene?.data) {
            this.app.hygiene.data[CUSTOM_TRACKER_FIELD] = registry;
            if (result.migrated) {
                this.app.hygiene.saveData();
            }
        }
        return registry;
    }

    reload() {
        this.registry = this.loadRegistry();
        this.ensureCustomModuleRuntime();
        this.ensureRuntimeOrderControls();
        this.renderAll();
        this.applyModuleVisibility();
        return this.lastMigration?.migrated === true;
    }

    getAlertDefinitions() {
        return buildCustomAlertDefinitions(this.registry);
    }

    getManagedAlertKeys() {
        return new Set(
            this.registry.trackers
                .map(tracker => getCustomAlertKey(tracker))
                .filter(Boolean)
        );
    }

    getTracker(trackerId) {
        return this.registry.trackers.find(tracker => tracker.id === trackerId) || null;
    }

    getHistory(trackerId) {
        return this.registry.histories[trackerId] || [];
    }

    isTrackerTemplateLocked(tracker) {
        if (!tracker) return false;
        if (this.getHistory(tracker.id).length > 0) return true;
        if (isStateReminderTracker(tracker) && tracker.state?.active === true) return true;
        return isMedicalStudyTracker(tracker)
            && (this.app.health?.getStudyEntries?.(tracker.id)?.length || 0) > 0;
    }

    getEffectiveAlertConfig(tracker) {
        if (!tracker) {
            return { enabled: false, time: '23:00' };
        }

        const stored = this.app.alerts?.configs?.[getCustomAlertKey(tracker)];
        return {
            enabled: stored
                ? stored.enabled === true
                : tracker.alert?.enabled === true,
            time: stored?.time || tracker.alert?.time || '23:00',
            intervalHours: Math.min(
                48,
                Math.max(
                    1,
                    Number(stored?.interval_hours)
                    || Number(tracker.behavior?.intervalHours)
                    || 6
                )
            )
        };
    }

    persistRegistry() {
        this.registry = normalizeCustomTrackerRegistry(this.registry);
        this.app.hygiene.data[CUSTOM_TRACKER_FIELD] = this.registry;
        this.app.hygiene.saveData();
        this.ensureCustomModuleRuntime();
        this.ensureRuntimeOrderControls();
        this.renderAll();
        this.applyModuleVisibility();
        this.app.notificationsCenter?.updateBadge();
    }

    getCreationCapacity(resourceKey, requestedCount = 1) {
        const usage = getTrackerRegistryResourceUsage(this.registry);
        const currentCount = usage[resourceKey] || 0;
        if (typeof this.app.auth?.canCreateResource === 'function') {
            return this.app.auth.canCreateResource(
                resourceKey,
                currentCount,
                requestedCount
            );
        }
        return evaluateResourceCapacity(
            createFallbackResourcePolicy(),
            resourceKey,
            currentCount,
            requestedCount
        );
    }

    getCreationLimitMessage(resourceKey, capacity) {
        const limit = capacity?.limit;
        if (!Number.isSafeInteger(limit)) {
            return 'No se pudo validar la capacidad disponible de esta cuenta.';
        }
        if (resourceKey === RESOURCE_KEYS.CUSTOM_MODULES) {
            return `Esta cuenta puede tener hasta ${limit} módulos personalizados. Para crear otro, eliminá definitivamente un módulo archivado.`;
        }
        return `Esta cuenta puede tener hasta ${limit} tarjetas configurables. Para crear otra, eliminá definitivamente una tarjeta archivada.`;
    }

    ensureCreationCapacity(resourceKey, { errorElement = null } = {}) {
        const capacity = this.getCreationCapacity(resourceKey);
        if (capacity.allowed) return true;

        const message = this.getCreationLimitMessage(resourceKey, capacity);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        } else {
            void this.app.showMessage({
                title: 'Límite alcanzado',
                message,
                tone: 'warning'
            });
        }
        return false;
    }

    generateTrackerId() {
        let randomPart = '';
        if (globalThis.crypto?.getRandomValues) {
            const randomValues = new Uint32Array(2);
            globalThis.crypto.getRandomValues(randomValues);
            randomPart = Array.from(randomValues, value => value.toString(36)).join('');
        } else {
            randomPart = Math.random().toString(36).slice(2, 14);
        }
        return `ct_${Date.now().toString(36)}_${randomPart}`.slice(0, 67);
    }

    generateModuleId() {
        let randomPart = '';
        if (globalThis.crypto?.getRandomValues) {
            const values = new Uint32Array(2);
            globalThis.crypto.getRandomValues(values);
            randomPart = Array.from(values, value => value.toString(36)).join('');
        } else {
            randomPart = Math.random().toString(36).slice(2, 14);
        }
        return `cm_${Date.now().toString(36)}_${randomPart}`.slice(0, 66);
    }

    getSections() {
        return getCustomTrackerSections(this.registry.customModules);
    }

    getAppModules({ includeArchived = false } = {}) {
        return getAppModules(this.registry.customModules, { includeArchived });
    }

    getCustomModule(moduleId) {
        return this.registry.customModules.find(module => module.id === moduleId) || null;
    }

    getCustomModuleBySectionId(sectionId) {
        return this.registry.customModules.find(module => (
            getCustomModuleSectionId(module.id) === sectionId
        )) || null;
    }

    ensureCustomModuleRuntime() {
        const mainNav = document.getElementById('main-nav');
        const container = document.querySelector('main.container');
        const activeModules = this.registry.customModules.filter(module => !module.archived);
        const activeIds = new Set(activeModules.map(module => module.id));

        document.querySelectorAll('[data-custom-module-nav]').forEach(button => {
            if (!activeIds.has(button.dataset.customModuleNav)) button.remove();
        });
        document.querySelectorAll('[data-custom-module-runtime]').forEach(section => {
            if (!activeIds.has(section.dataset.customModuleRuntime)) section.remove();
        });

        activeModules.forEach(module => {
            const sectionId = getCustomModuleSectionId(module.id);
            const hostId = getCustomModuleHostId(module.id);
            const color = CUSTOM_MODULE_COLORS[module.color] || CUSTOM_MODULE_COLORS.blue;
            let navButton = mainNav?.querySelector(`.nav-btn[data-section="${sectionId}"]`);
            if (!navButton && mainNav) {
                navButton = document.createElement('button');
                navButton.type = 'button';
                navButton.className = 'nav-btn';
                navButton.dataset.section = sectionId;
                navButton.dataset.customModuleNav = module.id;
                const moreButton = mainNav.querySelector('.adaptive-nav-more');
                mainNav.insertBefore(navButton, moreButton || null);
            }
            if (navButton) {
                navButton.style.setProperty('--custom-module-color', color);
                navButton.innerHTML = `
                    <i class="ph ${module.icon}" aria-hidden="true"></i>
                    <span class="nav-label">${escapeHtml(module.name)}</span>
                `;
                navButton.setAttribute('data-tooltip', module.name);
            }

            let section = document.getElementById(sectionId);
            if (!section && container) {
                section = document.createElement('section');
                section.id = sectionId;
                section.className = 'main-section hidden custom-module-runtime-section';
                section.dataset.customModuleRuntime = module.id;
                const profileSection = document.getElementById('perfil-section');
                container.insertBefore(section, profileSection || null);
            }
            if (section) {
                section.style.setProperty('--custom-module-color', color);
                let heading = section.querySelector('.custom-module-runtime-heading');
                if (!heading) {
                    section.insertAdjacentHTML('beforeend', `
                        <header class="custom-module-runtime-heading">
                            <span class="custom-module-runtime-icon" aria-hidden="true">
                                <i class="ph ${module.icon}"></i>
                            </span>
                            <span>
                                <span class="custom-trackers-eyebrow">MÓDULO PERSONALIZADO</span>
                                <h2>${escapeHtml(module.name)}</h2>
                                <p>${escapeHtml(module.description || 'Tus tarjetas y seguimientos, reunidos en un solo lugar.')}</p>
                            </span>
                            <button type="button" class="btn btn-primary custom-module-runtime-new" data-custom-module-runtime-action="new-card" data-module-id="${module.id}">
                                <i class="ph ph-plus"></i> Nueva tarjeta
                            </button>
                        </header>
                        <div id="${hostId}" class="cards-grid custom-module-runtime-grid"></div>
                    `);
                    heading = section.querySelector('.custom-module-runtime-heading');
                }
                const headingIcon = heading?.querySelector('.custom-module-runtime-icon i');
                const headingTitle = heading?.querySelector('h2');
                const headingDescription = heading?.querySelector('p');
                const newCardButton = heading?.querySelector('[data-custom-module-runtime-action="new-card"]');
                if (headingIcon) headingIcon.className = `ph ${module.icon}`;
                if (headingTitle) headingTitle.textContent = module.name;
                if (headingDescription) {
                    headingDescription.textContent = module.description
                        || 'Tus tarjetas y seguimientos, reunidos en un solo lugar.';
                }
                if (newCardButton) newCardButton.dataset.moduleId = module.id;
            }
        });

        if (mainNav) {
            const moreButton = mainNav.querySelector('.adaptive-nav-more');
            activeModules.forEach(module => {
                const button = mainNav.querySelector(
                    `[data-custom-module-nav="${module.id}"]`
                );
                if (button) mainNav.insertBefore(button, moreButton || null);
            });
        }
    }

    ensureRuntimeOrderControls() {
        Object.entries(this.getSections()).forEach(([sectionKey, section]) => {
            if (section.archived) return;
            const root = document.getElementById(section.mainSectionId);
            if (!root || root.querySelector(`[data-runtime-order-section="${sectionKey}"]`)) {
                return;
            }

            const toolbar = document.createElement('div');
            toolbar.className = 'custom-runtime-order-toolbar';
            toolbar.dataset.runtimeOrderSection = sectionKey;
            toolbar.innerHTML = `
                <div class="custom-runtime-overview" data-runtime-overview="${sectionKey}">
                    <span class="custom-runtime-overview-icon" aria-hidden="true">
                        <i class="ph ph-calendar-check"></i>
                    </span>
                    <span class="custom-runtime-overview-copy">
                        <strong>Calculando estado…</strong>
                        <small>Revisando las tarjetas visibles.</small>
                    </span>
                </div>
                <div class="custom-runtime-order-default">
                    <button
                        type="button"
                        class="btn btn-secondary custom-runtime-bulk-enter"
                        data-custom-bulk-action="enter"
                        data-section="${sectionKey}"
                    >
                        <i class="ph ph-checks"></i>
                        Registrar varias
                    </button>
                    <button
                        type="button"
                        class="btn btn-secondary custom-runtime-order-enter"
                        data-custom-order-action="enter-runtime"
                        data-section="${sectionKey}"
                    >
                        <i class="ph ph-arrows-down-up"></i>
                        Ordenar tarjetas
                    </button>
                </div>
                <div class="custom-runtime-bulk-active hidden" role="status" aria-live="polite">
                    <span>
                        <i class="ph ph-checks"></i>
                        <span>
                            <strong>Registro múltiple</strong>
                            <small data-custom-bulk-status>Seleccioná las tarjetas que acabás de completar.</small>
                        </span>
                    </span>
                    <div class="custom-order-actions">
                        <button type="button" class="btn btn-secondary" data-custom-bulk-action="cancel">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-primary" data-custom-bulk-action="record" disabled>
                            <i class="ph ph-check-circle"></i>
                            <span data-custom-bulk-record-label>Registrar seleccionadas</span>
                        </button>
                    </div>
                </div>
                <div class="custom-runtime-order-active hidden" role="status" aria-live="polite">
                    <span>
                        <i class="ph ph-hand-grabbing"></i>
                        <span>
                            <strong>Orden y tarjeta destacada</strong>
                            <small>Arrastrá para ordenar. La estrella deja una sola tarjeta destacada; también podés no elegir ninguna.</small>
                        </span>
                    </span>
                    <div class="custom-order-actions">
                        <button type="button" class="btn btn-secondary" data-custom-order-action="cancel">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-primary" data-custom-order-action="save">
                            <i class="ph ph-floppy-disk"></i>
                            Guardar cambios
                        </button>
                    </div>
                </div>
            `;
            const customHeading = section.customModule
                ? root.querySelector('.custom-module-runtime-heading')
                : null;
            if (customHeading) customHeading.insertAdjacentElement('afterend', toolbar);
            else root.insertBefore(toolbar, root.firstChild);
        });
    }

    updateRuntimeOrderControls(sectionKey = null) {
        Object.entries(this.getSections()).forEach(([key, section]) => {
            if (section.archived) return;
            if (sectionKey && key !== sectionKey) return;
            const toolbar = document.querySelector(
                `[data-runtime-order-section="${key}"]`
            );
            if (!toolbar) return;

            const isActive = (
                this.reorderContext?.scope === 'runtime'
                && this.reorderContext.sectionKey === key
            );
            const isBulkActive = this.bulkContext?.sectionKey === key;
            const enterWrap = toolbar.querySelector('.custom-runtime-order-default');
            const activeWrap = toolbar.querySelector('.custom-runtime-order-active');
            const bulkWrap = toolbar.querySelector('.custom-runtime-bulk-active');
            const overview = toolbar.querySelector('.custom-runtime-overview');
            const enterButton = toolbar.querySelector('[data-custom-order-action="enter-runtime"]');
            const bulkEnterButton = toolbar.querySelector('[data-custom-bulk-action="enter"]');
            const bulkRecordButton = toolbar.querySelector('[data-custom-bulk-action="record"]');
            const bulkRecordLabel = toolbar.querySelector('[data-custom-bulk-record-label]');
            const bulkStatus = toolbar.querySelector('[data-custom-bulk-status]');
            const selectedCount = isBulkActive
                ? this.bulkContext.selectedIds.size
                : 0;
            enterWrap?.classList.toggle('hidden', isActive || isBulkActive);
            activeWrap?.classList.toggle('hidden', !isActive);
            bulkWrap?.classList.toggle('hidden', !isBulkActive);
            overview?.classList.toggle('hidden', isActive || isBulkActive);
            toolbar.classList.toggle('is-active', isActive);
            toolbar.classList.toggle('is-bulk-active', isBulkActive);
            if (enterButton) {
                enterButton.disabled = this.getRuntimeTrackers(key).length === 0;
            }
            if (bulkEnterButton) {
                bulkEnterButton.disabled = this.getRuntimeTrackers(key)
                    .filter(tracker => (
                        !isMedicalStudyTracker(tracker)
                        && !isStateReminderTracker(tracker)
                    )).length < 2;
            }
            if (bulkRecordButton) {
                bulkRecordButton.disabled = selectedCount === 0;
            }
            if (bulkRecordLabel) {
                bulkRecordLabel.textContent = selectedCount > 0
                    ? `Registrar ${selectedCount}`
                    : 'Registrar seleccionadas';
            }
            if (bulkStatus) {
                bulkStatus.textContent = selectedCount > 0
                    ? `${selectedCount} ${selectedCount === 1 ? 'tarjeta seleccionada' : 'tarjetas seleccionadas'}.`
                    : 'Seleccioná las tarjetas que acabás de completar.';
            }
            document.getElementById(section.mainSectionId)
                ?.classList.toggle('is-custom-reordering', isActive);
            document.getElementById(section.mainSectionId)
                ?.classList.toggle('is-custom-bulk', isBulkActive);
            this.updateRuntimeOverview(key);
        });
    }

    updateRuntimeOverview(sectionKey) {
        const overview = document.querySelector(
            `[data-runtime-overview="${sectionKey}"]`
        );
        if (!overview) return;

        const trackers = this.getRuntimeTrackers(sectionKey);
        const states = trackers.map(tracker => ({
            tracker,
            state: getCustomTrackerState(tracker, this.getHistory(tracker.id))
        }));
        const overdue = states.filter(item => item.state.status === 'red');
        const upcoming = states.filter(item => (
            item.state.status === 'yellow'
            || item.state.status === 'orange'
        ));
        const notStarted = states.filter(item => item.state.status === 'new');
        const next = states
            .filter(item => item.state.nextDate)
            .sort((left, right) => (
                Date.parse(left.state.nextDate) - Date.parse(right.state.nextDate)
            ))[0] || null;
        const copy = overview.querySelector('.custom-runtime-overview-copy');
        const icon = overview.querySelector('.custom-runtime-overview-icon i');
        if (!copy || !icon) return;

        let title = 'Todo al día';
        let detail = next
            ? `Próxima: ${next.tracker.name} · ${DateUtils.formatFriendlyDate(next.state.nextDate)}`
            : `${trackers.length} ${trackers.length === 1 ? 'tarjeta activa' : 'tarjetas activas'}`;
        let tone = 'clear';

        if (trackers.length === 0) {
            title = 'Sin tarjetas visibles';
            detail = 'Podés crear una nueva desde Perfil → Tarjetas.';
            tone = 'empty';
        } else if (overdue.length > 0) {
            title = `${overdue.length} ${overdue.length === 1 ? 'vencida' : 'vencidas'}`;
            detail = upcoming.length > 0
                ? `${upcoming.length} próximas · Primero: ${overdue[0].tracker.name}`
                : `Primero: ${overdue[0].tracker.name}`;
            tone = 'overdue';
        } else if (upcoming.length > 0) {
            title = `${upcoming.length} ${upcoming.length === 1 ? 'próxima' : 'próximas'}`;
            detail = next
                ? `Primero: ${next.tracker.name} · ${DateUtils.formatFriendlyDate(next.state.nextDate)}`
                : 'Revisá las tarjetas destacadas.';
            tone = 'upcoming';
        } else if (notStarted.length > 0 && notStarted.length === trackers.length) {
            title = `${notStarted.length} sin iniciar`;
            detail = 'El primer registro activa sus fechas.';
            tone = 'empty';
        } else if (notStarted.length > 0) {
            detail = `${detail} · ${notStarted.length} sin iniciar`;
        }

        overview.dataset.tone = tone;
        icon.className = tone === 'overdue'
            ? 'ph ph-warning-circle'
            : (tone === 'upcoming'
                ? 'ph ph-clock-countdown'
                : (tone === 'empty' ? 'ph ph-circle-dashed' : 'ph ph-check-circle'));
        copy.innerHTML = `
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(detail)}</small>
        `;
    }

    setupManagerListeners() {
        this.newTrackerButton?.addEventListener('click', event => {
            this.openEditor('hygiene', null, event.currentTarget);
        });
        this.orderTrackersButton?.addEventListener('click', () => {
            this.activeCategoryFilter = 'all';
            this.managerSearchQuery = '';
            this.app.saveUiState?.({ trackerManagerFilter: 'all' });
            this.enterReorderMode('manager');
        });

        this.managerRoot?.addEventListener('click', async event => {
            const orderButton = event.target.closest('[data-custom-order-action]');
            if (orderButton) {
                if (orderButton.dataset.customOrderAction === 'save') {
                    this.saveReorderMode();
                } else if (orderButton.dataset.customOrderAction === 'cancel') {
                    this.cancelReorderMode();
                }
                return;
            }

            const filterButton = event.target.closest('[data-tracker-category-filter]');
            if (filterButton) {
                if (this.reorderContext?.scope === 'manager') return;
                this.activeCategoryFilter = filterButton.dataset.trackerCategoryFilter || 'all';
                this.app.saveUiState?.({
                    trackerManagerFilter: this.activeCategoryFilter
                });
                this.renderManager();
                return;
            }

            if (this.app.vehicle?.cards?.handleManagerClick?.(event)) {
                return;
            }

            const button = event.target.closest('[data-custom-manager-action]');
            if (!button) return;

            const action = button.dataset.customManagerAction;
            const trackerId = button.dataset.trackerId;

            if (action === 'new') {
                this.openEditor(button.dataset.section || 'hygiene', null, button);
            } else if (action === 'clear-search') {
                this.managerSearchQuery = '';
                this.renderManager();
                requestAnimationFrame(() => {
                    this.managerRoot?.querySelector('[data-custom-manager-search]')?.focus();
                });
            } else if (action === 'edit') {
                const tracker = this.getTracker(trackerId);
                if (tracker && !tracker.deleted) {
                    this.openEditor(tracker.section, trackerId, button);
                }
            } else if (action === 'archive') {
                this.archiveTracker(trackerId);
            } else if (action === 'restore' || action === 'undo-archive') {
                this.restoreTracker(trackerId);
            } else if (action === 'request-delete') {
                const tracker = this.getTracker(trackerId);
                if (!tracker?.archived) return;
                this.pendingDeleteIds.add(trackerId);
                this.renderManager();
            } else if (action === 'cancel-delete') {
                this.pendingDeleteIds.delete(trackerId);
                this.renderManager();
            } else if (action === 'confirm-delete') {
                button.disabled = true;
                await this.deleteTracker(trackerId);
            }
        });

        this.managerRoot?.addEventListener('input', event => {
            const searchInput = event.target.closest('[data-custom-manager-search]');
            if (!searchInput || this.reorderContext?.scope === 'manager') return;

            const cursorPosition = searchInput.selectionStart;
            this.managerSearchQuery = searchInput.value.slice(0, 80);
            this.renderManager();
            requestAnimationFrame(() => {
                const nextInput = this.managerRoot?.querySelector(
                    '[data-custom-manager-search]'
                );
                nextInput?.focus();
                if (Number.isInteger(cursorPosition)) {
                    nextInput?.setSelectionRange(cursorPosition, cursorPosition);
                }
            });
        });

        this.managerRoot?.addEventListener('keydown', event => {
            this.handleReorderKeyboard(event);
        });
    }

    setupModuleListeners() {
        this.newModuleButton?.addEventListener('click', event => {
            this.openModuleEditor(null, event.currentTarget);
        });
        this.modulesRoot?.addEventListener('click', event => {
            const customModuleButton = event.target.closest('[data-custom-module-action]');
            if (customModuleButton) {
                const action = customModuleButton.dataset.customModuleAction;
                const moduleId = customModuleButton.dataset.moduleId;
                if (action === 'new') {
                    this.openModuleEditor(null, customModuleButton);
                } else if (action === 'edit') {
                    this.openModuleEditor(moduleId, customModuleButton);
                } else if (action === 'new-card') {
                    this.openEditor(moduleId, null, customModuleButton);
                } else if (action === 'move-up') {
                    this.moveCustomModule(moduleId, -1);
                } else if (action === 'move-down') {
                    this.moveCustomModule(moduleId, 1);
                } else if (action === 'archive') {
                    void this.archiveCustomModule(moduleId);
                } else if (action === 'restore') {
                    this.restoreCustomModule(moduleId);
                } else if (action === 'delete') {
                    this.openModuleDeletionDialog(moduleId, customModuleButton);
                }
                return;
            }

            const quickActionButton = event.target.closest(
                '[data-today-preference-action="toggle"]'
            );
            if (quickActionButton) {
                this.toggleTodayQuickAction(quickActionButton.dataset.quickActionId);
                return;
            }

            const favoriteButton = event.target.closest('[data-module-favorite-action]');
            if (favoriteButton) {
                this.toggleNavigationFavorite(favoriteButton.dataset.moduleId);
                return;
            }

            const button = event.target.closest('[data-module-visibility-action]');
            if (!button) return;
            const moduleId = button.dataset.moduleId;
            if (!this.getAppModules()[moduleId]) return;
            this.toggleModuleVisibility(moduleId);
        });
    }

    isModuleVisible(moduleId) {
        if (!this.getAppModules()[moduleId]) return false;
        return this.registry.modulePreferences?.[moduleId]?.visible !== false;
    }

    getFirstVisibleModuleId() {
        return Object.keys(this.getAppModules()).find(moduleId => this.isModuleVisible(moduleId))
            || null;
    }

    getNavigationPreferences() {
        this.registry.navigationPreferences = normalizeNavigationPreferences(
            this.registry.navigationPreferences,
            { customModules: this.registry.customModules }
        );
        return this.registry.navigationPreferences;
    }

    getFavoriteModuleIds() {
        return [...this.getNavigationPreferences().favoriteModules];
    }

    toggleNavigationFavorite(moduleId) {
        const modules = this.getAppModules();
        if (!modules[moduleId]) return false;
        const preferences = this.getNavigationPreferences();
        const favorites = new Set(preferences.favoriteModules);
        const wasFavorite = favorites.has(moduleId);
        if (wasFavorite) {
            if (favorites.size <= 1) {
                this.showModulesFeedback('Dejá al menos un módulo favorito para la barra del celular.');
                return false;
            }
            favorites.delete(moduleId);
        } else {
            if (favorites.size >= 4) {
                this.showModulesFeedback('La barra del celular admite hasta cuatro favoritos. Quitá uno antes de agregar otro.');
                return false;
            }
            favorites.add(moduleId);
        }
        this.registry.navigationPreferences = normalizeNavigationPreferences({
            favoriteModules: [...favorites]
        }, { customModules: this.registry.customModules });
        this.persistRegistry();
        this.showModulesFeedback(
            wasFavorite
                ? `${modules[moduleId].label} se quitó de la barra del celular.`
                : `${modules[moduleId].label} se agregó a la barra del celular.`
        );
        return true;
    }

    toggleModuleVisibility(moduleId) {
        const modules = this.getAppModules();
        if (!modules[moduleId]) return false;
        const current = this.isModuleVisible(moduleId);
        const visibleCount = Object.keys(modules)
            .filter(id => this.isModuleVisible(id))
            .length;
        if (current && visibleCount <= 1) {
            this.showModulesFeedback(
                'Debe quedar al menos un módulo visible para poder volver a la aplicación.'
            );
            return false;
        }

        this.registry.modulePreferences[moduleId] = {
            visible: !current
        };
        this.persistRegistry();
        this.showModulesFeedback(
            !current
                ? `${modules[moduleId].label} volvió a la navegación.`
                : `${modules[moduleId].label} quedó oculto sin borrar sus datos.`
        );
        return true;
    }

    applyModuleVisibility() {
        this.ensureCustomModuleRuntime();
        this.ensureRuntimeOrderControls();
        const mainNav = document.getElementById('main-nav');
        Object.keys(this.getAppModules()).forEach(moduleId => {
            const visible = this.isModuleVisible(moduleId);
            const navButton = mainNav?.querySelector(
                `.nav-btn[data-section="${moduleId}"]`
            );
            navButton?.classList.toggle('module-hidden', !visible);
            navButton?.setAttribute('aria-hidden', String(!visible));
            if (navButton) navButton.tabIndex = visible ? 0 : -1;
        });

        const activeModuleId = this.app.lastActiveSectionId;
        if (activeModuleId && !this.isModuleVisible(activeModuleId)) {
            this.app.lastActiveSectionId = this.getFirstVisibleModuleId();
        }
        this.app.adaptiveNavigation?.refresh?.();
        this.renderModulesManager();
    }

    renderModulesManager() {
        if (!this.modulesSummary) return;
        this.renderCustomModulesManager();
        const favorites = new Set(this.getFavoriteModuleIds());
        this.modulesSummary.innerHTML = Object.entries(this.getAppModules())
            .map(([moduleId, module]) => {
                const visible = this.isModuleVisible(moduleId);
                const favorite = favorites.has(moduleId);
                return `
                    <article class="module-visibility-card ${visible ? '' : 'is-hidden'}">
                        <span class="module-visibility-icon">
                            <i class="ph ${module.icon}"></i>
                        </span>
                        <span class="module-visibility-copy">
                            <strong>${escapeHtml(module.label)}</strong>
                            <small>${visible ? 'Visible en la navegación' : 'Oculto · datos conservados'}</small>
                        </span>
                        <span class="module-visibility-actions">
                            <button
                                type="button"
                                class="module-favorite-toggle ${favorite ? 'active' : ''}"
                                data-module-favorite-action="toggle"
                                data-module-id="${moduleId}"
                                aria-label="${favorite ? 'Quitar' : 'Agregar'} ${escapeHtml(module.label)} ${favorite ? 'de' : 'a'} favoritos móviles"
                                data-tooltip="${favorite ? 'Quitar de la barra móvil' : 'Agregar a la barra móvil'}"
                                aria-pressed="${favorite}"
                            ><i class="ph ${favorite ? 'ph-fill ph-star' : 'ph-star'}"></i></button>
                            <button
                                type="button"
                                class="module-visibility-toggle ${visible ? 'active' : ''}"
                                data-module-visibility-action="toggle"
                                data-module-id="${moduleId}"
                                aria-label="${visible ? 'Ocultar' : 'Mostrar'} módulo ${escapeHtml(module.label)}"
                                data-tooltip="${visible ? 'Ocultar módulo' : 'Mostrar módulo'}"
                                aria-pressed="${visible}"
                            >
                                <span aria-hidden="true"></span>
                            </button>
                        </span>
                    </article>
                `;
            })
            .join('');
        this.renderTodayActionsManager();
    }

    renderCustomModulesManager() {
        if (!this.customModulesSummary) return;
        const active = this.registry.customModules.filter(module => !module.archived);
        const archived = this.registry.customModules.filter(module => module.archived);
        const activeHtml = active.length > 0
            ? active.map((module, index) => {
                const cardCount = this.registry.trackers.filter(tracker => (
                    tracker.section === module.id
                    && !tracker.archived
                    && !tracker.deleted
                )).length;
                const color = CUSTOM_MODULE_COLORS[module.color] || CUSTOM_MODULE_COLORS.blue;
                return `
                    <article class="custom-module-manager-card" style="--custom-module-color:${color}">
                        <span class="custom-module-manager-icon"><i class="ph ${module.icon}"></i></span>
                        <span class="custom-module-manager-copy">
                            <strong>${escapeHtml(module.name)}</strong>
                            <small>${cardCount} ${cardCount === 1 ? 'tarjeta activa' : 'tarjetas activas'}${module.description ? ` · ${escapeHtml(module.description)}` : ''}</small>
                        </span>
                        <span class="custom-module-manager-actions">
                            <button type="button" data-custom-module-action="move-up" data-module-id="${module.id}" ${index === 0 ? 'disabled' : ''} aria-label="Mover ${escapeHtml(module.name)} hacia arriba" data-tooltip="Mover arriba"><i class="ph ph-arrow-up"></i></button>
                            <button type="button" data-custom-module-action="move-down" data-module-id="${module.id}" ${index === active.length - 1 ? 'disabled' : ''} aria-label="Mover ${escapeHtml(module.name)} hacia abajo" data-tooltip="Mover abajo"><i class="ph ph-arrow-down"></i></button>
                            <button type="button" data-custom-module-action="new-card" data-module-id="${module.id}" aria-label="Crear tarjeta en ${escapeHtml(module.name)}" data-tooltip="Nueva tarjeta"><i class="ph ph-plus"></i></button>
                            <button type="button" data-custom-module-action="edit" data-module-id="${module.id}" aria-label="Editar módulo ${escapeHtml(module.name)}" data-tooltip="Editar módulo"><i class="ph ph-pencil-simple"></i></button>
                            <button type="button" class="danger" data-custom-module-action="archive" data-module-id="${module.id}" aria-label="Archivar módulo ${escapeHtml(module.name)}" data-tooltip="Archivar módulo"><i class="ph ph-archive"></i></button>
                        </span>
                    </article>
                `;
            }).join('')
            : `
                <div class="custom-modules-empty">
                    <i class="ph ph-squares-four"></i>
                    <span><strong>Todavía no creaste módulos propios</strong><small>Por ejemplo: Mascotas, Plantas, Hogar o Estudios.</small></span>
                    <button type="button" class="btn btn-secondary" data-custom-module-action="new">Crear el primero</button>
                </div>
            `;
        const archivedHtml = archived.length > 0
            ? `
                <details class="custom-modules-archived">
                    <summary><span><i class="ph ph-archive"></i> Archivados</span><small>${archived.length}</small></summary>
                    <div>
                        ${archived.map(module => {
                            const plan = getCustomModuleDeletionPlan(this.registry, module.id);
                            const cardSummary = plan.counts.total === 0
                                ? 'Sin tarjetas; puede eliminarse definitivamente.'
                                : `${plan.counts.total} ${plan.counts.total === 1 ? 'tarjeta conservada' : 'tarjetas conservadas'}; alertas pausadas.`;
                            return `
                            <article class="custom-module-manager-card is-archived">
                                <span class="custom-module-manager-icon"><i class="ph ${module.icon}"></i></span>
                                <span class="custom-module-manager-copy"><strong>${escapeHtml(module.name)}</strong><small>${escapeHtml(cardSummary)}</small></span>
                                <span class="custom-module-manager-actions">
                                    <button type="button" data-custom-module-action="restore" data-module-id="${module.id}" aria-label="Restaurar módulo ${escapeHtml(module.name)}" data-tooltip="Restaurar"><i class="ph ph-arrow-counter-clockwise"></i></button>
                                    <button type="button" class="danger" data-custom-module-action="delete" data-module-id="${module.id}" aria-label="Eliminar definitivamente módulo ${escapeHtml(module.name)}" data-tooltip="Eliminar definitivamente"><i class="ph ph-trash"></i></button>
                                </span>
                            </article>
                        `;
                        }).join('')}
                    </div>
                </details>
            `
            : '';
        this.customModulesSummary.innerHTML = `<div class="custom-modules-list">${activeHtml}</div>${archivedHtml}`;

    }

    showCustomModulesFeedback(message, { tone = 'success' } = {}) {
        if (!this.customModulesFeedback) return;
        this.customModulesFeedback.textContent = message;
        this.customModulesFeedback.dataset.tone = tone;
        this.customModulesFeedback.classList.remove('hidden');
        clearTimeout(this.customModulesFeedbackTimer);
        this.customModulesFeedbackTimer = setTimeout(() => {
            this.customModulesFeedback?.classList.add('hidden');
        }, 4200);
    }

    moveCustomModule(moduleId, direction) {
        const active = this.registry.customModules.filter(module => !module.archived);
        const index = active.findIndex(module => module.id === moduleId);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= active.length) return false;
        [active[index], active[targetIndex]] = [active[targetIndex], active[index]];
        active.forEach((module, order) => {
            const stored = this.getCustomModule(module.id);
            if (stored) stored.order = order;
        });
        this.persistRegistry();
        this.showCustomModulesFeedback('Orden de módulos actualizado.');
        return true;
    }

    async archiveCustomModule(moduleId) {
        const module = this.getCustomModule(moduleId);
        if (!module || module.archived) return false;
        const cardCount = this.registry.trackers.filter(tracker => (
            tracker.section === module.id && !tracker.deleted
        )).length;
        const confirmed = await this.app.confirmAction({
            title: `Archivar ${module.name}`,
            message: cardCount > 0
                ? `El módulo desaparecerá de la navegación. Sus ${cardCount} ${cardCount === 1 ? 'tarjeta e historial quedarán conservados' : 'tarjetas e historiales quedarán conservados'} y sus avisos se pausarán hasta restaurarlo.`
                : 'El módulo desaparecerá de la navegación y podrás restaurarlo cuando quieras.',
            confirmLabel: 'Archivar módulo',
            cancelLabel: 'Cancelar',
            tone: 'warning'
        });
        if (!confirmed) return false;

        const sectionId = getCustomModuleSectionId(module.id);
        const wasActive = this.app.lastActiveSectionId === sectionId;
        module.archived = true;
        module.updatedAt = new Date().toISOString();
        this.registry.navigationPreferences.favoriteModules = this.registry.navigationPreferences.favoriteModules
            .filter(id => id !== sectionId);
        this.persistRegistry();
        if (wasActive) {
            this.app.activateSection(this.getFirstVisibleModuleId(), {
                persist: true,
                render: true
            });
        }
        this.showCustomModulesFeedback(`${module.name} quedó archivado con sus datos conservados.`);
        return true;
    }

    restoreCustomModule(moduleId) {
        const module = this.getCustomModule(moduleId);
        if (!module || !module.archived) return false;
        module.archived = false;
        module.updatedAt = new Date().toISOString();
        this.registry.modulePreferences[getCustomModuleSectionId(module.id)] = { visible: true };
        this.persistRegistry();
        this.showCustomModulesFeedback(`${module.name} volvió a estar disponible.`);
        return true;
    }

    getTodayPreferences() {
        this.registry.todayPreferences = normalizeTodayPreferences(
            this.registry.todayPreferences
        );
        return this.registry.todayPreferences;
    }

    isTodayQuickActionAvailable(actionId) {
        const action = TODAY_QUICK_ACTIONS[actionId];
        if (!action) return false;
        return !action.moduleId || this.isModuleVisible(action.moduleId);
    }

    toggleTodayQuickAction(actionId) {
        if (!TODAY_QUICK_ACTIONS[actionId]) return false;

        const preferences = this.getTodayPreferences();
        const selected = new Set(preferences.quickActions);
        const wasSelected = selected.has(actionId);
        if (wasSelected) selected.delete(actionId);
        else selected.add(actionId);

        preferences.quickActions = Object.keys(TODAY_QUICK_ACTIONS)
            .filter(id => selected.has(id));
        this.registry.todayPreferences = normalizeTodayPreferences(preferences);
        this.persistRegistry();
        this.showTodayActionsFeedback(
            wasSelected
                ? `${TODAY_QUICK_ACTIONS[actionId].label} se quitó de Hoy.`
                : `${TODAY_QUICK_ACTIONS[actionId].label} se agregó a Hoy.`
        );
        this.app.today?.render();
        return true;
    }

    renderTodayActionsManager() {
        if (!this.todayActionsSummary) return;
        const selected = new Set(this.getTodayPreferences().quickActions);
        const availableSelectedCount = Array.from(selected)
            .filter(actionId => this.isTodayQuickActionAvailable(actionId))
            .length;

        if (this.todayActionsCount) {
            this.todayActionsCount.textContent = (
                `${availableSelectedCount} ${availableSelectedCount === 1 ? 'visible' : 'visibles'}`
            );
        }

        this.todayActionsSummary.innerHTML = Object.entries(TODAY_QUICK_ACTIONS)
            .map(([actionId, action]) => {
                const active = selected.has(actionId);
                const available = this.isTodayQuickActionAvailable(actionId);
                const moduleLabel = action.moduleId
                    ? APP_MODULES[action.moduleId]?.label
                    : null;
                const statusText = available
                    ? (active ? 'Visible en Hoy' : 'Disponible')
                    : `${moduleLabel || 'Módulo'} está oculto`;

                return `
                    <article class="today-action-preference ${active ? 'is-active' : ''} ${available ? '' : 'is-unavailable'}">
                        <span class="today-action-preference-icon">
                            <i class="ph ${action.icon}"></i>
                        </span>
                        <span class="today-action-preference-copy">
                            <strong>${escapeHtml(action.label)}</strong>
                            <small>${escapeHtml(statusText)}</small>
                            <span>${escapeHtml(action.description)}</span>
                        </span>
                        <button
                            type="button"
                            class="module-visibility-toggle ${active ? 'active' : ''}"
                            data-today-preference-action="toggle"
                            data-quick-action-id="${actionId}"
                            aria-label="${active ? 'Quitar' : 'Agregar'} acceso ${escapeHtml(action.label)} ${active ? 'de' : 'a'} Hoy"
                            data-tooltip="${active ? 'Quitar de Hoy' : 'Agregar a Hoy'}"
                            aria-pressed="${active}"
                        >
                            <span aria-hidden="true"></span>
                        </button>
                    </article>
                `;
            })
            .join('');
    }

    showTodayActionsFeedback(message) {
        if (!this.todayActionsFeedback) return;
        this.todayActionsFeedback.textContent = message;
        this.todayActionsFeedback.classList.remove('hidden');
        clearTimeout(this.todayActionsFeedbackTimer);
        this.todayActionsFeedbackTimer = setTimeout(() => {
            this.todayActionsFeedback?.classList.add('hidden');
        }, 3600);
    }

    showModulesFeedback(message) {
        if (!this.modulesFeedback) return;
        this.modulesFeedback.textContent = message;
        this.modulesFeedback.classList.remove('hidden');
        clearTimeout(this.modulesFeedbackTimer);
        this.modulesFeedbackTimer = setTimeout(() => {
            this.modulesFeedback?.classList.add('hidden');
        }, 3600);
    }

    setupRuntimeListeners() {
        document.addEventListener('toggle', event => {
            const menu = event.target;
            if (!(menu instanceof HTMLDetailsElement) || !menu.matches('.custom-tracker-menu')) {
                return;
            }
            menu.querySelector('summary')?.setAttribute(
                'aria-expanded',
                String(menu.open)
            );
        }, true);

        document.addEventListener('click', event => {
            document.querySelectorAll('.custom-tracker-menu[open]').forEach(menu => {
                if (!menu.contains(event.target)) menu.removeAttribute('open');
            });

            const customModuleButton = event.target.closest(
                '[data-custom-module-runtime-action="new-card"]'
            );
            if (customModuleButton) {
                this.openEditor(
                    customModuleButton.dataset.moduleId,
                    null,
                    customModuleButton
                );
                return;
            }

            const bulkButton = event.target.closest(
                '.custom-runtime-order-toolbar [data-custom-bulk-action]'
            );
            if (bulkButton) {
                const action = bulkButton.dataset.customBulkAction;
                if (action === 'enter') {
                    this.enterBulkMode(bulkButton.dataset.section);
                } else if (action === 'record') {
                    this.commitBulkMode();
                } else if (action === 'cancel') {
                    this.cancelBulkMode();
                }
                return;
            }

            const orderButton = event.target.closest(
                '.custom-runtime-order-toolbar [data-custom-order-action]'
            );
            if (orderButton) {
                const action = orderButton.dataset.customOrderAction;
                if (action === 'enter-runtime') {
                    this.enterReorderMode(
                        'runtime',
                        orderButton.dataset.section
                    );
                } else if (action === 'save') {
                    this.saveReorderMode();
                } else if (action === 'cancel') {
                    this.cancelReorderMode();
                }
                return;
            }

            const featureButton = event.target.closest('[data-custom-feature-action]');
            if (featureButton) {
                this.toggleDraftFeaturedTracker(featureButton.dataset.trackerId);
                return;
            }

            const bulkCard = event.target.closest(
                '.custom-tracker-card.is-bulk-selectable[data-tracker-id]'
            );
            if (
                bulkCard
                && this.bulkContext?.sectionKey === bulkCard.dataset.customRuntimeSection
            ) {
                this.toggleBulkSelection(bulkCard.dataset.trackerId);
                return;
            }

            const button = event.target.closest(
                '.custom-tracker-card [data-custom-runtime-action]'
            );
            if (!button) return;
            if (this.reorderContext?.scope === 'runtime') return;

            const action = button.dataset.customRuntimeAction;
            const trackerId = button.dataset.trackerId;
            const tracker = this.getTracker(trackerId);
            if (!tracker) return;
            const menu = button.closest('.custom-tracker-menu');
            const menuTrigger = menu?.querySelector('summary') || button;
            menu?.removeAttribute('open');

            if (action === 'toggle-bulk') {
                this.toggleBulkSelection(trackerId);
            } else if (this.bulkContext?.sectionKey === tracker.section) {
                return;
            } else if (action === 'edit-config') {
                this.openManagerEditor(trackerId);
            } else if (action === 'archive') {
                this.archiveTracker(trackerId, { showGlobalUndo: true });
            } else if (action === 'record') {
                this.recordTracker(trackerId, { trigger: button });
            } else if (action === 'open-history') {
                if (isMedicalStudyTracker(tracker)) {
                    this.app.health?.openStudyHistory?.(trackerId, menuTrigger);
                } else {
                    this.openHistoryDialog(trackerId, menuTrigger);
                }
            } else if (action === 'open-instructions') {
                this.openInstructionsDialog(trackerId, menuTrigger);
            }
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                const openMenus = Array.from(document.querySelectorAll(
                    '.custom-tracker-menu[open]'
                ));
                if (openMenus.length > 0) {
                    openMenus.forEach(menu => menu.removeAttribute('open'));
                    openMenus[0].querySelector('summary')?.focus();
                    return;
                }
            }
            if (event.target.closest('.custom-runtime-order-toolbar')) return;
            if (!event.target.closest('.main-section.is-custom-reordering')) return;
            this.handleReorderKeyboard(event);
        });
    }

    openManagerEditor(trackerId) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived || tracker.deleted) return false;

        this.activeCategoryFilter = tracker.section;
        this.managerSearchQuery = '';
        this.app.saveUiState?.({ trackerManagerFilter: tracker.section });
        if (!this.app.openProfileTab?.('seguimientos')) return false;

        requestAnimationFrame(() => {
            const editButton = this.managerRoot?.querySelector(
                `[data-custom-manager-action="edit"][data-tracker-id="${tracker.id}"]`
            );
            const row = editButton?.closest('.custom-manager-row');
            row?.classList.add('is-targeted');
            row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            this.openEditor(tracker.section, tracker.id, editButton || null);
            if (row) {
                setTimeout(() => row.classList.remove('is-targeted'), 1800);
            }
        });
        return true;
    }

    ensureHistoryDialog() {
        document.getElementById('custom-tracker-history-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'custom-tracker-history-dialog';
        dialog.className = 'custom-tracker-dialog custom-tracker-history-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'custom-tracker-history-dialog-title');
        dialog.setAttribute('aria-describedby', 'custom-tracker-history-dialog-subtitle');
        dialog.innerHTML = `
            <div class="custom-tracker-dialog-card custom-tracker-history-dialog-card">
                <div class="custom-tracker-dialog-header">
                    <div>
                        <span class="custom-trackers-eyebrow">Historial de la tarjeta</span>
                        <h2 id="custom-tracker-history-dialog-title">Historial</h2>
                        <p id="custom-tracker-history-dialog-subtitle"></p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-history-dialog-action="close" aria-label="Cerrar historial" data-tooltip="Cerrar">
                        <i class="ph ph-x" aria-hidden="true"></i>
                    </button>
                </div>
                <div id="custom-tracker-history-dialog-body"></div>
                <div class="custom-tracker-dialog-actions custom-tracker-history-dialog-actions">
                    <button type="button" class="btn btn-secondary" data-history-dialog-action="close">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        this.historyDialog = dialog;

        dialog.addEventListener('click', event => {
            if (event.target === dialog) {
                this.closeHistoryDialog();
                return;
            }

            const button = event.target.closest('[data-history-dialog-action]');
            if (!button) return;
            const action = button.dataset.historyDialogAction;

            if (action === 'close') {
                this.closeHistoryDialog();
            } else if (action === 'edit-latest') {
                this.historyEditMode = true;
                this.renderHistoryDialog();
                requestAnimationFrame(() => {
                    this.historyDialog?.querySelector('#custom-tracker-history-date')?.focus();
                });
            } else if (action === 'cancel-edit') {
                this.historyEditMode = false;
                this.renderHistoryDialog();
                requestAnimationFrame(() => {
                    this.historyDialog?.querySelector('[data-history-dialog-action="edit-latest"]')?.focus();
                });
            } else if (action === 'request-delete') {
                const historyIndex = Number(button.dataset.historyIndex);
                this.pendingHistoryDeleteKeys.add(
                    this.getHistoryDeleteKey(this.historyDialogTrackerId, historyIndex)
                );
                this.renderHistoryDialog();
            } else if (action === 'cancel-delete') {
                const historyIndex = Number(button.dataset.historyIndex);
                this.pendingHistoryDeleteKeys.delete(
                    this.getHistoryDeleteKey(this.historyDialogTrackerId, historyIndex)
                );
                this.renderHistoryDialog();
            } else if (action === 'confirm-delete') {
                this.deleteHistoryEntry(
                    this.historyDialogTrackerId,
                    Number(button.dataset.historyIndex)
                );
            }
        });

        dialog.addEventListener('submit', event => {
            if (!event.target.matches('[data-custom-history-edit-form]')) return;
            event.preventDefault();
            this.saveHistoryDate();
        });

        document.addEventListener('keydown', event => {
            if (!this.historyDialog || this.historyDialog.classList.contains('hidden')) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                if (this.historyEditMode) {
                    this.historyEditMode = false;
                    this.renderHistoryDialog();
                } else {
                    this.closeHistoryDialog();
                }
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = Array.from(this.historyDialog.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), a[href]'
            )).filter(element => !element.closest('.hidden'));
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    ensureInstructionsDialog() {
        document.getElementById('custom-tracker-instructions-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'custom-tracker-instructions-dialog';
        dialog.className = 'custom-tracker-dialog custom-tracker-instructions-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'custom-tracker-instructions-dialog-title');
        dialog.innerHTML = `
            <div class="custom-tracker-dialog-card custom-tracker-instructions-dialog-card">
                <div class="custom-tracker-dialog-header">
                    <div>
                        <span class="custom-trackers-eyebrow">Instrucciones de la tarjeta</span>
                        <h2 id="custom-tracker-instructions-dialog-title">Instrucciones</h2>
                        <p id="custom-tracker-instructions-dialog-subtitle"></p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-instructions-dialog-action="close" aria-label="Cerrar instrucciones" data-tooltip="Cerrar">
                        <i class="ph ph-x" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="custom-tracker-instructions-dialog-body"></div>
                <div class="custom-tracker-dialog-actions">
                    <button type="button" class="btn btn-secondary" data-instructions-dialog-action="close">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        this.instructionsDialog = dialog;

        dialog.addEventListener('click', event => {
            if (
                event.target === dialog
                || event.target.closest('[data-instructions-dialog-action="close"]')
            ) {
                this.closeInstructionsDialog();
            }
        });
        document.addEventListener('keydown', event => {
            if (
                event.key === 'Escape'
                && this.instructionsDialog
                && !this.instructionsDialog.classList.contains('hidden')
            ) {
                event.preventDefault();
                this.closeInstructionsDialog();
            }
        });
    }

    openInstructionsDialog(trackerId, trigger = null) {
        const tracker = this.getTracker(trackerId);
        if (
            !tracker
            || tracker.archived
            || tracker.deleted
            || !tracker.instructions
            || !this.instructionsDialog
        ) return false;

        this.instructionsDialogTrackerId = tracker.id;
        this.instructionsDialogTrigger = trigger instanceof HTMLElement ? trigger : null;
        const section = this.getSections()[tracker.section];
        const subsection = section?.subsections?.[tracker.subsection];
        this.instructionsDialog.querySelector(
            '#custom-tracker-instructions-dialog-title'
        ).textContent = tracker.name;
        this.instructionsDialog.querySelector(
            '#custom-tracker-instructions-dialog-subtitle'
        ).textContent = [section?.label, subsection?.label].filter(Boolean).join(' · ');
        const body = this.instructionsDialog.querySelector(
            '.custom-tracker-instructions-dialog-body'
        );
        body.replaceChildren();
        tracker.instructions.split(/\n{2,}/).filter(Boolean).forEach(blockText => {
            const paragraph = document.createElement('p');
            paragraph.textContent = blockText;
            body.appendChild(paragraph);
        });
        if (body.childElementCount === 0) body.textContent = tracker.instructions;

        this.instructionsDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            this.instructionsDialog
                ?.querySelector('[data-instructions-dialog-action="close"]')
                ?.focus();
        });
        return true;
    }

    closeInstructionsDialog({ restoreFocus = true } = {}) {
        if (!this.instructionsDialog || this.instructionsDialog.classList.contains('hidden')) return;
        const trackerId = this.instructionsDialogTrackerId;
        const previousTrigger = this.instructionsDialogTrigger;
        this.instructionsDialog.classList.add('hidden');
        this.instructionsDialogTrackerId = null;
        this.instructionsDialogTrigger = null;
        document.body.classList.remove('modal-open');
        if (!restoreFocus) return;
        const fallbackTrigger = trackerId
            ? document.querySelector(
                `.custom-tracker-card[data-tracker-id="${CSS.escape(trackerId)}"] .custom-tracker-menu summary`
            )
            : null;
        requestAnimationFrame(() => {
            (previousTrigger?.isConnected ? previousTrigger : fallbackTrigger)?.focus?.();
        });
    }

    openHistoryDialog(trackerId, trigger = null) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived || tracker.deleted || !this.historyDialog) return false;

        this.historyDialogTrackerId = trackerId;
        this.historyDialogTrigger = trigger instanceof HTMLElement ? trigger : null;
        this.historyEditMode = false;
        this.clearPendingHistoryDeletes(trackerId);
        this.renderHistoryDialog();
        this.historyDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            this.historyDialog?.querySelector('[data-history-dialog-action="close"]')?.focus();
        });
        return true;
    }

    closeHistoryDialog({ restoreFocus = true } = {}) {
        if (!this.historyDialog || this.historyDialog.classList.contains('hidden')) return;
        const trackerId = this.historyDialogTrackerId;
        const previousTrigger = this.historyDialogTrigger;
        if (trackerId) this.clearPendingHistoryDeletes(trackerId);
        this.historyDialog.classList.add('hidden');
        this.historyDialogTrackerId = null;
        this.historyDialogTrigger = null;
        this.historyEditMode = false;
        document.body.classList.remove('modal-open');

        if (!restoreFocus) return;
        const fallbackTrigger = trackerId
            ? document.querySelector(
                `.custom-tracker-card[data-tracker-id="${CSS.escape(trackerId)}"] .custom-tracker-menu summary`
            )
            : null;
        requestAnimationFrame(() => {
            (previousTrigger?.isConnected ? previousTrigger : fallbackTrigger)?.focus?.();
        });
    }

    renderHistoryDialog() {
        if (!this.historyDialog || !this.historyDialogTrackerId) return;
        const previousScrollTop = this.historyDialog
            .querySelector('.custom-history-dialog-list')?.scrollTop || 0;
        const tracker = this.getTracker(this.historyDialogTrackerId);
        if (!tracker || tracker.archived || tracker.deleted) {
            this.closeHistoryDialog({ restoreFocus: false });
            return;
        }

        const history = this.getHistory(tracker.id);
        const state = getCustomTrackerState(tracker, history);
        const status = STATUS_META[state.status] || STATUS_META.new;
        const section = this.getSections()[tracker.section];
        const subsection = section?.subsections?.[tracker.subsection];
        const latestLabel = state.latest
            ? DateUtils.formatFriendlyDate(state.latest)
            : 'Nunca';
        const nextLabel = state.nextDate
            ? DateUtils.formatFriendlyDate(state.nextDate)
            : 'Después del primer registro';
        const historyCountLabel = `${history.length} ${history.length === 1 ? 'registro' : 'registros'}`;

        this.historyDialog.style.setProperty('--custom-status-color', status.color);
        this.historyDialog.querySelector('#custom-tracker-history-dialog-title').textContent = (
            tracker.name
        );
        this.historyDialog.querySelector('#custom-tracker-history-dialog-subtitle').textContent = [
            section?.label,
            subsection?.label
        ].filter(Boolean).join(' · ');

        const body = this.historyDialog.querySelector('#custom-tracker-history-dialog-body');
        body.innerHTML = `
            <div class="custom-history-dialog-summary" aria-label="Resumen de ${escapeHtml(tracker.name)}">
                <article>
                    <span>Estado</span>
                    <strong class="custom-history-dialog-status">${escapeHtml(status.label)}</strong>
                </article>
                <article>
                    <span>Último</span>
                    <strong>${escapeHtml(latestLabel)}</strong>
                </article>
                <article>
                    <span>Próximo</span>
                    <strong>${escapeHtml(nextLabel)}</strong>
                </article>
            </div>
            <div class="custom-history-dialog-heading">
                <div>
                    <h3>Registros</h3>
                    <small>${escapeHtml(historyCountLabel)} · más recientes primero</small>
                </div>
                <button
                    type="button"
                    class="btn btn-secondary"
                    data-history-dialog-action="edit-latest"
                    ${history.length === 0 ? 'disabled' : ''}
                >
                    <i class="ph ph-calendar-pencil" aria-hidden="true"></i>
                    Editar última fecha
                </button>
            </div>
            ${this.historyEditMode && history.length > 0 ? `
                <form class="custom-history-edit-form" data-custom-history-edit-form novalidate>
                    <label for="custom-tracker-history-date">Nueva fecha del último registro</label>
                    <div>
                        <input
                            id="custom-tracker-history-date"
                            class="date-input"
                            type="date"
                            value="${getLocalISODate(new Date(history[0]))}"
                            max="${getLocalISODate()}"
                            required
                        >
                        <button type="button" class="btn btn-secondary" data-history-dialog-action="cancel-edit">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar fecha</button>
                    </div>
                    <p class="custom-history-edit-error hidden" role="alert"></p>
                </form>
            ` : ''}
            <div class="custom-history-dialog-list" role="region" aria-label="Registros de ${escapeHtml(tracker.name)}" tabindex="0">
                ${history.length > 0 ? `
                    <ol>
                        ${history.map((date, historyIndex) => {
                            const confirmationKey = this.getHistoryDeleteKey(
                                tracker.id,
                                historyIndex
                            );
                            const awaitingConfirmation = this.pendingHistoryDeleteKeys.has(
                                confirmationKey
                            );
                            return `
                                <li class="${awaitingConfirmation ? 'is-confirming' : ''}">
                                    <span class="custom-history-dialog-date">
                                        <i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i>
                                        <span>
                                            <strong>${escapeHtml(DateUtils.formatDateTime(date))}</strong>
                                            <small>Registro ${history.length - historyIndex} de ${history.length}</small>
                                        </span>
                                    </span>
                                    ${awaitingConfirmation ? `
                                        <span class="custom-history-dialog-delete-confirmation">
                                            <span>¿Borrar este registro?</span>
                                            <button type="button" class="btn btn-secondary" data-history-dialog-action="cancel-delete" data-history-index="${historyIndex}">Cancelar</button>
                                            <button type="button" class="btn btn-danger" data-history-dialog-action="confirm-delete" data-history-index="${historyIndex}">Borrar</button>
                                        </span>
                                    ` : `
                                        <button
                                            type="button"
                                            class="custom-history-dialog-delete"
                                            data-history-dialog-action="request-delete"
                                            data-history-index="${historyIndex}"
                                            aria-label="Borrar registro del ${escapeHtml(DateUtils.formatDateTime(date))}"
                                            data-tooltip="Borrar registro"
                                        >
                                            <i class="ph ph-trash" aria-hidden="true"></i>
                                        </button>
                                    `}
                                </li>
                            `;
                        }).join('')}
                    </ol>
                ` : `
                    <div class="custom-history-dialog-empty">
                        <i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i>
                        <strong>Todavía no hay registros</strong>
                        <span>La primera fecha aparecerá después de usar la acción principal de la tarjeta.</span>
                    </div>
                `}
            </div>
        `;
        const historyList = body.querySelector('.custom-history-dialog-list');
        if (historyList) historyList.scrollTop = previousScrollTop;
    }

    saveHistoryDate() {
        const input = this.historyDialog?.querySelector('#custom-tracker-history-date');
        const error = this.historyDialog?.querySelector('.custom-history-edit-error');
        const trackerId = this.historyDialogTrackerId;
        if (!input || !trackerId) return false;

        if (!input.value || input.value > getLocalISODate()) {
            if (error) {
                error.textContent = 'Elegí una fecha válida que no esté en el futuro.';
                error.classList.remove('hidden');
            }
            return false;
        }

        const selectedDate = combineLocalDateWithTime(input.value, new Date());
        if (!selectedDate || !this.updateLatestDate(trackerId, selectedDate)) {
            if (error) {
                error.textContent = 'No se pudo actualizar la fecha. Revisala e intentá nuevamente.';
                error.classList.remove('hidden');
            }
            return false;
        }

        this.historyEditMode = false;
        this.renderHistoryDialog();
        requestAnimationFrame(() => {
            this.historyDialog?.querySelector('[data-history-dialog-action="edit-latest"]')?.focus();
        });
        return true;
    }

    ensureModuleEditorDialog() {
        document.getElementById('custom-module-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'custom-module-dialog';
        dialog.className = 'custom-tracker-dialog custom-module-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'custom-module-dialog-title');
        dialog.innerHTML = `
            <div class="custom-tracker-dialog-card custom-module-dialog-card">
                <div class="custom-tracker-dialog-header">
                    <div>
                        <span class="custom-trackers-eyebrow">Constructor de módulos</span>
                        <h2 id="custom-module-dialog-title">Nuevo módulo</h2>
                        <p>Creá un espacio que agrupe tarjetas configurables.</p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-module-dialog-action="close" aria-label="Cerrar editor de módulo" data-tooltip="Cerrar">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <form id="custom-module-form" novalidate>
                    <div class="custom-module-preview" aria-live="polite">
                        <span class="custom-module-preview-icon"><i class="ph ph-paw-print"></i></span>
                        <span>
                            <small>MÓDULO PERSONALIZADO</small>
                            <strong>Nombre del módulo</strong>
                        </span>
                    </div>
                    <div class="custom-tracker-form-grid">
                        <div class="input-group custom-form-wide">
                            <label for="custom-module-name">Nombre</label>
                            <input id="custom-module-name" class="text-input" type="text" maxlength="48" autocomplete="off" placeholder="Ej: Mascotas" required>
                        </div>
                        <div class="input-group custom-form-wide">
                            <label for="custom-module-description">Descripción opcional</label>
                            <textarea id="custom-module-description" class="text-input custom-module-description" maxlength="180" placeholder="Ej: Controles, cuidados y compras de mis mascotas"></textarea>
                        </div>
                        <div class="input-group">
                            <label for="custom-module-icon">Icono</label>
                            <select id="custom-module-icon" class="text-input"></select>
                        </div>
                        <div class="input-group">
                            <label for="custom-module-color">Color</label>
                            <select id="custom-module-color" class="text-input"></select>
                        </div>
                    </div>
                    <div class="custom-trackers-manager-note custom-module-scope-note">
                        <i class="ph ph-info"></i>
                        <span>Este constructor crea módulos de seguimientos. Vehículo, Finanzas, Proyectos y otros módulos especializados conservan sus herramientas propias.</span>
                    </div>
                    <div id="custom-module-form-error" class="custom-tracker-form-error hidden" role="alert"></div>
                    <div class="custom-tracker-dialog-actions">
                        <button type="button" class="btn btn-secondary" data-module-dialog-action="close">Cancelar</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="ph ph-floppy-disk"></i> Guardar módulo
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(dialog);
        this.moduleDialog = dialog;

        const iconLabels = {
            'ph-paw-print': 'Mascotas',
            'ph-plant': 'Plantas',
            'ph-house': 'Hogar',
            'ph-book-open': 'Estudio',
            'ph-briefcase': 'Trabajo',
            'ph-calendar-check': 'Agenda',
            'ph-heart': 'Bienestar',
            'ph-star': 'Favoritos',
            'ph-package': 'Inventario',
            'ph-airplane-tilt': 'Viajes',
            'ph-game-controller': 'Entretenimiento',
            'ph-music-notes': 'Música',
            'ph-camera': 'Fotografía',
            'ph-bicycle': 'Actividad',
            'ph-check-circle': 'Seguimientos',
            'ph-sparkle': 'General'
        };
        dialog.querySelector('#custom-module-icon').innerHTML = CUSTOM_MODULE_ICONS
            .map(icon => `<option value="${icon}">${escapeHtml(iconLabels[icon] || icon)}</option>`)
            .join('');
        this.moduleIconPicker = createIconPicker(
            dialog.querySelector('#custom-module-icon'),
            {
                labels: iconLabels,
                catalogLabel: 'Explorar iconos del módulo'
            }
        );
        const colorLabels = {
            blue: 'Azul',
            cyan: 'Celeste',
            teal: 'Turquesa',
            green: 'Verde',
            amber: 'Ámbar',
            orange: 'Naranja',
            rose: 'Rosa',
            violet: 'Violeta'
        };
        dialog.querySelector('#custom-module-color').innerHTML = Object.entries(CUSTOM_MODULE_COLORS)
            .map(([key, color]) => `<option value="${key}" style="color:${color}">${escapeHtml(colorLabels[key] || key)}</option>`)
            .join('');

        const updatePreview = () => this.updateModuleEditorPreview();
        dialog.querySelector('#custom-module-name').addEventListener('input', updatePreview);
        dialog.querySelector('#custom-module-icon').addEventListener('change', updatePreview);
        dialog.querySelector('#custom-module-color').addEventListener('change', updatePreview);
        dialog.addEventListener('click', event => {
            if (
                event.target === dialog
                || event.target.closest('[data-module-dialog-action="close"]')
            ) {
                this.closeModuleEditor();
            }
        });
        dialog.querySelector('#custom-module-form').addEventListener('submit', event => {
            event.preventDefault();
            this.saveModuleEditor();
        });
        document.addEventListener('keydown', event => {
            if (this.moduleDialog?.classList.contains('hidden')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeModuleEditor();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(this.moduleDialog.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
            ));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    updateModuleEditorPreview() {
        if (!this.moduleDialog) return;
        const name = this.moduleDialog.querySelector('#custom-module-name').value.trim()
            || 'Nombre del módulo';
        const icon = this.moduleDialog.querySelector('#custom-module-icon').value
            || CUSTOM_MODULE_ICONS[0];
        const colorKey = this.moduleDialog.querySelector('#custom-module-color').value || 'blue';
        const color = CUSTOM_MODULE_COLORS[colorKey] || CUSTOM_MODULE_COLORS.blue;
        const preview = this.moduleDialog.querySelector('.custom-module-preview');
        preview?.style.setProperty('--custom-module-color', color);
        const previewIcon = preview?.querySelector('i');
        if (previewIcon) previewIcon.className = `ph ${icon}`;
        const previewName = preview?.querySelector('strong');
        if (previewName) previewName.textContent = name;
    }

    openModuleEditor(moduleId = null, trigger = null) {
        const module = moduleId ? this.getCustomModule(moduleId) : null;
        if (moduleId && (!module || module.archived)) return false;
        if (!module && !this.ensureCreationCapacity(RESOURCE_KEYS.CUSTOM_MODULES)) {
            return false;
        }
        this.editingModuleId = module?.id || null;
        this.lastModuleDialogTrigger = trigger instanceof HTMLElement ? trigger : null;
        this.moduleDialog.querySelector('#custom-module-dialog-title').textContent = module
            ? `Editar ${module.name}`
            : 'Nuevo módulo';
        this.moduleDialog.querySelector('#custom-module-name').value = module?.name || '';
        this.moduleDialog.querySelector('#custom-module-description').value = module?.description || '';
        this.moduleDialog.querySelector('#custom-module-icon').value = module?.icon || CUSTOM_MODULE_ICONS[0];
        this.moduleDialog.querySelector('#custom-module-color').value = module?.color || 'blue';
        this.moduleDialog.querySelector('#custom-module-form-error').classList.add('hidden');
        this.moduleIconPicker?.refresh();
        this.updateModuleEditorPreview();
        this.moduleDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            this.moduleDialog.querySelector('#custom-module-name')?.focus();
        });
        return true;
    }

    closeModuleEditor() {
        if (!this.moduleDialog || this.moduleDialog.classList.contains('hidden')) return;
        this.moduleDialog.classList.add('hidden');
        document.body.classList.remove('modal-open');
        this.editingModuleId = null;
        const trigger = this.lastModuleDialogTrigger;
        this.lastModuleDialogTrigger = null;
        requestAnimationFrame(() => trigger?.focus?.());
    }

    saveModuleEditor() {
        if (!this.moduleDialog) return false;
        const name = this.moduleDialog.querySelector('#custom-module-name').value.trim();
        const description = this.moduleDialog.querySelector('#custom-module-description').value.trim();
        const icon = this.moduleDialog.querySelector('#custom-module-icon').value;
        const color = this.moduleDialog.querySelector('#custom-module-color').value;
        const error = this.moduleDialog.querySelector('#custom-module-form-error');
        const duplicate = this.registry.customModules.find(module => (
            !module.archived
            && module.id !== this.editingModuleId
            && module.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0
        ));

        if (!name) {
            error.textContent = 'Escribí un nombre para el módulo.';
            error.classList.remove('hidden');
            return false;
        }
        if (duplicate) {
            error.textContent = 'Ya existe un módulo personalizado con ese nombre.';
            error.classList.remove('hidden');
            return false;
        }
        if (
            !this.editingModuleId
            && !this.ensureCreationCapacity(RESOURCE_KEYS.CUSTOM_MODULES, {
                errorElement: error
            })
        ) {
            return false;
        }

        const now = new Date().toISOString();
        const existing = this.editingModuleId
            ? this.getCustomModule(this.editingModuleId)
            : null;
        if (existing) {
            Object.assign(existing, { name, description, icon, color, updatedAt: now });
        } else {
            this.registry.customModules.push({
                id: this.generateModuleId(),
                name,
                description,
                icon,
                color,
                order: this.registry.customModules.filter(module => !module.archived).length,
                archived: false,
                createdAt: now,
                updatedAt: now
            });
        }

        this.closeModuleEditor();
        this.persistRegistry();
        this.showCustomModulesFeedback(
            existing ? `Módulo ${name} actualizado.` : `Módulo ${name} creado. Ya podés agregarle tarjetas.`
        );
        return true;
    }

    ensureModuleDeletionDialog() {
        document.getElementById('custom-module-delete-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'custom-module-delete-dialog';
        dialog.className = 'custom-tracker-dialog custom-module-delete-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'custom-module-delete-title');
        dialog.setAttribute('aria-describedby', 'custom-module-delete-description');
        dialog.innerHTML = `
            <div class="custom-tracker-dialog-card custom-module-delete-card">
                <div class="custom-tracker-dialog-header">
                    <div>
                        <span class="custom-trackers-eyebrow">Eliminación permanente</span>
                        <h2 id="custom-module-delete-title">Eliminar módulo</h2>
                        <p id="custom-module-delete-description">Revisá qué ocurrirá con sus tarjetas antes de continuar.</p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-module-delete-action="close" aria-label="Cerrar eliminación de módulo" data-tooltip="Cerrar">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <form id="custom-module-delete-form" novalidate>
                    <div class="custom-module-delete-summary">
                        <span class="custom-module-manager-icon" data-module-delete-icon><i class="ph ph-squares-four"></i></span>
                        <span>
                            <small>MÓDULO ARCHIVADO</small>
                            <strong data-module-delete-name></strong>
                            <span data-module-delete-counts></span>
                        </span>
                    </div>
                    <fieldset class="custom-module-delete-resolutions" data-module-delete-resolutions>
                        <legend data-module-delete-legend>¿Qué querés hacer con sus tarjetas?</legend>
                        <label class="custom-module-delete-choice">
                            <input type="radio" name="custom-module-card-resolution" value="${CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE}" checked>
                            <span class="custom-module-delete-choice-icon"><i class="ph ph-arrow-bend-down-right"></i></span>
                            <span>
                                <strong>Mover las tarjetas</strong>
                                <small>Conserva tarjetas, historiales, estudios, archivos y configuración de avisos.</small>
                            </span>
                        </label>
                        <div class="custom-module-delete-destination" data-module-delete-destination>
                            <div class="input-group">
                                <label for="custom-module-delete-section">Módulo de destino</label>
                                <select id="custom-module-delete-section" class="text-input"></select>
                            </div>
                            <div class="input-group" data-module-delete-subsection-group>
                                <label for="custom-module-delete-subsection">Ubicación</label>
                                <select id="custom-module-delete-subsection" class="text-input"></select>
                            </div>
                        </div>
                        <label class="custom-module-delete-choice is-danger">
                            <input type="radio" name="custom-module-card-resolution" value="${CUSTOM_MODULE_CARD_RESOLUTIONS.DELETE}">
                            <span class="custom-module-delete-choice-icon"><i class="ph ph-trash"></i></span>
                            <span>
                                <strong>Borrar también las tarjetas</strong>
                                <small>Elimina historiales, avisos y archivos médicos asociados. Esta acción no se puede deshacer.</small>
                            </span>
                        </label>
                    </fieldset>
                    <div class="custom-module-delete-empty hidden" data-module-delete-empty>
                        <i class="ph ph-info"></i>
                        <span><strong>Este módulo no contiene tarjetas.</strong><small>Solo se eliminará su configuración.</small></span>
                    </div>
                    <div id="custom-module-delete-error" class="custom-tracker-form-error hidden" role="alert"></div>
                    <div class="custom-tracker-dialog-actions">
                        <button type="button" class="btn btn-secondary" data-module-delete-action="close">Cancelar</button>
                        <button type="submit" class="btn btn-danger" data-module-delete-submit>
                            <i class="ph ph-trash"></i> Revisar eliminación
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(dialog);
        this.moduleDeleteDialog = dialog;

        dialog.addEventListener('click', event => {
            if (
                !this.moduleDeletionBusy
                && (
                    event.target === dialog
                    || event.target.closest('[data-module-delete-action="close"]')
                )
            ) {
                this.closeModuleDeletionDialog();
            }
        });
        dialog.addEventListener('change', event => {
            if (event.target.matches('input[name="custom-module-card-resolution"]')) {
                this.updateModuleDeletionResolution();
            } else if (event.target.id === 'custom-module-delete-section') {
                this.updateModuleDeletionSubsections();
            }
        });
        dialog.querySelector('#custom-module-delete-form').addEventListener('submit', event => {
            event.preventDefault();
            void this.submitModuleDeletion();
        });
        dialog.addEventListener('keydown', event => {
            if (this.moduleDeleteDialog.classList.contains('hidden')) return;
            if (event.key === 'Escape' && !this.moduleDeletionBusy) {
                event.preventDefault();
                this.closeModuleDeletionDialog();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(dialog.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled])'
            ));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    openModuleDeletionDialog(moduleId, trigger = null) {
        const module = this.getCustomModule(moduleId);
        if (!module?.archived || !this.moduleDeleteDialog) return false;

        const plan = getCustomModuleDeletionPlan(this.registry, moduleId);
        this.deletingModuleId = moduleId;
        this.moduleDeletionPlan = plan;
        this.lastModuleDeleteTrigger = trigger instanceof HTMLElement ? trigger : null;
        this.moduleDeletionBusy = false;

        this.moduleDeleteDialog.querySelector('#custom-module-delete-title').textContent = `Eliminar ${module.name}`;
        this.moduleDeleteDialog.querySelector('[data-module-delete-name]').textContent = module.name;
        this.moduleDeleteDialog.querySelector('[data-module-delete-counts]').textContent = plan.counts.total === 0
            ? 'Sin tarjetas asociadas'
            : `${plan.counts.total} ${plan.counts.total === 1 ? 'tarjeta' : 'tarjetas'} · ${plan.counts.active} ${plan.counts.active === 1 ? 'activa' : 'activas'} · ${plan.counts.archived} ${plan.counts.archived === 1 ? 'archivada' : 'archivadas'}`;
        const icon = this.moduleDeleteDialog.querySelector('[data-module-delete-icon]');
        icon?.style.setProperty(
            '--custom-module-color',
            CUSTOM_MODULE_COLORS[module.color] || CUSTOM_MODULE_COLORS.blue
        );
        const iconElement = icon?.querySelector('i');
        if (iconElement) iconElement.className = `ph ${module.icon}`;

        const resolutions = this.moduleDeleteDialog.querySelector('[data-module-delete-resolutions]');
        const emptyState = this.moduleDeleteDialog.querySelector('[data-module-delete-empty]');
        resolutions.classList.toggle('hidden', !plan.requiresCardResolution);
        emptyState.classList.toggle('hidden', plan.requiresCardResolution);
        this.moduleDeleteDialog.querySelector('[data-module-delete-legend]').textContent = `¿Qué querés hacer con ${plan.counts.total} ${plan.counts.total === 1 ? 'tarjeta' : 'tarjetas'}?`;

        const moveRadio = this.moduleDeleteDialog.querySelector(
            `input[name="custom-module-card-resolution"][value="${CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE}"]`
        );
        const deleteRadio = this.moduleDeleteDialog.querySelector(
            `input[name="custom-module-card-resolution"][value="${CUSTOM_MODULE_CARD_RESOLUTIONS.DELETE}"]`
        );
        if (moveRadio) moveRadio.checked = true;
        if (deleteRadio) deleteRadio.checked = false;

        const sectionSelect = this.moduleDeleteDialog.querySelector('#custom-module-delete-section');
        sectionSelect.innerHTML = plan.destinationSections
            .map(destination => `
                <option value="${escapeHtml(destination.section)}">
                    ${escapeHtml(destination.label)}${destination.customModule ? ' · Personalizado' : ''}
                </option>
            `)
            .join('');
        this.moduleDeleteDialog.querySelector('#custom-module-delete-error').classList.add('hidden');
        this.setModuleDeletionBusy(false);
        this.updateModuleDeletionSubsections();
        this.updateModuleDeletionResolution();

        this.moduleDeleteDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            const initialFocus = plan.requiresCardResolution
                ? moveRadio
                : this.moduleDeleteDialog.querySelector('[data-module-delete-submit]');
            initialFocus?.focus();
        });
        return true;
    }

    closeModuleDeletionDialog({ restoreFocus = true } = {}) {
        if (!this.moduleDeleteDialog || this.moduleDeleteDialog.classList.contains('hidden')) return;
        this.moduleDeleteDialog.classList.add('hidden');
        document.body.classList.remove('modal-open');
        this.deletingModuleId = null;
        this.moduleDeletionPlan = null;
        this.moduleDeletionBusy = false;
        const trigger = this.lastModuleDeleteTrigger;
        this.lastModuleDeleteTrigger = null;
        if (restoreFocus) requestAnimationFrame(() => trigger?.focus?.());
    }

    setModuleDeletionBusy(busy) {
        if (!this.moduleDeleteDialog) return;
        this.moduleDeletionBusy = busy === true;
        this.moduleDeleteDialog.querySelectorAll('button, input, select').forEach(control => {
            control.disabled = this.moduleDeletionBusy;
        });
        if (!this.moduleDeletionBusy) this.updateModuleDeletionResolution();
        const submitButton = this.moduleDeleteDialog.querySelector('[data-module-delete-submit]');
        if (submitButton) {
            submitButton.innerHTML = this.moduleDeletionBusy
                ? '<i class="ph ph-spinner-gap ph-spin"></i> Eliminando…'
                : '<i class="ph ph-trash"></i> Revisar eliminación';
        }
    }

    updateModuleDeletionResolution() {
        if (!this.moduleDeleteDialog || !this.moduleDeletionPlan) return;
        const selected = this.moduleDeleteDialog.querySelector(
            'input[name="custom-module-card-resolution"]:checked'
        )?.value;
        const moving = selected === CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE;
        const destination = this.moduleDeleteDialog.querySelector('[data-module-delete-destination]');
        destination?.classList.toggle('hidden', !moving);
        destination?.querySelectorAll('select').forEach(select => {
            select.disabled = this.moduleDeletionBusy || !moving;
        });
    }

    updateModuleDeletionSubsections() {
        if (!this.moduleDeleteDialog || !this.moduleDeletionPlan) return;
        const sectionSelect = this.moduleDeleteDialog.querySelector('#custom-module-delete-section');
        const subsectionSelect = this.moduleDeleteDialog.querySelector('#custom-module-delete-subsection');
        const subsectionGroup = this.moduleDeleteDialog.querySelector('[data-module-delete-subsection-group]');
        const destination = this.moduleDeletionPlan.destinationSections.find(
            item => item.section === sectionSelect.value
        );
        const subsections = destination?.subsections || [];
        subsectionSelect.innerHTML = subsections
            .map(item => `<option value="${escapeHtml(item.subsection)}">${escapeHtml(item.label)}</option>`)
            .join('');
        if (destination?.defaultSubsection) {
            subsectionSelect.value = destination.defaultSubsection;
        }
        subsectionGroup?.classList.toggle('hidden', subsections.length <= 1);
    }

    async submitModuleDeletion() {
        if (
            this.moduleDeletionBusy
            || !this.deletingModuleId
            || !this.moduleDeletionPlan
        ) {
            return false;
        }

        const plan = getCustomModuleDeletionPlan(this.registry, this.deletingModuleId);
        const error = this.moduleDeleteDialog.querySelector('#custom-module-delete-error');
        error.classList.add('hidden');
        const selectedResolution = plan.requiresCardResolution
            ? this.moduleDeleteDialog.querySelector(
                'input[name="custom-module-card-resolution"]:checked'
            )?.value
            : null;
        const sectionSelect = this.moduleDeleteDialog.querySelector('#custom-module-delete-section');
        const subsectionSelect = this.moduleDeleteDialog.querySelector('#custom-module-delete-subsection');
        const destination = plan.destinationSections.find(
            item => item.section === sectionSelect.value
        );

        if (
            plan.requiresCardResolution
            && selectedResolution === CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE
            && !destination
        ) {
            error.textContent = 'Elegí un módulo válido para mover las tarjetas.';
            error.classList.remove('hidden');
            return false;
        }

        const deletingCards = selectedResolution === CUSTOM_MODULE_CARD_RESOLUTIONS.DELETE;
        const confirmation = deletingCards
            ? {
                title: `Eliminar ${plan.module.name} y sus tarjetas`,
                message: 'Las tarjetas, sus historiales, avisos y archivos médicos asociados se eliminarán permanentemente. Esta acción no se puede deshacer.',
                details: [
                    { label: 'Módulo', value: plan.module.name },
                    { label: 'Tarjetas', value: String(plan.counts.total) },
                    ...(plan.counts.medicalStudies > 0
                        ? [{ label: 'Estudios médicos', value: String(plan.counts.medicalStudies) }]
                        : []),
                    ...(plan.counts.legacyBacked > 0
                        ? [{ label: 'Datos heredados', value: String(plan.counts.legacyBacked) }]
                        : [])
                ],
                confirmLabel: 'Eliminar todo definitivamente',
                cancelLabel: 'Conservar módulo',
                tone: 'danger',
                closeOnBackdrop: false
            }
            : {
                title: plan.requiresCardResolution
                    ? `Eliminar ${plan.module.name} y mover sus tarjetas`
                    : `Eliminar ${plan.module.name}`,
                message: plan.requiresCardResolution
                    ? 'El módulo se eliminará, pero todas sus tarjetas, historiales, estudios y avisos se conservarán en el destino elegido.'
                    : 'El módulo archivado se eliminará definitivamente. No contiene tarjetas ni historiales asociados.',
                details: [
                    { label: 'Módulo', value: plan.module.name },
                    ...(plan.requiresCardResolution
                        ? [
                            { label: 'Tarjetas', value: String(plan.counts.total) },
                            { label: 'Destino', value: destination?.label || '' }
                        ]
                        : [])
                ],
                confirmLabel: 'Eliminar módulo',
                cancelLabel: 'Cancelar',
                tone: plan.requiresCardResolution ? 'warning' : 'danger',
                closeOnBackdrop: false
            };
        const confirmed = await this.app.confirmAction(confirmation);
        if (!confirmed) return false;

        this.setModuleDeletionBusy(true);
        try {
            await this.executeCustomModuleDeletion(this.deletingModuleId, {
                cardResolution: selectedResolution,
                targetSection: selectedResolution === CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE
                    ? sectionSelect.value
                    : null,
                targetSubsection: selectedResolution === CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE
                    ? subsectionSelect.value
                    : null
            });
            this.closeModuleDeletionDialog({ restoreFocus: false });
            requestAnimationFrame(() => this.newModuleButton?.focus?.());
            return true;
        } catch (deletionError) {
            console.error('No se pudo eliminar el módulo personalizado:', deletionError);
            error.textContent = deletionError.message
                || 'No se pudo eliminar el módulo. Tus datos se conservaron para que puedas reintentar.';
            error.classList.remove('hidden');
            this.setModuleDeletionBusy(false);
            return false;
        }
    }

    removeAlertConfigsForTrackers(trackers) {
        if (!this.app.alerts || !Array.isArray(trackers) || trackers.length === 0) return;
        trackers.forEach(tracker => {
            delete this.app.alerts.configs[getCustomAlertKey(tracker)];
        });
        this.app.alerts.saveData();
        const alertsTab = document.getElementById('tab-alertas');
        if (alertsTab && !alertsTab.classList.contains('hidden')) {
            this.app.alerts.render();
        }
    }

    async executeCustomModuleDeletion(moduleId, {
        cardResolution = null,
        targetSection = null,
        targetSubsection = null
    } = {}) {
        const previousRegistry = this.registry;
        const plan = getCustomModuleDeletionPlan(previousRegistry, moduleId);
        const deletion = deleteCustomModulePermanently(previousRegistry, moduleId, {
            cardResolution,
            targetSection,
            targetSubsection
        });
        let studyCleanup = { deletedEntries: 0, deletedFiles: 0 };

        if (cardResolution === CUSTOM_MODULE_CARD_RESOLUTIONS.DELETE) {
            const medicalTrackerIds = plan.trackers
                .filter(isMedicalStudyTracker)
                .map(tracker => tracker.id);
            if (medicalTrackerIds.length > 0) {
                if (!this.app.health?.deleteStudyEntriesForTrackers) {
                    throw new Error(
                        'No se pudo acceder al administrador de estudios médicos. No se eliminó ningún dato.'
                    );
                }
                studyCleanup = await this.app.health.deleteStudyEntriesForTrackers(
                    medicalTrackerIds
                );
            }

            plan.trackers.forEach(tracker => this.clearLegacyTracker(tracker));
            this.removeAlertConfigsForTrackers(plan.trackers);
        }

        plan.trackerIds.forEach(trackerId => {
            this.pendingDeleteIds.delete(trackerId);
            this.clearPendingHistoryDeletes(trackerId);
        });
        if (plan.trackerIds.includes(this.historyDialogTrackerId)) {
            this.closeHistoryDialog({ restoreFocus: false });
        }
        if (plan.trackerIds.includes(this.instructionsDialogTrackerId)) {
            this.closeInstructionsDialog({ restoreFocus: false });
        }

        this.registry = deletion.registry;
        try {
            this.persistRegistry();
        } catch (error) {
            this.registry = previousRegistry;
            throw error;
        }

        if (cardResolution === CUSTOM_MODULE_CARD_RESOLUTIONS.MOVE) {
            const destination = getCustomTrackerSections(this.registry.customModules)[targetSection];
            this.showCustomModulesFeedback(
                `${plan.module.name} fue eliminado y sus ${plan.counts.total} ${plan.counts.total === 1 ? 'tarjeta fue movida' : 'tarjetas fueron movidas'} a ${destination?.label || 'su nuevo destino'}.`
            );
        } else {
            const studySummary = studyCleanup.deletedEntries > 0
                ? ` También se eliminaron ${studyCleanup.deletedEntries} ${studyCleanup.deletedEntries === 1 ? 'estudio' : 'estudios'}${studyCleanup.deletedFiles > 0 ? ` y ${studyCleanup.deletedFiles} ${studyCleanup.deletedFiles === 1 ? 'archivo' : 'archivos'}` : ''}.`
                : '';
            this.showCustomModulesFeedback(
                plan.counts.total > 0
                    ? `${plan.module.name} y sus ${plan.counts.total} ${plan.counts.total === 1 ? 'tarjeta fueron eliminados' : 'tarjetas fueron eliminados'} definitivamente.${studySummary}`
                    : `${plan.module.name} fue eliminado definitivamente.`
            );
        }

        return {
            ...deletion,
            studyCleanup
        };
    }

    ensureEditorDialog() {
        document.getElementById('custom-tracker-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'custom-tracker-dialog';
        dialog.className = 'custom-tracker-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'custom-tracker-dialog-title');
        dialog.innerHTML = `
            <div class="custom-tracker-dialog-card">
                <div class="custom-tracker-dialog-header">
                    <div>
                        <span class="custom-trackers-eyebrow">Tarjeta configurable</span>
                        <h2 id="custom-tracker-dialog-title">Nueva tarjeta</h2>
                        <p id="custom-tracker-dialog-section">Elegí dónde aparecerá la tarjeta.</p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-dialog-action="close" aria-label="Cerrar editor de tarjeta" data-tooltip="Cerrar">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <form id="custom-tracker-form" novalidate>
                    <div class="custom-tracker-form-grid">
                        <div class="input-group">
                            <label for="custom-tracker-section">Sección de destino</label>
                            <select id="custom-tracker-section" class="text-input"></select>
                        </div>
                        <div class="input-group">
                            <label for="custom-tracker-subsection">Ubicación dentro de la sección</label>
                            <select id="custom-tracker-subsection" class="text-input"></select>
                        </div>
                        <div class="input-group custom-form-wide">
                            <label for="custom-tracker-template">Tipo de seguimiento</label>
                            <select id="custom-tracker-template" class="text-input"></select>
                            <small id="custom-tracker-template-help"></small>
                        </div>
                        <div class="input-group custom-form-wide">
                            <label for="custom-tracker-name">Nombre</label>
                            <input id="custom-tracker-name" class="text-input" type="text" maxlength="80" autocomplete="off" placeholder="Ej: Limpiar los sillones" required>
                        </div>
                        <div class="input-group">
                            <label for="custom-tracker-action">Acción principal</label>
                            <select id="custom-tracker-action" class="text-input"></select>
                        </div>
                        <div class="input-group custom-action-other-group hidden">
                            <label for="custom-tracker-action-other">Texto de la acción</label>
                            <input id="custom-tracker-action-other" class="text-input" type="text" maxlength="60" autocomplete="off" placeholder="Ej: Aspiré los sillones">
                        </div>
                        <div class="input-group custom-cadence-field">
                            <label id="custom-tracker-interval-label" for="custom-tracker-interval">Marcar como vencida después de</label>
                            <div class="custom-number-with-unit">
                                <input id="custom-tracker-interval" class="number-input" type="number" min="1" max="3650" inputmode="numeric" required>
                                <span id="custom-tracker-interval-unit">días</span>
                            </div>
                            <small>La cuenta solo vuelve a empezar cuando registrás la acción.</small>
                        </div>
                        <div class="input-group">
                            <label for="custom-tracker-icon">Icono</label>
                            <select id="custom-tracker-icon" class="text-input"></select>
                        </div>
                        <div class="input-group custom-day-thresholds">
                            <label for="custom-tracker-yellow">Mostrar próximo desde</label>
                            <div class="custom-number-with-unit">
                                <input id="custom-tracker-yellow" class="number-input" type="number" min="1" max="3650" inputmode="numeric">
                                <span>días transcurridos</span>
                            </div>
                        </div>
                        <div class="input-group custom-day-thresholds">
                            <label for="custom-tracker-orange">Mostrar atención desde</label>
                            <div class="custom-number-with-unit">
                                <input id="custom-tracker-orange" class="number-input" type="number" min="1" max="3650" inputmode="numeric">
                                <span>días transcurridos</span>
                            </div>
                        </div>
                        <div class="input-group custom-month-warning hidden">
                            <label for="custom-tracker-warning-days">Avisar con anticipación</label>
                            <div class="custom-number-with-unit">
                                <input id="custom-tracker-warning-days" class="number-input" type="number" min="1" max="365" inputmode="numeric">
                                <span>días</span>
                            </div>
                        </div>
                        <div class="custom-state-reminder-fields custom-form-wide hidden">
                            <div class="input-group">
                                <label for="custom-tracker-start-action">Acción para iniciar los avisos</label>
                                <input id="custom-tracker-start-action" class="text-input" type="text" maxlength="60" autocomplete="off" value="Marcar como pendiente">
                            </div>
                            <div class="input-group">
                                <label for="custom-tracker-repeat-hours">Repetir el aviso cada</label>
                                <div class="custom-number-with-unit">
                                    <input id="custom-tracker-repeat-hours" class="number-input" type="number" min="1" max="48" inputmode="numeric" value="6">
                                    <span>horas</span>
                                </div>
                            </div>
                        </div>
                        <div class="custom-threshold-help custom-form-wide" aria-label="Cómo funcionan los estados de una tarjeta">
                            <span>
                                <i class="ph ph-clock-countdown" aria-hidden="true"></i>
                                <span><strong>Próximo</strong><small>Es el primer aviso y usa el valor menor.</small></span>
                            </span>
                            <span>
                                <i class="ph ph-warning-circle" aria-hidden="true"></i>
                                <span><strong>Atención</strong><small>Es el segundo aviso y usa el valor mayor.</small></span>
                            </span>
                            <span>
                                <i class="ph ph-x-circle" aria-hidden="true"></i>
                                <span><strong>Vencido</strong><small>Coincide con el plazo total definido.</small></span>
                            </span>
                        </div>
                        <div class="input-group custom-form-wide">
                            <label for="custom-tracker-instructions">Instrucciones opcionales</label>
                            <textarea id="custom-tracker-instructions" class="text-input custom-tracker-textarea" maxlength="2000" placeholder="Materiales, pasos o cualquier detalle que quieras consultar al realizarlo."></textarea>
                            <small>Se consultan desde el menú de los tres puntos de la tarjeta.</small>
                        </div>
                    </div>
                    <div class="custom-tracker-alert-block">
                        <label class="custom-tracker-alert-toggle" for="custom-tracker-alert-enabled">
                            <input id="custom-tracker-alert-enabled" type="checkbox">
                            <span class="custom-alert-icon"><i class="ph ph-bell"></i></span>
                            <span class="custom-alert-copy">
                                <strong>Notificación push</strong>
                                <small>Avisarme una vez al día mientras la tarjeta esté vencida.</small>
                            </span>
                            <span class="custom-alert-switch" aria-hidden="true">
                                <span></span>
                            </span>
                        </label>
                        <div class="input-group custom-tracker-alert-time-wrap hidden">
                            <label for="custom-tracker-alert-time">Hora del aviso diario</label>
                            <input id="custom-tracker-alert-time" class="time-input" type="time" value="23:00">
                        </div>
                    </div>
                    <div id="custom-tracker-form-error" class="custom-tracker-form-error hidden" role="alert"></div>
                    <div class="custom-tracker-dialog-actions">
                        <button type="button" class="btn btn-secondary" data-dialog-action="close">Cancelar</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="ph ph-floppy-disk"></i>
                            Guardar tarjeta
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(dialog);
        this.dialog = dialog;

        const sectionSelect = dialog.querySelector('#custom-tracker-section');
        this.populateSectionOptions();

        const templateSelect = dialog.querySelector('#custom-tracker-template');
        templateSelect.innerHTML = Object.entries(CUSTOM_TRACKER_TEMPLATES)
            .map(([key, template]) => (
                `<option value="${key}">${escapeHtml(template.label)}</option>`
            ))
            .join('');

        const actionSelect = dialog.querySelector('#custom-tracker-action');
        actionSelect.innerHTML = [
            ...ACTION_PRESETS.map(action => (
                `<option value="${escapeHtml(action)}">${escapeHtml(action)}</option>`
            )),
            '<option value="__custom__">Texto personalizado…</option>'
        ].join('');

        const iconSelect = dialog.querySelector('#custom-tracker-icon');
        iconSelect.innerHTML = CUSTOM_TRACKER_ICONS.map(icon => (
            `<option value="${icon}">${escapeHtml(ICON_LABELS[icon] || icon)}</option>`
        )).join('');
        this.trackerIconPicker = createIconPicker(iconSelect, {
            labels: ICON_LABELS,
            catalogLabel: 'Explorar iconos de la tarjeta'
        });

        dialog.addEventListener('click', event => {
            if (
                event.target === dialog
                || event.target.closest('[data-dialog-action="close"]')
            ) {
                this.closeEditor();
            }
        });
        sectionSelect.addEventListener('change', () => {
            this.populateSubsectionOptions(sectionSelect.value);
            if (!this.editingId) this.applySectionDefaults(sectionSelect.value);
            this.updateEditorDestinationLabel();
        });
        templateSelect.addEventListener('change', () => {
            if (!this.editingId) {
                const isMedical = templateSelect.value === 'medical';
                const isStudy = templateSelect.value === 'medical-study';
                const isStateReminder = templateSelect.value === 'state-reminder';
                dialog.querySelector('#custom-tracker-interval').value = isMedical
                    ? 6
                    : (isStudy ? 360 : (isStateReminder ? 1 : 30));
                dialog.querySelector('#custom-tracker-yellow').value = isStudy ? 270 : 21;
                dialog.querySelector('#custom-tracker-orange').value = isStudy ? 330 : 25;
                dialog.querySelector('#custom-tracker-warning-days').value = 30;
                if (isStudy) {
                    dialog.querySelector('#custom-tracker-action').value = '__custom__';
                    dialog.querySelector('#custom-tracker-action-other').value = 'Agregar estudio';
                    dialog.querySelector('#custom-tracker-icon').value = 'ph-test-tube';
                } else if (isStateReminder) {
                    dialog.querySelector('#custom-tracker-action').value = '__custom__';
                    dialog.querySelector('#custom-tracker-action-other').value = 'Marcar como resuelto';
                    dialog.querySelector('#custom-tracker-start-action').value = 'Marcar como pendiente';
                    dialog.querySelector('#custom-tracker-repeat-hours').value = '6';
                    dialog.querySelector('#custom-tracker-icon').value = 'ph-robot';
                }
            }
            this.updateEditorConditionalFields();
        });
        dialog.querySelector('#custom-tracker-subsection').addEventListener('change', () => {
            this.updateEditorDestinationLabel();
        });
        actionSelect.addEventListener('change', () => {
            this.updateEditorConditionalFields();
        });
        dialog.querySelector('#custom-tracker-alert-enabled').addEventListener('change', () => {
            this.updateEditorConditionalFields();
        });
        dialog.querySelector('#custom-tracker-form').addEventListener('submit', event => {
            event.preventDefault();
            this.saveEditor();
        });
        document.addEventListener('keydown', event => {
            if (this.dialog.classList.contains('hidden')) return;

            if (event.key === 'Escape') {
                this.closeEditor();
                return;
            }

            if (event.key === 'Tab') {
                const focusable = Array.from(this.dialog.querySelectorAll(
                    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
                )).filter(element => !element.closest('.hidden'));
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
    }

    populateSectionOptions(selectedValue = null) {
        const select = this.dialog?.querySelector('#custom-tracker-section');
        if (!select) return;
        const sections = Object.entries(this.getSections())
            .filter(([, section]) => !section.archived);
        select.innerHTML = sections
            .map(([key, section]) => (
                `<option value="${key}">${escapeHtml(section.label)}</option>`
            ))
            .join('');
        select.value = sections.some(([key]) => key === selectedValue)
            ? selectedValue
            : (sections[0]?.[0] || 'hygiene');
    }

    populateSubsectionOptions(sectionKey, selectedValue = null) {
        const section = this.getSections()[sectionKey];
        const select = this.dialog.querySelector('#custom-tracker-subsection');
        if (!section || !select) return;

        select.innerHTML = Object.entries(section.subsections)
            .map(([key, subsection]) => (
                `<option value="${key}">${escapeHtml(subsection.label)}</option>`
            ))
            .join('');
        select.value = section.subsections[selectedValue]
            ? selectedValue
            : section.defaultSubsection;
    }

    applySectionDefaults(sectionKey) {
        const section = this.getSections()[sectionKey];
        if (!section) return;
        const templateSelect = this.dialog.querySelector('#custom-tracker-template');
        templateSelect.value = section.defaultTemplate;
        this.dialog.querySelector('#custom-tracker-action').value = (
            ACTION_PRESETS.includes(section.defaultAction)
                ? section.defaultAction
                : '__custom__'
        );
        this.dialog.querySelector('#custom-tracker-icon').value = section.defaultIcon;
        const isMedical = section.defaultTemplate === 'medical';
        this.dialog.querySelector('#custom-tracker-interval').value = isMedical ? 6 : 30;
        this.dialog.querySelector('#custom-tracker-yellow').value = 21;
        this.dialog.querySelector('#custom-tracker-orange').value = 25;
        this.dialog.querySelector('#custom-tracker-warning-days').value = 30;
        this.updateEditorConditionalFields();
    }

    updateEditorDestinationLabel() {
        const sectionKey = this.dialog.querySelector('#custom-tracker-section').value;
        const subsectionKey = this.dialog.querySelector('#custom-tracker-subsection').value;
        const section = this.getSections()[sectionKey];
        const subsection = section?.subsections?.[subsectionKey];
        this.dialog.querySelector('#custom-tracker-dialog-section').textContent = (
            section && subsection
                ? `${section.label} · ${subsection.label}`
                : 'Elegí dónde aparecerá la tarjeta.'
        );
    }

    updateEditorConditionalFields() {
        const actionSelect = this.dialog.querySelector('#custom-tracker-action');
        const customActionGroup = this.dialog.querySelector('.custom-action-other-group');
        const customActionInput = this.dialog.querySelector('#custom-tracker-action-other');
        const isCustomAction = actionSelect.value === '__custom__';
        customActionGroup.classList.toggle('hidden', !isCustomAction);
        customActionInput.required = isCustomAction;

        const templateKey = this.dialog.querySelector('#custom-tracker-template').value;
        const template = CUSTOM_TRACKER_TEMPLATES[templateKey]
            || CUSTOM_TRACKER_TEMPLATES.routine;
        const isMedical = template.cadenceUnit === 'months';
        const isStateReminder = templateKey === 'state-reminder';
        const alertEnabled = this.dialog.querySelector('#custom-tracker-alert-enabled').checked;
        this.dialog.querySelector('.custom-tracker-alert-time-wrap')
            .classList.toggle('hidden', !alertEnabled || isStateReminder);
        const intervalInput = this.dialog.querySelector('#custom-tracker-interval');
        const yellowInput = this.dialog.querySelector('#custom-tracker-yellow');
        const orangeInput = this.dialog.querySelector('#custom-tracker-orange');
        const warningInput = this.dialog.querySelector('#custom-tracker-warning-days');
        this.dialog.querySelector('#custom-tracker-interval-label').textContent = (
            isMedical ? 'Repetir el control cada' : 'Marcar como vencida después de'
        );
        this.dialog.querySelector('#custom-tracker-interval-unit').textContent = (
            isMedical ? 'meses' : 'días'
        );
        intervalInput.max = isMedical ? '120' : '3650';
        this.dialog.querySelectorAll('.custom-day-thresholds').forEach(element => {
            element.classList.toggle('hidden', isMedical || isStateReminder);
        });
        this.dialog.querySelector('.custom-month-warning')
            .classList.toggle('hidden', !isMedical || isStateReminder);
        this.dialog.querySelector('.custom-cadence-field')
            .classList.toggle('hidden', isStateReminder);
        this.dialog.querySelector('.custom-threshold-help')
            .classList.toggle('hidden', isStateReminder);
        this.dialog.querySelector('.custom-state-reminder-fields')
            .classList.toggle('hidden', !isStateReminder);
        this.dialog.querySelector('#custom-tracker-start-action').required = isStateReminder;
        this.dialog.querySelector('#custom-tracker-repeat-hours').required = isStateReminder;
        yellowInput.required = !isMedical && !isStateReminder;
        orangeInput.required = !isMedical && !isStateReminder;
        warningInput.required = isMedical && !isStateReminder;
        const alertHelp = this.dialog.querySelector('.custom-alert-copy small');
        if (alertHelp) {
            alertHelp.textContent = isStateReminder
                ? 'Repetir el aviso mientras la tarjeta siga pendiente.'
                : 'Avisarme una vez al día mientras la tarjeta esté vencida.';
        }
        this.dialog.querySelector('#custom-tracker-template-help').textContent = (
            template.description
        );
        this.trackerIconPicker?.refresh();
    }

    openEditor(sectionKey = 'hygiene', trackerId = null, trigger = null) {
        const tracker = trackerId ? this.getTracker(trackerId) : null;
        if (trackerId && (!tracker || tracker.deleted)) return;
        if (!tracker && !this.ensureCreationCapacity(RESOURCE_KEYS.TRACKER_CARDS)) {
            return false;
        }

        const sections = this.getSections();
        const selectedSectionKey = tracker?.section || (
            sections[sectionKey] && !sections[sectionKey].archived ? sectionKey : 'hygiene'
        );
        const section = sections[selectedSectionKey];

        this.editingId = tracker?.id || null;
        this.lastDialogTrigger = trigger instanceof HTMLElement ? trigger : null;
        this.dialog.querySelector('#custom-tracker-dialog-title').textContent = tracker
            ? 'Editar tarjeta'
            : 'Nueva tarjeta';
        this.populateSectionOptions(selectedSectionKey);
        this.dialog.querySelector('#custom-tracker-section').value = selectedSectionKey;
        this.populateSubsectionOptions(selectedSectionKey, tracker?.subsection);
        const templateSelect = this.dialog.querySelector('#custom-tracker-template');
        templateSelect.value = tracker?.template || section.defaultTemplate;
        templateSelect.disabled = this.isTrackerTemplateLocked(tracker);
        this.dialog.querySelector('#custom-tracker-name').value = tracker?.name || '';
        this.dialog.querySelector('#custom-tracker-interval').value = (
            tracker?.cadence?.value
            || (section.defaultTemplate === 'medical' ? 6 : 30)
        );
        this.dialog.querySelector('#custom-tracker-yellow').value = (
            tracker?.thresholds?.yellow
            || Math.max(1, Math.floor((tracker?.intervalDays || 30) * 0.7))
        );
        this.dialog.querySelector('#custom-tracker-orange').value = (
            tracker?.thresholds?.orange
            || Math.max(1, Math.floor((tracker?.intervalDays || 30) * 0.85))
        );
        this.dialog.querySelector('#custom-tracker-warning-days').value = (
            tracker?.thresholds?.warningDays || 30
        );
        this.dialog.querySelector('#custom-tracker-start-action').value = (
            tracker?.behavior?.startActionLabel || 'Marcar como pendiente'
        );
        this.dialog.querySelector('#custom-tracker-repeat-hours').value = (
            tracker?.behavior?.intervalHours || 6
        );
        this.dialog.querySelector('#custom-tracker-icon').value = tracker?.icon || section.defaultIcon;
        this.dialog.querySelector('#custom-tracker-instructions').value = (
            tracker?.instructions || ''
        );

        const actionSelect = this.dialog.querySelector('#custom-tracker-action');
        const hasPreset = tracker && ACTION_PRESETS.includes(tracker.actionLabel);
        actionSelect.value = tracker
            ? (hasPreset ? tracker.actionLabel : '__custom__')
            : section.defaultAction;
        this.dialog.querySelector('#custom-tracker-action-other').value = (
            tracker && !hasPreset ? tracker.actionLabel : ''
        );

        const alertConfig = tracker
            ? this.getEffectiveAlertConfig(tracker)
            : { enabled: false, time: '23:00' };
        this.dialog.querySelector('#custom-tracker-alert-enabled').checked = (
            alertConfig.enabled === true
        );
        this.dialog.querySelector('#custom-tracker-alert-time').value = (
            alertConfig.time || '23:00'
        );
        const errorElement = this.dialog.querySelector('#custom-tracker-form-error');
        errorElement.classList.add('hidden');
        errorElement.textContent = '';
        this.updateEditorDestinationLabel();
        this.updateEditorConditionalFields();
        if (templateSelect.disabled) {
            this.dialog.querySelector('#custom-tracker-template-help').textContent = (
                'El tipo se conserva porque la tarjeta ya tiene actividad asociada. Podés editar el resto de la configuración.'
            );
        }

        this.dialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        const dialogCard = this.dialog.querySelector('.custom-tracker-dialog-card');
        if (dialogCard) dialogCard.scrollTop = 0;
        setTimeout(() => {
            const nameInput = this.dialog.querySelector('#custom-tracker-name');
            nameInput?.focus({ preventScroll: true });
            if (dialogCard) dialogCard.scrollTop = 0;
        }, 0);
    }

    closeEditor() {
        if (!this.dialog || this.dialog.classList.contains('hidden')) return;
        this.dialog.classList.add('hidden');
        document.body.classList.remove('modal-open');
        this.editingId = null;
        const templateSelect = this.dialog.querySelector('#custom-tracker-template');
        if (templateSelect) templateSelect.disabled = false;
        this.lastDialogTrigger?.focus?.();
        this.lastDialogTrigger = null;
    }

    saveEditor() {
        const errorElement = this.dialog.querySelector('#custom-tracker-form-error');
        if (
            !this.editingId
            && !this.ensureCreationCapacity(RESOURCE_KEYS.TRACKER_CARDS, {
                errorElement
            })
        ) {
            return false;
        }
        const section = this.dialog.querySelector('#custom-tracker-section').value;
        const subsection = this.dialog.querySelector('#custom-tracker-subsection').value;
        const actionChoice = this.dialog.querySelector('#custom-tracker-action').value;
        const actionLabel = actionChoice === '__custom__'
            ? this.dialog.querySelector('#custom-tracker-action-other').value
            : actionChoice;
        const alertEnabled = this.dialog.querySelector('#custom-tracker-alert-enabled').checked;
        const alertTime = this.dialog.querySelector('#custom-tracker-alert-time').value || '23:00';
        const existing = this.editingId ? this.getTracker(this.editingId) : null;
        const template = this.isTrackerTemplateLocked(existing)
            ? existing.template
            : this.dialog.querySelector('#custom-tracker-template').value;
        const cadenceUnit = CUSTOM_TRACKER_TEMPLATES[template]?.cadenceUnit || 'days';
        const cadenceValue = Number(
            this.dialog.querySelector('#custom-tracker-interval').value
        );
        const isStateReminder = template === 'state-reminder';

        try {
            let thresholdsReordered = false;
            const thresholds = isStateReminder
                ? { yellow: 1, orange: 1, red: 1 }
                : cadenceUnit === 'months'
                ? {
                    warningDays: Number(
                        this.dialog.querySelector('#custom-tracker-warning-days').value
                    )
                }
                : (() => {
                    const normalized = normalizeCustomTrackerDayThresholds({
                        yellow: Number(
                            this.dialog.querySelector('#custom-tracker-yellow').value
                        ),
                        orange: Number(
                            this.dialog.querySelector('#custom-tracker-orange').value
                        ),
                        red: cadenceValue
                    }, { strict: true });
                    thresholdsReordered = normalized.reordered;
                    return normalized.thresholds;
                })();
            const destinationChanged = existing && (
                existing.section !== section || existing.subsection !== subsection
            );
            const order = !existing || destinationChanged
                ? Math.max(
                    -1,
                    ...this.registry.trackers
                        .filter(tracker => (
                            !tracker.archived
                            && !tracker.deleted
                            && tracker.section === section
                            && tracker.subsection === subsection
                        ))
                        .map(tracker => tracker.order)
                ) + 1
                : existing.order;
            const candidate = createCustomTracker({
                section,
                subsection,
                template,
                name: this.dialog.querySelector('#custom-tracker-name').value,
                actionLabel,
                cadence: {
                    unit: cadenceUnit,
                    value: cadenceValue
                },
                intervalDays: cadenceUnit === 'days'
                    ? cadenceValue
                    : Math.max(1, Math.round(cadenceValue * 30.5)),
                thresholds,
                icon: this.dialog.querySelector('#custom-tracker-icon').value,
                instructions: this.dialog.querySelector('#custom-tracker-instructions').value,
                behavior: isStateReminder
                    ? {
                        startActionLabel: this.dialog.querySelector('#custom-tracker-start-action').value,
                        intervalHours: Number(
                            this.dialog.querySelector('#custom-tracker-repeat-hours').value
                        )
                    }
                    : (existing?.behavior || {}),
                state: isStateReminder
                    ? (existing?.state || { active: false, activatedAt: null })
                    : null,
                legacySource: existing?.legacySource || null,
                group: existing?.group || null,
                alertKey: existing?.alertKey,
                alert: {
                    enabled: alertEnabled,
                    time: alertTime
                }
            }, {
                id: existing?.id || this.generateTrackerId(),
                now: new Date(),
                order,
                customModules: this.registry.customModules
            });

            if (existing) {
                const index = this.registry.trackers.findIndex(item => item.id === existing.id);
                this.registry.trackers[index] = {
                    ...candidate,
                    archived: existing.archived,
                    createdAt: existing.createdAt,
                    updatedAt: new Date().toISOString()
                };
            } else {
                this.registry.trackers.push(candidate);
                this.registry.histories[candidate.id] = [];
            }

            this.mirrorLegacyTracker(candidate);
            this.syncAlertConfig(candidate, candidate.alert);
            this.persistRegistry();
            this.closeEditor();
            this.showManagerFeedback(
                thresholdsReordered
                    ? `${existing ? 'Tarjeta actualizada' : 'Tarjeta creada y sincronizada'}. Ordené los avisos para que Próximo ocurra antes que Atención.`
                    : (existing ? 'Tarjeta actualizada.' : 'Tarjeta creada y sincronizada.')
            );
        } catch (error) {
            errorElement.textContent = error.message || 'No se pudo guardar la tarjeta.';
            errorElement.classList.remove('hidden');
        }
    }

    syncAlertConfig(trackerOrId, alertConfig, { remove = false, disabled = false } = {}) {
        if (!this.app.alerts) return;

        const key = getCustomAlertKey(trackerOrId);
        if (remove) {
            delete this.app.alerts.configs[key];
        } else {
            const nextConfig = {
                enabled: disabled ? false : alertConfig.enabled === true,
                time: alertConfig.time || '23:00',
                days: []
            };
            const tracker = typeof trackerOrId === 'object'
                ? trackerOrId
                : this.getTracker(trackerOrId);
            if (isStateReminderTracker(tracker)) {
                nextConfig.interval_hours = Math.min(
                    48,
                    Math.max(
                        1,
                        Number(alertConfig.intervalHours)
                        || Number(tracker.behavior?.intervalHours)
                        || 6
                    )
                );
            }
            this.app.alerts.configs[key] = nextConfig;
        }
        this.app.alerts.saveData();

        const alertsTab = document.getElementById('tab-alertas');
        if (alertsTab && !alertsTab.classList.contains('hidden')) {
            this.app.alerts.render();
        }
    }

    recordTracker(trackerId, whenOrOptions = new Date()) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived || tracker.deleted) return false;
        if (isMedicalStudyTracker(tracker)) {
            const trigger = whenOrOptions?.trigger instanceof HTMLElement
                ? whenOrOptions.trigger
                : null;
            return this.app.health?.openStudyForm?.(trackerId, trigger) === true;
        }
        if (isStateReminderTracker(tracker)) {
            return this.setStateReminderActive(trackerId, tracker.state?.active !== true);
        }
        const when = whenOrOptions instanceof Date || typeof whenOrOptions === 'string'
            ? whenOrOptions
            : new Date();
        return this.recordTrackers([trackerId], when);
    }

    setStateReminderActive(trackerId, active, when = new Date()) {
        let tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived || tracker.deleted || !isStateReminderTracker(tracker)) {
            return false;
        }
        const nextActive = active === true;
        if (tracker.state?.active === nextActive) return true;

        const date = when instanceof Date ? new Date(when) : new Date(when);
        if (Number.isNaN(date.getTime())) return false;
        if (!nextActive) {
            const result = appendCustomTrackerRecords(this.registry, [trackerId], date);
            this.registry = result.registry;
            tracker = this.getTracker(trackerId);
        }
        tracker.state = {
            active: nextActive,
            activatedAt: nextActive ? date.toISOString() : null
        };
        tracker.updatedAt = date.toISOString();

        if (tracker.id === DEFAULT_ROBOT_TRACKER_ID || tracker.alertKey === 'robot') {
            this.app.hygiene.data.robot_cleaner = {
                status: nextActive ? 'dirty' : 'clean',
                marked_dirty_at: nextActive ? date.toISOString() : null,
                last_notified_at: null
            };
        }

        this.persistRegistry();
        if (navigator.vibrate) navigator.vibrate(40);
        this.showRuntimeFeedback(
            nextActive
                ? `${tracker.name}: avisos iniciados.`
                : `${tracker.name}: marcado como resuelto.`
        );
        return true;
    }

    replaceTrackerHistory(trackerId, values, { silent = false } = {}) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.deleted || !Array.isArray(values)) return false;
        const normalized = [...new Set(values.map(value => {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
        }).filter(Boolean))].sort((left, right) => Date.parse(right) - Date.parse(left));
        this.registry.histories[trackerId] = normalized;
        tracker.updatedAt = new Date().toISOString();
        this.persistRegistry();
        if (!silent) this.showRuntimeFeedback(`${tracker.name}: historial actualizado.`);
        return true;
    }

    recordTrackers(trackerIds, when = new Date()) {
        const date = when instanceof Date ? when : new Date(when);
        if (Number.isNaN(date.getTime())) return false;

        const standardTrackerIds = trackerIds.filter(trackerId => {
            const tracker = this.getTracker(trackerId);
            return tracker
                && !isMedicalStudyTracker(tracker)
                && !isStateReminderTracker(tracker);
        });
        const result = appendCustomTrackerRecords(
            this.registry,
            standardTrackerIds,
            date
        );
        if (result.recordedIds.length === 0) return false;

        this.registry = result.registry;
        const trackers = result.recordedIds
            .map(trackerId => this.getTracker(trackerId))
            .filter(Boolean);
        trackers.forEach(tracker => {
            if (
                tracker.behavior?.decrementStock
                && tracker.behavior?.stockKey === 'lensStock'
            ) {
                const stock = Math.max(
                    0,
                    Number.parseInt(localStorage.getItem('lensStock'), 10) || 0
                );
                if (stock > 0) {
                    localStorage.setItem('lensStock', String(stock - 1));
                }
            }
            this.mirrorLegacyTracker(tracker);
        });

        this.persistRegistry();
        if (navigator.vibrate) navigator.vibrate(trackers.length > 1 ? [40, 35, 40] : 40);
        this.showRuntimeFeedback(
            trackers.length === 1
                ? `${trackers[0].name}: registro guardado.`
                : `${trackers.length} tarjetas registradas al mismo tiempo.`
        );
        return true;
    }

    updateLatestDate(trackerId, dateValue) {
        const tracker = this.getTracker(trackerId);
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (
            !tracker
            || tracker.archived
            || tracker.deleted
            || Number.isNaN(date.getTime())
        ) {
            return false;
        }

        const history = this.getHistory(trackerId);
        if (history.length > 0) history[0] = date.toISOString();
        else history.unshift(date.toISOString());
        this.registry.histories[trackerId] = history
            .sort((a, b) => Date.parse(b) - Date.parse(a))
            .slice(0, 1000);
        this.mirrorLegacyTracker(tracker);
        this.persistRegistry();
        this.showRuntimeFeedback(`Fecha de ${tracker.name} actualizada.`);
        return true;
    }

    mirrorLegacyTracker(tracker) {
        const source = tracker?.legacySource;
        if (!source) return;
        const history = this.getHistory(tracker.id);
        const latest = history[0] || null;

        if (source.kind === 'hygiene' && this.app.hygiene) {
            this.app.hygiene.data[source.key] = source.mode === 'single'
                ? latest
                : history.slice(0, 10);
            this.app.hygiene.saveData();
            return;
        }

        if (source.kind === 'grooming' && this.app.grooming) {
            this.app.grooming.data[source.key] = history.slice(0, 10);
            this.app.grooming.saveData();
            return;
        }

        if (source.kind === 'lens') {
            if (latest) {
                localStorage.setItem(source.key, getLocalISODate(new Date(latest)));
            } else {
                localStorage.removeItem(source.key);
            }
            return;
        }

        if (source.kind === 'health' && this.app.health) {
            const existing = this.app.health.medicalData[source.key] || {};
            this.app.health.medicalData[source.key] = {
                ...existing,
                lastVisit: latest ? getLocalISODate(new Date(latest)) : null,
                frequencyMonths: tracker.cadence?.unit === 'months'
                    ? tracker.cadence.value
                    : (existing.frequencyMonths || 6),
                history: history.map(value => getLocalISODate(new Date(value)))
            };
            this.app.health.saveMedicalData();
        }
    }

    clearLegacyTracker(tracker) {
        const source = tracker?.legacySource;
        if (!source) return;

        if (source.kind === 'hygiene' && this.app.hygiene) {
            delete this.app.hygiene.data[source.key];
            this.app.hygiene.saveData();
            return;
        }

        if (source.kind === 'grooming' && this.app.grooming) {
            delete this.app.grooming.data[source.key];
            this.app.grooming.saveData();
            return;
        }

        if (source.kind === 'lens') {
            localStorage.removeItem(source.key);
            return;
        }

        if (source.kind === 'health' && this.app.health) {
            delete this.app.health.medicalData[source.key];
            this.app.health.saveMedicalData();
        }
    }

    archiveTracker(trackerId, { showGlobalUndo = false } = {}) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived || tracker.deleted) return;
        tracker.archived = true;
        tracker.updatedAt = new Date().toISOString();
        tracker.alert = this.getEffectiveAlertConfig(tracker);
        if (this.historyDialogTrackerId === trackerId) {
            this.closeHistoryDialog({ restoreFocus: false });
        }
        if (this.instructionsDialogTrackerId === trackerId) {
            this.closeInstructionsDialog({ restoreFocus: false });
        }
        if (this.registry.featuredBySection[tracker.section] === trackerId) {
            this.registry.featuredBySection[tracker.section] = null;
        }
        this.clearPendingHistoryDeletes(trackerId);
        this.syncAlertConfig(tracker, tracker.alert, { disabled: true });
        this.persistRegistry();
        if (showGlobalUndo && this.app.showUndo) {
            this.app.showUndo(`${tracker.name} fue archivada.`, () => {
                this.restoreTracker(tracker.id);
            });
            return;
        }
        this.showManagerFeedback(`${tracker.name} fue archivada.`, {
            label: 'Deshacer',
            action: 'undo-archive',
            trackerId: tracker.id
        });
    }

    restoreTracker(trackerId) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || !tracker.archived || tracker.deleted) return;
        tracker.archived = false;
        tracker.order = Math.max(
            -1,
            ...this.registry.trackers
                .filter(item => (
                    !item.archived
                    && !item.deleted
                    && item.section === tracker.section
                    && item.subsection === tracker.subsection
                ))
                .map(item => item.order)
        ) + 1;
        tracker.updatedAt = new Date().toISOString();
        this.syncAlertConfig(tracker, tracker.alert);
        this.pendingDeleteIds.delete(trackerId);
        this.persistRegistry();
        this.showManagerFeedback(`${tracker.name} volvió a estar activa.`);
    }

    async deleteTracker(trackerId) {
        const tracker = this.getTracker(trackerId);
        if (
            !tracker
            || !tracker.archived
            || tracker.deleted
            || !this.pendingDeleteIds.has(trackerId)
        ) {
            return false;
        }

        const deletion = deleteCustomTrackerPermanently(this.registry, trackerId);

        let deletedStudies = { deletedEntries: 0, deletedFiles: 0 };
        if (isMedicalStudyTracker(tracker)) {
            if (!this.app.health?.deleteStudyEntriesForTracker) {
                this.showManagerFeedback(
                    `No se pudo borrar ${tracker.name}: el administrador de estudios no está disponible.`
                );
                this.renderManager();
                return false;
            }
            try {
                deletedStudies = await this.app.health.deleteStudyEntriesForTracker(trackerId);
            } catch (error) {
                console.error('Error eliminando adjuntos de la tarjeta médica:', error);
                this.showManagerFeedback(
                    `No se pudo borrar ${tracker.name}: sus archivos adjuntos se conservaron para que puedas reintentar.`
                );
                this.renderManager();
                return false;
            }
        }

        this.clearLegacyTracker(tracker);
        this.pendingDeleteIds.delete(trackerId);
        if (this.historyDialogTrackerId === trackerId) {
            this.closeHistoryDialog({ restoreFocus: false });
        }
        if (this.instructionsDialogTrackerId === trackerId) {
            this.closeInstructionsDialog({ restoreFocus: false });
        }
        this.clearPendingHistoryDeletes(trackerId);
        this.syncAlertConfig(tracker, tracker.alert, { remove: true });
        this.registry = deletion.registry;
        this.persistRegistry();
        const studySummary = deletedStudies.deletedEntries > 0
            ? ` También se eliminaron ${deletedStudies.deletedEntries} ${deletedStudies.deletedEntries === 1 ? 'estudio' : 'estudios'}${deletedStudies.deletedFiles > 0 ? ` y ${deletedStudies.deletedFiles} ${deletedStudies.deletedFiles === 1 ? 'archivo adjunto' : 'archivos adjuntos'}` : ''}.`
            : '';
        this.showManagerFeedback(`${tracker.name} fue borrada definitivamente.${studySummary}`);
        return true;
    }

    getActiveTrackers(sectionKey = null) {
        return this.registry.trackers.filter(tracker => (
            !tracker.archived
            && !tracker.deleted
            && (!sectionKey || tracker.section === sectionKey)
        ));
    }

    getRuntimeTrackers(sectionKey) {
        let trackers = this.getActiveTrackers(sectionKey);
        if (sectionKey === 'hygiene') {
            const currentCategory = this.app.hygiene?.currentCategory
                || this.getSections().hygiene.defaultSubsection;
            trackers = trackers.filter(tracker => tracker.subsection === currentCategory);
        }
        return trackers;
    }

    hasReorderableGroup(trackers) {
        const counts = new Map();
        trackers.forEach(tracker => {
            const key = `${tracker.section}:${tracker.subsection}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts.values()).some(count => count > 1);
    }

    enterBulkMode(sectionKey) {
        if (!this.getSections()[sectionKey]) return false;
        const trackers = this.getRuntimeTrackers(sectionKey).filter(tracker => (
            !isMedicalStudyTracker(tracker)
            && !isStateReminderTracker(tracker)
        ));
        if (trackers.length < 2) {
            this.showRuntimeFeedback(
                'Necesitás al menos dos tarjetas visibles para usar el registro múltiple.'
            );
            return false;
        }

        if (this.reorderContext) {
            this.cancelReorderMode({ silent: true });
        }
        if (this.bulkContext) {
            this.cancelBulkMode({ silent: true });
        }

        this.bulkContext = {
            sectionKey,
            selectedIds: new Set()
        };
        document.body.classList.add('custom-bulk-active');
        this.renderSection(sectionKey);
        return true;
    }

    toggleBulkSelection(trackerId) {
        if (!this.bulkContext) return false;
        const tracker = this.getTracker(trackerId);
        const visibleIds = new Set(
            this.getRuntimeTrackers(this.bulkContext.sectionKey)
                .filter(item => (
                    !isMedicalStudyTracker(item)
                    && !isStateReminderTracker(item)
                ))
                .map(item => item.id)
        );
        if (
            !tracker
            || tracker.section !== this.bulkContext.sectionKey
            || !visibleIds.has(trackerId)
        ) {
            return false;
        }

        if (this.bulkContext.selectedIds.has(trackerId)) {
            this.bulkContext.selectedIds.delete(trackerId);
        } else {
            this.bulkContext.selectedIds.add(trackerId);
        }
        const selected = this.bulkContext.selectedIds.has(trackerId);
        const card = document.querySelector(
            `.custom-tracker-card.is-bulk-selectable[data-tracker-id="${trackerId}"]`
        );
        const toggle = card?.querySelector(
            '[data-custom-runtime-action="toggle-bulk"]'
        );
        card?.classList.toggle('is-bulk-selected', selected);
        if (toggle) {
            toggle.setAttribute(
                'aria-label',
                `${selected ? 'Quitar' : 'Seleccionar'} ${tracker.name} del registro múltiple`
            );
            toggle.dataset.tooltip = selected
                ? 'Quitar selección'
                : 'Seleccionar tarjeta';
            toggle.setAttribute('aria-pressed', String(selected));
            const icon = toggle.querySelector('i');
            if (icon) icon.className = `ph ${selected ? 'ph-check' : 'ph-circle'}`;
            toggle.focus({ preventScroll: true });
        }
        this.updateRuntimeOrderControls(this.bulkContext.sectionKey);
        return true;
    }

    finishBulkMode() {
        if (!this.bulkContext) return null;
        const context = this.bulkContext;
        this.bulkContext = null;
        document.body.classList.remove('custom-bulk-active');
        document.getElementById(
            this.getSections()[context.sectionKey]?.mainSectionId
        )?.classList.remove('is-custom-bulk');
        return context;
    }

    commitBulkMode() {
        if (!this.bulkContext || this.bulkContext.selectedIds.size === 0) {
            return false;
        }
        const context = this.finishBulkMode();
        return this.recordTrackers(Array.from(context.selectedIds));
    }

    cancelBulkMode({ silent = false } = {}) {
        if (!this.bulkContext) return false;
        const context = this.finishBulkMode();
        this.renderSection(context.sectionKey);
        if (!silent) {
            this.showRuntimeFeedback('Se canceló el registro múltiple.');
        }
        return true;
    }

    enterReorderMode(scope, sectionKey = null) {
        const isManager = scope === 'manager';
        const section = sectionKey ? this.getSections()[sectionKey] : null;
        if (!isManager && !section) return false;

        const trackers = isManager
            ? this.getActiveTrackers()
            : this.getRuntimeTrackers(sectionKey);
        if ((isManager && !this.hasReorderableGroup(trackers)) || (!isManager && trackers.length === 0)) {
            const message = isManager
                ? 'Necesitás al menos dos tarjetas en una misma categoría para ordenarlas.'
                : 'No hay tarjetas visibles para ordenar o destacar.';
            if (isManager) this.showManagerFeedback(message);
            else this.showRuntimeFeedback(message);
            return false;
        }

        if (this.reorderContext) {
            this.cancelReorderMode({ silent: true });
        }
        if (this.bulkContext) {
            this.cancelBulkMode({ silent: true });
        }

        this.reorderContext = {
            scope,
            sectionKey: isManager ? null : sectionKey,
            changed: false,
            draftOrders: new Map(),
            draftFeaturedId: isManager
                ? null
                : (this.registry.featuredBySection[sectionKey] || null)
        };
        document.body.classList.add('custom-reorder-active');

        if (isManager) {
            this.renderManager();
        } else {
            this.renderSection(sectionKey);
        }
        return true;
    }

    getFeaturedTrackerId(sectionKey) {
        if (
            this.reorderContext?.scope === 'runtime'
            && this.reorderContext.sectionKey === sectionKey
        ) {
            return this.reorderContext.draftFeaturedId || null;
        }
        return this.registry.featuredBySection?.[sectionKey] || null;
    }

    toggleDraftFeaturedTracker(trackerId) {
        const context = this.reorderContext;
        const tracker = this.getTracker(trackerId);
        if (
            context?.scope !== 'runtime'
            || !tracker
            || tracker.section !== context.sectionKey
            || tracker.archived
            || tracker.deleted
        ) return false;

        context.draftOrders = this.collectDraftOrders();
        context.draftFeaturedId = context.draftFeaturedId === trackerId
            ? null
            : trackerId;
        context.changed = true;
        this.renderSection(context.sectionKey);
        requestAnimationFrame(() => {
            document.querySelector(
                `.custom-tracker-card[data-tracker-id="${CSS.escape(trackerId)}"] [data-custom-feature-action]`
            )?.focus({ preventScroll: true });
        });
        return true;
    }

    getDraftTrackerOrder(tracker) {
        if (!tracker) return Number.MAX_SAFE_INTEGER;
        return this.reorderContext?.draftOrders?.has(tracker.id)
            ? this.reorderContext.draftOrders.get(tracker.id)
            : tracker.order;
    }

    destroySortableInstances() {
        this.sortableInstances.forEach(instance => instance.destroy());
        this.sortableInstances = [];
        document.body.classList.remove('custom-sort-active');
    }

    initializeSortableLists(root) {
        this.destroySortableInstances();
        if (!this.reorderContext || !root) return;

        root.querySelectorAll('[data-reorder-list]').forEach(list => {
            const items = Array.from(list.children)
                .filter(element => element.matches('[data-reorder-item]'));
            if (items.length < 2) return;

            const instance = Sortable.create(list, {
                animation: 180,
                draggable: '[data-reorder-item]',
                filter: 'button:not([data-reorder-keyboard-handle]), a, input, select, textarea, [contenteditable="true"]',
                preventOnFilter: false,
                delay: 170,
                delayOnTouchOnly: true,
                touchStartThreshold: 5,
                fallbackTolerance: 4,
                fallbackOnBody: true,
                forceFallback: true,
                scroll: true,
                bubbleScroll: true,
                scrollSensitivity: 80,
                scrollSpeed: 14,
                ghostClass: 'custom-sort-ghost',
                chosenClass: 'custom-sort-chosen',
                dragClass: 'custom-sort-dragging',
                onStart: event => {
                    this.app.tooltips?.hide();
                    document.body.classList.add('custom-sort-active');
                    event.item?.setAttribute('aria-grabbed', 'true');
                },
                onEnd: event => {
                    document.body.classList.remove('custom-sort-active');
                    event.item?.setAttribute('aria-grabbed', 'false');
                    if (event.oldIndex !== event.newIndex && this.reorderContext) {
                        this.reorderContext.changed = true;
                        this.reorderContext.draftOrders = this.collectDraftOrders();
                    }
                }
            });
            this.sortableInstances.push(instance);
        });
    }

    handleReorderKeyboard(event) {
        if (!this.reorderContext || !['ArrowUp', 'ArrowDown'].includes(event.key)) {
            return;
        }

        const handle = event.target.closest('[data-reorder-keyboard-handle]');
        const item = handle?.closest('[data-reorder-item]');
        const list = item?.closest('[data-reorder-list]');
        if (!handle || !item || !list) return;

        const items = Array.from(list.children)
            .filter(element => element.matches('[data-reorder-item]'));
        const currentIndex = items.indexOf(item);
        const targetIndex = currentIndex + (event.key === 'ArrowUp' ? -1 : 1);
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) {
            return;
        }

        event.preventDefault();
        if (targetIndex < currentIndex) {
            list.insertBefore(item, items[targetIndex]);
        } else {
            list.insertBefore(items[targetIndex], item);
        }
        this.reorderContext.changed = true;
        item.classList.remove('custom-sort-keyboard-moved');
        requestAnimationFrame(() => {
            item.classList.add('custom-sort-keyboard-moved');
            setTimeout(() => item.classList.remove('custom-sort-keyboard-moved'), 240);
        });
        handle.focus();
    }

    collectDraftOrders() {
        if (!this.reorderContext) return new Map();
        const root = this.reorderContext.scope === 'manager'
            ? this.managerRoot
            : document.getElementById(
                this.getSections()[this.reorderContext.sectionKey]?.mainSectionId
            );
        const updates = new Map();

        root?.querySelectorAll('[data-reorder-list]').forEach(list => {
            Array.from(list.children)
                .filter(element => element.matches('[data-reorder-item]'))
                .forEach((element, order) => {
                    const tracker = this.getTracker(element.dataset.trackerId);
                    const expectedGroup = `${tracker?.section || ''}:${tracker?.subsection || ''}`;
                    if (
                        tracker
                        && !tracker.archived
                        && !tracker.deleted
                        && expectedGroup === list.dataset.reorderGroup
                    ) {
                        updates.set(tracker.id, order);
                    }
                });
        });
        return updates;
    }

    finishReorderMode() {
        const context = this.reorderContext;
        this.destroySortableInstances();
        this.reorderContext = null;
        document.body.classList.remove('custom-reorder-active');
        Object.values(this.getSections()).forEach(section => {
            const root = document.getElementById(section.mainSectionId);
            root?.classList.remove('is-custom-reordering');
        });
        return context;
    }

    saveReorderMode() {
        if (!this.reorderContext) return;

        const updates = this.collectDraftOrders();
        const context = this.finishReorderMode();
        const timestamp = new Date().toISOString();
        let changed = false;
        updates.forEach((order, trackerId) => {
            const tracker = this.getTracker(trackerId);
            if (!tracker || tracker.order === order) return;
            tracker.order = order;
            tracker.updatedAt = timestamp;
            changed = true;
        });
        if (context?.scope === 'runtime' && context.sectionKey) {
            const previousFeatured = this.registry.featuredBySection[context.sectionKey] || null;
            const nextFeatured = context.draftFeaturedId || null;
            if (previousFeatured !== nextFeatured) {
                this.registry.featuredBySection[context.sectionKey] = nextFeatured;
                changed = true;
            }
        }

        if (changed) {
            this.persistRegistry();
        } else {
            this.renderAll();
        }

        const message = changed
            ? 'El orden y la tarjeta destacada quedaron guardados y sincronizados.'
            : 'No había cambios para guardar.';
        if (context?.scope === 'manager') this.showManagerFeedback(message);
        else this.showRuntimeFeedback(message);
    }

    cancelReorderMode({ silent = false } = {}) {
        if (!this.reorderContext) return false;
        const context = this.finishReorderMode();
        this.renderAll();
        if (!silent) {
            const message = 'Se descartaron los cambios de orden.';
            if (context?.scope === 'manager') this.showManagerFeedback(message);
            else this.showRuntimeFeedback(message);
        }
        return true;
    }

    getHistoryDeleteKey(trackerId, historyIndex) {
        return `${trackerId}:${historyIndex}`;
    }

    clearPendingHistoryDeletes(trackerId) {
        const prefix = `${trackerId}:`;
        Array.from(this.pendingHistoryDeleteKeys).forEach(key => {
            if (key.startsWith(prefix)) this.pendingHistoryDeleteKeys.delete(key);
        });
    }

    deleteHistoryEntry(trackerId, historyIndex) {
        const tracker = this.getTracker(trackerId);
        const history = this.getHistory(trackerId);
        const confirmationKey = this.getHistoryDeleteKey(trackerId, historyIndex);
        if (
            !tracker
            || !Number.isInteger(historyIndex)
            || historyIndex < 0
            || historyIndex >= history.length
            || !this.pendingHistoryDeleteKeys.has(confirmationKey)
        ) {
            return;
        }

        const deletedDate = history[historyIndex];
        history.splice(historyIndex, 1);
        this.clearPendingHistoryDeletes(trackerId);
        this.registry.histories[trackerId] = history;
        this.mirrorLegacyTracker(tracker);
        this.persistRegistry();
        this.renderHistoryDialog();
        if (this.app.showUndo) {
            this.app.showUndo('El registro fue borrado.', () => {
                this.restoreHistoryEntry(trackerId, deletedDate);
            });
        } else {
            this.showRuntimeFeedback('El registro fue borrado.');
        }
        return true;
    }

    restoreHistoryEntry(trackerId, dateValue) {
        const tracker = this.getTracker(trackerId);
        const restoredDate = new Date(dateValue);
        if (!tracker || tracker.deleted || Number.isNaN(restoredDate.getTime())) return false;

        const history = [...this.getHistory(trackerId)];
        if (!history.includes(dateValue)) history.push(restoredDate.toISOString());
        this.registry.histories[trackerId] = history
            .sort((a, b) => Date.parse(b) - Date.parse(a))
            .slice(0, 1000);
        this.mirrorLegacyTracker(tracker);
        this.persistRegistry();
        if (this.historyDialogTrackerId === trackerId) this.renderHistoryDialog();
        this.showRuntimeFeedback('El registro volvió al historial.');
        return true;
    }

    showManagerFeedback(message, action = null) {
        if (!this.managerFeedback) return;
        this.managerFeedback.innerHTML = `
            <span>${escapeHtml(message)}</span>
            ${action ? `
                <button type="button" class="custom-feedback-action" data-custom-manager-action="${action.action}" data-tracker-id="${action.trackerId}">
                    ${escapeHtml(action.label)}
                </button>
            ` : ''}
        `;
        this.managerFeedback.classList.remove('hidden');
    }

    showRuntimeFeedback(message) {
        let toast = document.getElementById('custom-tracker-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'custom-tracker-toast';
            toast.className = 'custom-tracker-toast hidden';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }

        clearTimeout(this.toastTimer);
        toast.textContent = message;
        toast.classList.remove('hidden');
        this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
    }

    renderAll() {
        this.renderManager();
        this.renderModulesManager();
        this.app.hygiene?.render();
        this.app.grooming?.render();
        this.app.lenses?.loadDatesAndStock();
        this.app.health?.render();
        this.registry.customModules
            .filter(module => !module.archived)
            .forEach(module => this.renderSection(module.id));
        if (
            this.historyDialogTrackerId
            && !this.historyDialog?.classList.contains('hidden')
        ) {
            this.renderHistoryDialog();
        }
    }

    normalizeManagerSearchText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('es')
            .trim();
    }

    matchesManagerTrackerSearch(tracker, section, query) {
        if (!query) return true;
        const subsection = section?.subsections?.[tracker.subsection];
        return this.normalizeManagerSearchText([
            tracker.name,
            tracker.actionLabel,
            section?.label,
            subsection?.label
        ].filter(Boolean).join(' ')).includes(query);
    }

    renderManager() {
        if (!this.managerSummary) return;
        const isReordering = this.reorderContext?.scope === 'manager';
        const sections = Object.fromEntries(
            Object.entries(this.getSections()).filter(([, section]) => !section.archived)
        );
        const validFilters = new Set([
            'all',
            'vehicle',
            ...Object.keys(sections)
        ]);
        if (!validFilters.has(this.activeCategoryFilter)) {
            this.activeCategoryFilter = 'all';
        }

        const searchQuery = isReordering
            ? ''
            : this.normalizeManagerSearchText(this.managerSearchQuery);
        const vehicleCards = this.app.vehicle?.cards?.getCards?.({
            includeArchived: false
        }) || [];
        const allVehicleCards = this.app.vehicle?.cards?.getCards?.() || [];
        const totalActiveAll = this.registry.trackers.filter(
            tracker => !tracker.archived && !tracker.deleted
        ).length + vehicleCards.length;
        const filterBarHtml = `
            <div class="tracker-category-filter-bar" role="group" aria-label="Filtrar tarjetas por sección">
                <button type="button"
                        class="tracker-category-tab ${this.activeCategoryFilter === 'all' ? 'active' : ''}"
                        data-tracker-category-filter="all"
                        ${isReordering ? 'disabled' : ''}
                        aria-pressed="${this.activeCategoryFilter === 'all' ? 'true' : 'false'}">
                    <i class="ph ph-squares-four" aria-hidden="true"></i>
                    <span>Todas</span>
                    <span class="count-pill">${totalActiveAll}</span>
                </button>
                ${Object.entries(sections).map(([sectionKey, section]) => {
                    const activeCount = this.registry.trackers.filter(tracker => (
                        tracker.section === sectionKey
                        && !tracker.archived
                        && !tracker.deleted
                    )).length;
                    const isActive = this.activeCategoryFilter === sectionKey;
                    return `
                        <button type="button"
                                class="tracker-category-tab ${isActive ? 'active' : ''}"
                                data-tracker-category-filter="${sectionKey}"
                                ${isReordering ? 'disabled' : ''}
                                aria-pressed="${isActive ? 'true' : 'false'}">
                            <i class="ph ${section.defaultIcon}" aria-hidden="true"></i>
                            <span>${escapeHtml(section.label)}</span>
                            <span class="count-pill">${activeCount}</span>
                        </button>
                    `;
                }).join('')}
                <button type="button"
                        class="tracker-category-tab ${this.activeCategoryFilter === 'vehicle' ? 'active' : ''}"
                        data-tracker-category-filter="vehicle"
                        ${isReordering ? 'disabled' : ''}
                        aria-pressed="${this.activeCategoryFilter === 'vehicle' ? 'true' : 'false'}">
                    <i class="ph ph-car" aria-hidden="true"></i>
                    <span>Vehículo</span>
                    <span class="count-pill">${vehicleCards.length}</span>
                </button>
            </div>
        `;

        const visibleSections = Object.entries(sections).filter(
            ([sectionKey]) => (
                this.activeCategoryFilter === 'all'
                || this.activeCategoryFilter === sectionKey
            )
        );
        let matchingCount = 0;
        const sectionsHtml = visibleSections.map(([sectionKey, section]) => {
            const allActive = this.registry.trackers
                .filter(tracker => (
                    tracker.section === sectionKey
                    && !tracker.archived
                    && !tracker.deleted
                ))
                .sort((a, b) => (
                    a.subsection.localeCompare(b.subsection)
                    || a.order - b.order
                    || a.name.localeCompare(b.name, 'es')
                ));
            const allArchived = this.registry.trackers
                .filter(tracker => (
                    tracker.section === sectionKey
                    && tracker.archived
                    && !tracker.deleted
                ))
                .sort((a, b) => a.name.localeCompare(b.name, 'es'));
            const active = allActive.filter(tracker => (
                this.matchesManagerTrackerSearch(tracker, section, searchQuery)
            ));
            const archived = allArchived.filter(tracker => (
                this.matchesManagerTrackerSearch(tracker, section, searchQuery)
            ));
            matchingCount += active.length + archived.length;

            const activeGroups = Object.entries(section.subsections)
                .map(([subsectionKey, subsection]) => ({
                    key: subsectionKey,
                    label: subsection.label,
                    trackers: active.filter(
                        tracker => tracker.subsection === subsectionKey
                    )
                }))
                .filter(group => group.trackers.length > 0);
            const activeLabel = `${allActive.length} ${allActive.length === 1 ? 'activa' : 'activas'}`;
            const archivedLabel = allArchived.length > 0
                ? ` · ${allArchived.length} ${allArchived.length === 1 ? 'archivada' : 'archivadas'}`
                : '';
            const filteredLabel = searchQuery
                ? ` · ${active.length + archived.length} ${active.length + archived.length === 1 ? 'coincidencia' : 'coincidencias'}`
                : '';

            if (searchQuery && active.length + archived.length === 0) return '';

            return `
                <section class="custom-manager-section" data-manager-section="${sectionKey}">
                    <div class="custom-manager-section-header">
                        <div>
                            <span class="custom-manager-section-icon">
                                <i class="ph ${section.defaultIcon}" aria-hidden="true"></i>
                            </span>
                            <span>
                                <h3>${escapeHtml(section.label)}</h3>
                                <small>${activeLabel}${archivedLabel}${filteredLabel}</small>
                            </span>
                        </div>
                        <button type="button" class="custom-manager-add ${isReordering ? 'hidden' : ''}" data-custom-manager-action="new" data-section="${sectionKey}" aria-label="Crear tarjeta en ${escapeHtml(section.label)}" data-tooltip="Crear tarjeta en ${escapeHtml(section.label)}">
                            <i class="ph ph-plus" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div class="custom-manager-list">
                        ${activeGroups.length > 0
                            ? activeGroups.map(group => `
                                <div class="custom-manager-group">
                                    <div class="custom-manager-group-label">
                                        <span>${escapeHtml(group.label)}</span>
                                        <small>${group.trackers.length}</small>
                                    </div>
                                    <div
                                        class="custom-manager-sortable-list"
                                        ${isReordering ? `data-reorder-list data-reorder-group="${sectionKey}:${group.key}"` : ''}
                                    >
                                        ${group.trackers.map(tracker => (
                                            this.renderManagerActiveRow(tracker, isReordering)
                                        )).join('')}
                                    </div>
                                </div>
                            `).join('')
                            : `
                                <p class="custom-manager-empty">
                                    ${searchQuery
                                        ? 'No hay tarjetas activas que coincidan con la búsqueda.'
                                        : 'No hay tarjetas activas en esta sección.'}
                                </p>
                            `}
                        ${archived.length > 0 ? `
                            <details class="custom-manager-archived" ${
                                searchQuery
                                || archived.some(tracker => this.pendingDeleteIds.has(tracker.id))
                                    ? 'open'
                                    : ''
                            }>
                                <summary>
                                    <span><i class="ph ph-archive" aria-hidden="true"></i> Archivadas</span>
                                    <span class="custom-manager-archived-count">${archived.length}</span>
                                </summary>
                                <div class="custom-manager-archived-grid">
                                    ${archived.map(tracker => (
                                        this.renderManagerArchivedRow(tracker)
                                    )).join('')}
                                </div>
                            </details>
                        ` : ''}
                    </div>
                </section>
            `;
        });

        const vehicleVisible = !isReordering
            && (this.activeCategoryFilter === 'all' || this.activeCategoryFilter === 'vehicle');
        const matchingVehicleCards = vehicleVisible
            ? (
                this.app.vehicle?.cards?.getManagerCardsMatching?.(
                    this.managerSearchQuery
                )
                || allVehicleCards.filter(card => (
                    !searchQuery
                    || this.normalizeManagerSearchText([
                        card.name,
                        card.type,
                        card.section
                    ].join(' ')).includes(searchQuery)
                ))
            )
            : [];
        matchingCount += matchingVehicleCards.length;
        const vehicleHtml = vehicleVisible
            ? (this.app.vehicle?.cards?.renderManagerSection?.({
                query: this.managerSearchQuery
            }) || '')
            : '';
        const resultLabel = searchQuery
            ? `${matchingCount} ${matchingCount === 1 ? 'coincidencia' : 'coincidencias'} para “${escapeHtml(this.managerSearchQuery.trim())}”`
            : 'Elegí una sección o buscá una tarjeta por nombre.';
        const contentHtml = searchQuery && matchingCount === 0
            ? `
                <div class="custom-manager-no-results">
                    <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
                    <strong>No encontramos esa tarjeta</strong>
                    <span>Probá con otro nombre o limpiá la búsqueda para volver a ver todas.</span>
                    <button type="button" class="btn btn-secondary" data-custom-manager-action="clear-search">Limpiar búsqueda</button>
                </div>
            `
            : sectionsHtml.join('') + vehicleHtml;

        this.managerSummary.innerHTML = `
            <div class="custom-manager-browser">
                ${filterBarHtml}
                <div class="custom-manager-search-row">
                    <label class="custom-manager-search-field">
                        <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
                        <input
                            type="search"
                            value="${escapeHtml(this.managerSearchQuery)}"
                            maxlength="80"
                            placeholder="Buscar una tarjeta"
                            aria-label="Buscar una tarjeta por nombre"
                            data-custom-manager-search
                            ${isReordering ? 'disabled' : ''}
                        >
                        ${this.managerSearchQuery ? `
                            <button type="button" data-custom-manager-action="clear-search" aria-label="Limpiar búsqueda" data-tooltip="Limpiar búsqueda">
                                <i class="ph ph-x" aria-hidden="true"></i>
                            </button>
                        ` : ''}
                    </label>
                    <span class="custom-manager-search-result" role="status">${resultLabel}</span>
                </div>
            </div>
            <div class="custom-manager-content-grid ${this.activeCategoryFilter === 'all' ? 'is-all' : 'is-focused'}">
                ${contentHtml}
            </div>
        `;

        const managerNote = this.managerRoot.querySelector(
            '.custom-trackers-manager-note'
        );
        const managerNoteIcon = managerNote?.querySelector('i');
        const managerNoteText = managerNote?.querySelector('span');
        if (managerNoteIcon) {
            managerNoteIcon.className = isReordering
                ? 'ph ph-hand-grabbing'
                : 'ph ph-info';
        }
        if (managerNoteText) {
            managerNoteText.textContent = isReordering
                ? 'Mantené presionada una fila y arrastrala dentro de su categoría. También podés enfocar el control de agarre y usar las flechas del teclado.'
                : 'Cada tarjeta conserva su historial y su comportamiento. Al archivarla desaparece del uso diario, pero podés restaurarla cuando quieras. Recordatorios usa esta misma configuración de avisos: no mantiene una copia separada.';
        }
        this.managerRoot.classList.toggle('is-custom-reordering', isReordering);
        this.orderTrackersButton?.classList.toggle('hidden', isReordering);
        this.newTrackerButton?.classList.toggle('hidden', isReordering);
        this.managerOrderActions?.classList.toggle('hidden', !isReordering);
        if (this.orderTrackersButton) {
            this.orderTrackersButton.disabled = !this.hasReorderableGroup(
                this.getActiveTrackers()
            );
        }
        if (isReordering) {
            this.initializeSortableLists(this.managerRoot);
        }
    }

    renderManagerActiveRow(tracker, isReordering) {
        const subsection = this.getSections()[tracker.section]
            ?.subsections?.[tracker.subsection];
        return `
            <div
                class="custom-manager-row ${isReordering ? 'is-reorderable' : ''}"
                data-tracker-id="${tracker.id}"
                ${isReordering ? 'data-reorder-item aria-grabbed="false"' : ''}
            >
                <div class="custom-manager-row-name">
                    <i class="ph ${tracker.icon}"></i>
                    <span>
                        <strong>${escapeHtml(tracker.name)}</strong>
                        <small>${escapeHtml(subsection?.label || '')}</small>
                    </span>
                </div>
                <div class="custom-manager-row-actions">
                    ${isReordering ? `
                        <button
                            type="button"
                            class="custom-reorder-keyboard-handle"
                            data-reorder-keyboard-handle
                            aria-label="Reubicar ${escapeHtml(tracker.name)} con las flechas del teclado"
                            data-tooltip="Arrastrá la fila o usá las flechas del teclado"
                        >
                            <i class="ph ph-dots-six-vertical"></i>
                        </button>
                    ` : `
                        <button type="button" data-custom-manager-action="edit" data-tracker-id="${tracker.id}" aria-label="Editar ${escapeHtml(tracker.name)}" data-tooltip="Editar tarjeta">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button type="button" data-custom-manager-action="archive" data-tracker-id="${tracker.id}" aria-label="Archivar ${escapeHtml(tracker.name)}" data-tooltip="Archivar tarjeta">
                            <i class="ph ph-archive"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    renderManagerArchivedRow(tracker) {
        const awaitingConfirmation = this.pendingDeleteIds.has(tracker.id);
        const historyCount = this.getHistory(tracker.id).length;
        const deletionDetail = isMedicalStudyTracker(tracker)
            ? 'También se eliminarán sus estudios y archivos adjuntos.'
            : 'Esta acción no se puede deshacer.';
        return `
            <div class="custom-manager-row archived">
                <div class="custom-manager-row-name">
                    <i class="ph ${awaitingConfirmation ? 'ph-warning' : tracker.icon}"></i>
                    <span>
                        <strong>${awaitingConfirmation ? `¿Borrar ${escapeHtml(tracker.name)} y todo su historial?` : escapeHtml(tracker.name)}</strong>
                        <small>${awaitingConfirmation ? deletionDetail : `${historyCount} ${historyCount === 1 ? 'registro conservado' : 'registros conservados'}`}</small>
                    </span>
                </div>
                <div class="custom-manager-row-actions ${awaitingConfirmation ? 'confirming' : ''}">
                    ${awaitingConfirmation ? `
                        <button type="button" class="text-action" data-custom-manager-action="cancel-delete" data-tracker-id="${tracker.id}">
                            Cancelar
                        </button>
                        <button type="button" class="text-action danger" data-custom-manager-action="confirm-delete" data-tracker-id="${tracker.id}">
                            Borrar
                        </button>
                    ` : `
                        <button type="button" data-custom-manager-action="restore" data-tracker-id="${tracker.id}" aria-label="Restaurar ${escapeHtml(tracker.name)}" data-tooltip="Restaurar tarjeta">
                            <i class="ph ph-arrow-counter-clockwise"></i>
                        </button>
                        <button type="button" class="danger" data-custom-manager-action="request-delete" data-tracker-id="${tracker.id}" aria-label="Borrar definitivamente ${escapeHtml(tracker.name)}" data-tooltip="Borrar definitivamente">
                            <i class="ph ph-trash"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    clearRuntimeCards(sectionKey) {
        const section = this.getSections()[sectionKey];
        if (!section) return;
        const hostIds = new Set(
            Object.values(section.subsections).map(subsection => subsection.hostId)
        );
        hostIds.forEach(hostId => {
            document.getElementById(hostId)
                ?.querySelectorAll(`[data-custom-runtime-section="${sectionKey}"]`)
                .forEach(element => element.remove());
        });
    }

    renderSection(sectionKey) {
        const section = this.getSections()[sectionKey];
        if (!section) return;
        const sectionRoot = document.getElementById(section.mainSectionId);
        const isReordering = (
            this.reorderContext?.scope === 'runtime'
            && this.reorderContext.sectionKey === sectionKey
        );
        const isBulkSelecting = this.bulkContext?.sectionKey === sectionKey;
        this.clearRuntimeCards(sectionKey);
        Object.values(section.subsections).forEach(subsection => {
            const host = document.getElementById(subsection.hostId);
            host?.classList.remove('custom-runtime-sortable-list');
            host?.removeAttribute('data-reorder-list');
            host?.removeAttribute('data-reorder-group');
        });

        let active = this.registry.trackers
            .filter(tracker => (
                tracker.section === sectionKey
                && !tracker.archived
                && !tracker.deleted
            ));
        if (sectionKey === 'hygiene') {
            const currentCategory = this.app.hygiene?.currentCategory
                || section.defaultSubsection;
            active = active.filter(tracker => tracker.subsection === currentCategory);
        }

        const grouped = Object.groupBy
            ? Object.groupBy(active, tracker => tracker.subsection)
            : active.reduce((result, tracker) => {
                if (!result[tracker.subsection]) result[tracker.subsection] = [];
                result[tracker.subsection].push(tracker);
                return result;
            }, {});
        const featuredTrackerId = this.getFeaturedTrackerId(sectionKey);

        Object.entries(grouped).forEach(([subsectionKey, trackers]) => {
            const hostId = section.subsections[subsectionKey]?.hostId;
            const host = hostId ? document.getElementById(hostId) : null;
            if (!host) return;
            if (isReordering) {
                host.classList.add('custom-runtime-sortable-list');
                host.dataset.reorderList = '';
                host.dataset.reorderGroup = `${sectionKey}:${subsectionKey}`;
            }

            trackers
                .sort((a, b) => {
                    if (!isReordering) {
                        if (a.id === featuredTrackerId && b.id !== featuredTrackerId) return -1;
                        if (b.id === featuredTrackerId && a.id !== featuredTrackerId) return 1;
                    }
                    return this.getDraftTrackerOrder(a) - this.getDraftTrackerOrder(b)
                        || a.name.localeCompare(b.name, 'es');
                })
                .forEach(tracker => {
                    host.insertAdjacentHTML('beforeend', this.renderTrackerCard(tracker));
                });
        });

        sectionRoot?.classList.toggle('is-custom-reordering', isReordering);
        sectionRoot?.classList.toggle('is-custom-bulk', isBulkSelecting);
        this.updateRuntimeOrderControls(sectionKey);
        if (isReordering) {
            this.initializeSortableLists(sectionRoot);
        }
    }

    renderTrackerCard(tracker) {
        const history = this.getHistory(tracker.id);
        const state = getCustomTrackerState(tracker, history);
        const isStateReminder = isStateReminderTracker(tracker);
        const isMedicalStudy = isMedicalStudyTracker(tracker);
        const status = isStateReminder
            ? (state.active
                ? { label: 'Pendiente', color: 'var(--status-red)' }
                : { label: 'Al día', color: 'var(--status-green)' })
            : (STATUS_META[state.status] || STATUS_META.new);
        const safeName = escapeHtml(tracker.name);
        const actionLabel = isStateReminder && !state.active
            ? tracker.behavior.startActionLabel
            : tracker.actionLabel;
        const safeAction = escapeHtml(actionLabel);
        const studyEntries = isMedicalStudy
            ? this.app.health?.getStudyEntries?.(tracker.id)
            : null;
        const historyCount = Array.isArray(studyEntries)
            ? studyEntries.length
            : history.length;
        const latestLabel = state.latest
            ? DateUtils.formatFriendlyDate(state.latest)
            : 'Nunca';
        const nextLabel = state.nextDate
            ? DateUtils.formatFriendlyDate(state.nextDate)
            : 'Después del primer registro';
        const cadenceLabel = state.cadence.unit === 'months'
            ? `cada ${state.cadence.value} ${state.cadence.value === 1 ? 'mes' : 'meses'}`
            : `de ${state.dueValue} días`;
        const prediction = tracker.behavior?.prediction === 'beard'
            ? this.getBeardPrediction(history)
            : '';
        const isReordering = (
            this.reorderContext?.scope === 'runtime'
            && this.reorderContext.sectionKey === tracker.section
        );
        const isBulkSelecting = this.bulkContext?.sectionKey === tracker.section;
        const canBulkSelect = !isStateReminder && !isMedicalStudy;
        const isBulkSelected = isBulkSelecting && canBulkSelect
            && this.bulkContext.selectedIds.has(tracker.id);
        const isFeatured = this.getFeaturedTrackerId(tracker.section) === tracker.id;

        return `
            <article
                class="custom-tracker-card status-${state.status} ${isFeatured ? 'is-featured' : ''} ${isReordering ? 'is-reorderable' : ''} ${isBulkSelecting && canBulkSelect ? 'is-bulk-selectable' : ''} ${isBulkSelected ? 'is-bulk-selected' : ''}"
                data-tracker-id="${tracker.id}"
                data-custom-runtime-section="${tracker.section}"
                ${isReordering ? 'data-reorder-item aria-grabbed="false"' : ''}
                style="--custom-status-color: ${status.color};"
            >
                <div class="custom-tracker-card-header">
                    <div class="custom-tracker-identity">
                        <span class="custom-tracker-icon"><i class="ph ${tracker.icon}"></i></span>
                        <div>
                            <h3>${safeName}</h3>
                            <span class="custom-tracker-status">${status.label}</span>
                            ${isFeatured ? '<span class="custom-tracker-featured-label"><i class="ph ph-star-fill"></i> Destacada</span>' : ''}
                        </div>
                    </div>
                    ${isReordering ? `
                        <div class="custom-card-reorder-actions">
                            <button
                                type="button"
                                class="custom-card-feature-toggle ${isFeatured ? 'is-active' : ''}"
                                data-custom-feature-action="toggle"
                                data-tracker-id="${tracker.id}"
                                aria-pressed="${isFeatured}"
                                aria-label="${isFeatured ? 'Quitar tarjeta destacada' : 'Destacar'} ${safeName}"
                                data-tooltip="${isFeatured ? 'Quitar destacada' : 'Destacar tarjeta'}"
                            >
                                <i class="ph ${isFeatured ? 'ph-star-fill' : 'ph-star'}"></i>
                            </button>
                            <button
                                type="button"
                                class="custom-card-reorder-handle"
                                data-reorder-keyboard-handle
                                aria-label="Reubicar ${safeName} con las flechas del teclado"
                                data-tooltip="Arrastrá la tarjeta o usá las flechas del teclado"
                            >
                                <i class="ph ph-dots-six-vertical"></i>
                            </button>
                        </div>
                    ` : (isBulkSelecting ? `
                        ${canBulkSelect ? `
                            <button
                                type="button"
                                class="custom-card-bulk-toggle"
                                data-custom-runtime-action="toggle-bulk"
                                data-tracker-id="${tracker.id}"
                                aria-label="${isBulkSelected ? 'Quitar' : 'Seleccionar'} ${safeName} del registro múltiple"
                                data-tooltip="${isBulkSelected ? 'Quitar selección' : 'Seleccionar tarjeta'}"
                                aria-pressed="${isBulkSelected}"
                            >
                                <i class="ph ${isBulkSelected ? 'ph-check' : 'ph-circle'}"></i>
                            </button>
                        ` : '<span class="custom-card-individual-only">Individual</span>'}
                    ` : `
                        <details class="custom-tracker-menu">
                            <summary role="button" aria-haspopup="menu" aria-expanded="false" aria-label="Abrir acciones de ${safeName}" data-tooltip="Acciones de la tarjeta">
                                <i class="ph ph-dots-three-vertical" aria-hidden="true"></i>
                            </summary>
                            <div class="custom-tracker-menu-popover" role="menu" aria-label="Acciones de ${safeName}">
                                <button type="button" role="menuitem" data-custom-runtime-action="edit-config" data-tracker-id="${tracker.id}">
                                    <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                                    Editar configuración
                                </button>
                                ${tracker.instructions ? `
                                    <button type="button" role="menuitem" data-custom-runtime-action="open-instructions" data-tracker-id="${tracker.id}">
                                        <i class="ph ph-book-open" aria-hidden="true"></i>
                                        Ver instrucciones
                                    </button>
                                ` : ''}
                                <button type="button" role="menuitem" data-custom-runtime-action="open-history" data-tracker-id="${tracker.id}">
                                    <i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i>
                                    Ver historial (${historyCount})
                                </button>
                                <button type="button" role="menuitem" class="danger" data-custom-runtime-action="archive" data-tracker-id="${tracker.id}">
                                    <i class="ph ph-archive" aria-hidden="true"></i>
                                    Archivar
                                </button>
                            </div>
                        </details>
                    `)}
                </div>
                ${isStateReminder ? `
                    <div class="custom-tracker-metric custom-state-reminder-metric">
                        <strong>${state.active ? state.elapsedHours : '✓'}</strong>
                        <span>${state.active ? (state.elapsedHours === 1 ? 'hora pendiente' : 'horas pendientes') : 'sin avisos activos'}</span>
                    </div>
                    <div class="custom-tracker-dates">
                        <span>Estado <strong>${state.active ? 'Avisos activos' : 'Resuelto'}</strong></span>
                        <span>Frecuencia <strong>cada ${tracker.behavior.intervalHours} h</strong></span>
                    </div>
                    <div class="custom-tracker-progress" aria-hidden="true">
                        <span style="width: ${state.active ? 100 : 0}%"></span>
                    </div>
                ` : `
                    <div class="custom-tracker-metric">
                        <strong>${state.elapsedDays === null ? '--' : state.elapsedDays}</strong>
                        <span>${escapeHtml(cadenceLabel)}</span>
                    </div>
                    <div class="custom-tracker-dates">
                        <span>Último <strong>${escapeHtml(latestLabel)}</strong></span>
                        <span>Próximo <strong>${escapeHtml(nextLabel)}</strong></span>
                    </div>
                    <div class="custom-tracker-progress" aria-hidden="true">
                        <span style="width: ${state.progress}%"></span>
                    </div>
                    ${prediction ? `
                        <p class="custom-tracker-prediction">${escapeHtml(prediction)}</p>
                    ` : ''}
                `}
                <button type="button" class="btn btn-primary custom-tracker-record" data-custom-runtime-action="record" data-tracker-id="${tracker.id}">
                    <i class="ph ${isStateReminder && !state.active ? 'ph-warning' : (isMedicalStudy ? 'ph-plus-circle' : 'ph-check-circle')}"></i>
                    ${safeAction}
                </button>
            </article>
        `;
    }

    getBeardPrediction(history) {
        if (!Array.isArray(history) || history.length === 0) return 'Sin registros para proyectar.';
        const validDates = history
            .map(value => new Date(value))
            .filter(date => !Number.isNaN(date.getTime()));
        if (validDates.length === 0) return 'Sin registros para proyectar.';

        let intervalMs = 2 * 86_400_000;
        if (validDates.length >= 2) {
            const differences = [];
            const count = Math.min(validDates.length - 1, 3);
            for (let index = 0; index < count; index += 1) {
                const difference = validDates[index] - validDates[index + 1];
                if (difference > 12 * 60 * 60 * 1000) differences.push(difference);
            }
            if (differences.length > 0) {
                intervalMs = differences.reduce((sum, value) => sum + value, 0)
                    / differences.length;
                if (intervalMs > 4 * 86_400_000) intervalMs = 2.5 * 86_400_000;
            }
        }

        const next = new Date(validDates[0].getTime() + intervalMs);
        const label = next.toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric'
        });
        return `Próximo afeitado proyectado: ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
    }
}
