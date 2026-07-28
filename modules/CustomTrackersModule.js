import {
    buildCustomAlertDefinitions,
    createCustomTracker,
    CUSTOM_TRACKER_FIELD,
    CUSTOM_TRACKER_ICONS,
    CUSTOM_TRACKER_SECTIONS,
    getCustomAlertKey,
    getCustomTrackerState,
    normalizeCustomTrackerRegistry
} from '../custom-tracker-utils.mjs?v=20260728-custom-trackers-v2';
import { DateUtils } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

const STATUS_META = Object.freeze({
    new: { label: 'Sin registros', color: 'var(--text-secondary)' },
    green: { label: 'Al día', color: 'var(--status-green)' },
    yellow: { label: 'Atención', color: 'var(--status-yellow)' },
    orange: { label: 'Próximo', color: 'var(--status-orange)' },
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
    'ph-spray-bottle': 'Spray',
    'ph-drop-half': 'Líquido',
    'ph-user-focus': 'Cuidado personal'
});

export class CustomTrackersModule {
    constructor(appController) {
        this.app = appController;
        this.registry = this.loadRegistry();
        this.openHistoryIds = new Set();
        this.openInstructionIds = new Set();
        this.pendingDeleteIds = new Set();
        this.pendingHistoryDeleteKeys = new Set();
        this.editingId = null;
        this.lastDialogTrigger = null;
        this.toastTimer = null;

        this.managerRoot = document.getElementById('tab-seguimientos');
        this.managerSummary = document.getElementById('custom-trackers-manager-summary');
        this.managerFeedback = document.getElementById('custom-trackers-manager-feedback');
        this.newTrackerButton = document.getElementById('btn-new-custom-tracker');

        this.ensureEditorDialog();
        this.setupManagerListeners();
        this.setupRuntimeListeners();
        this.renderAll();
    }

    loadRegistry() {
        const stored = this.app.hygiene?.data?.[CUSTOM_TRACKER_FIELD];
        const registry = normalizeCustomTrackerRegistry(stored);
        if (this.app.hygiene?.data) {
            this.app.hygiene.data[CUSTOM_TRACKER_FIELD] = registry;
        }
        return registry;
    }

    reload() {
        this.registry = this.loadRegistry();
        this.renderAll();
    }

    getAlertDefinitions() {
        return buildCustomAlertDefinitions(this.registry);
    }

    getTracker(trackerId) {
        return this.registry.trackers.find(tracker => tracker.id === trackerId) || null;
    }

    getHistory(trackerId) {
        return this.registry.histories[trackerId] || [];
    }

    getEffectiveAlertConfig(tracker) {
        if (!tracker) {
            return { enabled: false, time: '23:00' };
        }

        const stored = this.app.alerts?.configs?.[getCustomAlertKey(tracker.id)];
        return {
            enabled: stored
                ? stored.enabled === true
                : tracker.alert?.enabled === true,
            time: stored?.time || tracker.alert?.time || '23:00'
        };
    }

    persistRegistry() {
        this.registry = normalizeCustomTrackerRegistry(this.registry);
        this.app.hygiene.data[CUSTOM_TRACKER_FIELD] = this.registry;
        this.app.hygiene.saveData();
        this.renderAll();
        this.app.notificationsCenter?.updateBadge();
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

    setupManagerListeners() {
        this.newTrackerButton?.addEventListener('click', event => {
            this.openEditor('hygiene', null, event.currentTarget);
        });

        this.managerRoot?.addEventListener('click', event => {
            const button = event.target.closest('[data-custom-manager-action]');
            if (!button) return;

            const action = button.dataset.customManagerAction;
            const trackerId = button.dataset.trackerId;

            if (action === 'new') {
                this.openEditor(button.dataset.section || 'hygiene', null, button);
            } else if (action === 'edit') {
                const tracker = this.getTracker(trackerId);
                if (tracker) this.openEditor(tracker.section, trackerId, button);
            } else if (action === 'archive') {
                this.archiveTracker(trackerId);
            } else if (action === 'restore' || action === 'undo-archive') {
                this.restoreTracker(trackerId);
            } else if (action === 'request-delete') {
                this.pendingDeleteIds.add(trackerId);
                this.renderManager();
            } else if (action === 'cancel-delete') {
                this.pendingDeleteIds.delete(trackerId);
                this.renderManager();
            } else if (action === 'confirm-delete') {
                this.deleteTracker(trackerId);
            } else if (action === 'move-up') {
                this.moveTracker(trackerId, -1);
            } else if (action === 'move-down') {
                this.moveTracker(trackerId, 1);
            }
        });
    }

    setupRuntimeListeners() {
        document.addEventListener('click', event => {
            const button = event.target.closest(
                '.custom-tracker-card [data-custom-runtime-action]'
            );
            if (!button) return;

            const action = button.dataset.customRuntimeAction;
            const trackerId = button.dataset.trackerId;
            const tracker = this.getTracker(trackerId);
            if (!tracker) return;

            if (action === 'record') {
                this.recordTracker(trackerId);
            } else if (action === 'toggle-history') {
                if (this.openHistoryIds.has(trackerId)) this.openHistoryIds.delete(trackerId);
                else this.openHistoryIds.add(trackerId);
                this.renderSection(tracker.section);
            } else if (action === 'toggle-instructions') {
                if (this.openInstructionIds.has(trackerId)) {
                    this.openInstructionIds.delete(trackerId);
                } else {
                    this.openInstructionIds.add(trackerId);
                }
                this.renderSection(tracker.section);
            } else if (action === 'edit-latest') {
                const latest = this.getHistory(trackerId)[0];
                if (latest) {
                    this.app.openEditModal(
                        'customTracker',
                        tracker.id,
                        tracker.name,
                        latest
                    );
                }
            } else if (action === 'request-delete-history') {
                this.pendingHistoryDeleteKeys.add(
                    this.getHistoryDeleteKey(
                        trackerId,
                        Number(button.dataset.historyIndex)
                    )
                );
                this.renderSection(tracker.section);
            } else if (action === 'cancel-delete-history') {
                this.pendingHistoryDeleteKeys.delete(
                    this.getHistoryDeleteKey(
                        trackerId,
                        Number(button.dataset.historyIndex)
                    )
                );
                this.renderSection(tracker.section);
            } else if (action === 'confirm-delete-history') {
                this.deleteHistoryEntry(
                    trackerId,
                    Number(button.dataset.historyIndex)
                );
            }
        });
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
                        <span class="custom-trackers-eyebrow">Seguimiento configurable</span>
                        <h2 id="custom-tracker-dialog-title">Nueva tarjeta</h2>
                        <p id="custom-tracker-dialog-section">Elegí dónde aparecerá la tarjeta.</p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-dialog-action="close" aria-label="Cerrar editor de tarjeta">
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
                        <div class="input-group">
                            <label for="custom-tracker-interval">Marcar como vencida después de</label>
                            <div class="custom-number-with-unit">
                                <input id="custom-tracker-interval" class="number-input" type="number" min="1" max="3650" inputmode="numeric" required>
                                <span>días</span>
                            </div>
                            <small>La cuenta solo vuelve a empezar cuando registrás la acción.</small>
                        </div>
                        <div class="input-group">
                            <label for="custom-tracker-icon">Icono</label>
                            <select id="custom-tracker-icon" class="text-input"></select>
                        </div>
                        <div class="input-group custom-form-wide">
                            <label for="custom-tracker-instructions">Instrucciones opcionales</label>
                            <textarea id="custom-tracker-instructions" class="text-input custom-tracker-textarea" maxlength="2000" placeholder="Materiales, pasos o cualquier detalle que quieras consultar al realizarlo."></textarea>
                            <small>Se mostrarán colapsadas y solo se abrirán cuando las necesites.</small>
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
        sectionSelect.innerHTML = Object.entries(CUSTOM_TRACKER_SECTIONS)
            .map(([key, section]) => (
                `<option value="${key}">${escapeHtml(section.label)}</option>`
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

    populateSubsectionOptions(sectionKey, selectedValue = null) {
        const section = CUSTOM_TRACKER_SECTIONS[sectionKey];
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
        const section = CUSTOM_TRACKER_SECTIONS[sectionKey];
        if (!section) return;
        this.dialog.querySelector('#custom-tracker-action').value = (
            ACTION_PRESETS.includes(section.defaultAction)
                ? section.defaultAction
                : '__custom__'
        );
        this.dialog.querySelector('#custom-tracker-icon').value = section.defaultIcon;
        this.updateEditorConditionalFields();
    }

    updateEditorDestinationLabel() {
        const sectionKey = this.dialog.querySelector('#custom-tracker-section').value;
        const subsectionKey = this.dialog.querySelector('#custom-tracker-subsection').value;
        const section = CUSTOM_TRACKER_SECTIONS[sectionKey];
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

        const alertEnabled = this.dialog.querySelector('#custom-tracker-alert-enabled').checked;
        this.dialog.querySelector('.custom-tracker-alert-time-wrap')
            .classList.toggle('hidden', !alertEnabled);
    }

    openEditor(sectionKey = 'hygiene', trackerId = null, trigger = null) {
        const tracker = trackerId ? this.getTracker(trackerId) : null;
        if (trackerId && !tracker) return;

        const selectedSectionKey = tracker?.section || (
            CUSTOM_TRACKER_SECTIONS[sectionKey] ? sectionKey : 'hygiene'
        );
        const section = CUSTOM_TRACKER_SECTIONS[selectedSectionKey];

        this.editingId = tracker?.id || null;
        this.lastDialogTrigger = trigger instanceof HTMLElement ? trigger : null;
        this.dialog.querySelector('#custom-tracker-dialog-title').textContent = tracker
            ? 'Editar tarjeta'
            : 'Nueva tarjeta';
        this.dialog.querySelector('#custom-tracker-section').value = selectedSectionKey;
        this.populateSubsectionOptions(selectedSectionKey, tracker?.subsection);
        this.dialog.querySelector('#custom-tracker-name').value = tracker?.name || '';
        this.dialog.querySelector('#custom-tracker-interval').value = tracker?.intervalDays || 30;
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
        this.lastDialogTrigger?.focus?.();
        this.lastDialogTrigger = null;
    }

    saveEditor() {
        const errorElement = this.dialog.querySelector('#custom-tracker-form-error');
        const section = this.dialog.querySelector('#custom-tracker-section').value;
        const subsection = this.dialog.querySelector('#custom-tracker-subsection').value;
        const actionChoice = this.dialog.querySelector('#custom-tracker-action').value;
        const actionLabel = actionChoice === '__custom__'
            ? this.dialog.querySelector('#custom-tracker-action-other').value
            : actionChoice;
        const alertEnabled = this.dialog.querySelector('#custom-tracker-alert-enabled').checked;
        const alertTime = this.dialog.querySelector('#custom-tracker-alert-time').value || '23:00';
        const existing = this.editingId ? this.getTracker(this.editingId) : null;

        try {
            const destinationChanged = existing && (
                existing.section !== section || existing.subsection !== subsection
            );
            const order = !existing || destinationChanged
                ? Math.max(
                    -1,
                    ...this.registry.trackers
                        .filter(tracker => (
                            !tracker.archived
                            && tracker.section === section
                            && tracker.subsection === subsection
                        ))
                        .map(tracker => tracker.order)
                ) + 1
                : existing.order;
            const candidate = createCustomTracker({
                section,
                subsection,
                name: this.dialog.querySelector('#custom-tracker-name').value,
                actionLabel,
                intervalDays: Number(
                    this.dialog.querySelector('#custom-tracker-interval').value
                ),
                icon: this.dialog.querySelector('#custom-tracker-icon').value,
                instructions: this.dialog.querySelector('#custom-tracker-instructions').value,
                alert: {
                    enabled: alertEnabled,
                    time: alertTime
                }
            }, {
                id: existing?.id || this.generateTrackerId(),
                now: new Date(),
                order
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

            this.syncAlertConfig(existing?.id || candidate.id, candidate.alert);
            this.persistRegistry();
            this.closeEditor();
            this.showManagerFeedback(
                existing ? 'Tarjeta actualizada.' : 'Tarjeta creada y sincronizada.'
            );
        } catch (error) {
            errorElement.textContent = error.message || 'No se pudo guardar la tarjeta.';
            errorElement.classList.remove('hidden');
        }
    }

    syncAlertConfig(trackerId, alertConfig, { remove = false, disabled = false } = {}) {
        if (!this.app.alerts) return;

        const key = getCustomAlertKey(trackerId);
        if (remove) {
            delete this.app.alerts.configs[key];
        } else {
            this.app.alerts.configs[key] = {
                enabled: disabled ? false : alertConfig.enabled === true,
                time: alertConfig.time || '23:00',
                days: []
            };
        }
        this.app.alerts.saveData();

        const alertsTab = document.getElementById('tab-alertas');
        if (alertsTab && !alertsTab.classList.contains('hidden')) {
            this.app.alerts.render();
        }
    }

    recordTracker(trackerId, when = new Date()) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived) return;

        const date = when instanceof Date ? when : new Date(when);
        if (Number.isNaN(date.getTime())) return;

        const history = this.getHistory(trackerId);
        history.unshift(date.toISOString());
        this.registry.histories[trackerId] = [...new Set(history)]
            .sort((a, b) => Date.parse(b) - Date.parse(a))
            .slice(0, 100);
        this.persistRegistry();
        if (navigator.vibrate) navigator.vibrate(40);
        this.showRuntimeFeedback(`${tracker.name}: registro guardado.`);
    }

    updateLatestDate(trackerId, dateValue) {
        const tracker = this.getTracker(trackerId);
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (!tracker || Number.isNaN(date.getTime())) return false;

        const history = this.getHistory(trackerId);
        if (history.length > 0) history[0] = date.toISOString();
        else history.unshift(date.toISOString());
        this.registry.histories[trackerId] = history
            .sort((a, b) => Date.parse(b) - Date.parse(a))
            .slice(0, 100);
        this.persistRegistry();
        this.showRuntimeFeedback(`Fecha de ${tracker.name} actualizada.`);
        return true;
    }

    archiveTracker(trackerId) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived) return;
        tracker.archived = true;
        tracker.updatedAt = new Date().toISOString();
        tracker.alert = this.getEffectiveAlertConfig(tracker);
        this.openHistoryIds.delete(trackerId);
        this.openInstructionIds.delete(trackerId);
        this.clearPendingHistoryDeletes(trackerId);
        this.syncAlertConfig(tracker.id, tracker.alert, { disabled: true });
        this.persistRegistry();
        this.showManagerFeedback(`${tracker.name} fue archivada.`, {
            label: 'Deshacer',
            action: 'undo-archive',
            trackerId: tracker.id
        });
    }

    restoreTracker(trackerId) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || !tracker.archived) return;
        tracker.archived = false;
        tracker.order = Math.max(
            -1,
            ...this.registry.trackers
                .filter(item => (
                    !item.archived
                    && item.section === tracker.section
                    && item.subsection === tracker.subsection
                ))
                .map(item => item.order)
        ) + 1;
        tracker.updatedAt = new Date().toISOString();
        this.syncAlertConfig(tracker.id, tracker.alert);
        this.pendingDeleteIds.delete(trackerId);
        this.persistRegistry();
        this.showManagerFeedback(`${tracker.name} volvió a estar activa.`);
    }

    deleteTracker(trackerId) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || !tracker.archived || !this.pendingDeleteIds.has(trackerId)) return;

        this.registry.trackers = this.registry.trackers.filter(item => item.id !== trackerId);
        delete this.registry.histories[trackerId];
        this.pendingDeleteIds.delete(trackerId);
        this.openHistoryIds.delete(trackerId);
        this.openInstructionIds.delete(trackerId);
        this.clearPendingHistoryDeletes(trackerId);
        this.syncAlertConfig(trackerId, tracker.alert, { remove: true });
        this.persistRegistry();
        this.showManagerFeedback(`${tracker.name} fue borrada definitivamente.`);
    }

    moveTracker(trackerId, direction) {
        const tracker = this.getTracker(trackerId);
        if (!tracker || tracker.archived) return;

        const destinationTrackers = this.registry.trackers
            .filter(item => (
                item.section === tracker.section
                && item.subsection === tracker.subsection
                && !item.archived
            ))
            .sort((a, b) => a.order - b.order);
        const currentIndex = destinationTrackers.findIndex(item => item.id === trackerId);
        const targetIndex = currentIndex + direction;
        if (
            currentIndex < 0
            || targetIndex < 0
            || targetIndex >= destinationTrackers.length
        ) {
            return;
        }

        const [moved] = destinationTrackers.splice(currentIndex, 1);
        destinationTrackers.splice(targetIndex, 0, moved);
        destinationTrackers.forEach((item, index) => {
            item.order = index;
            item.updatedAt = new Date().toISOString();
        });
        this.persistRegistry();
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

        history.splice(historyIndex, 1);
        this.clearPendingHistoryDeletes(trackerId);
        this.registry.histories[trackerId] = history;
        this.persistRegistry();
        this.openHistoryIds.add(trackerId);
        this.renderSection(tracker.section);
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
        Object.keys(CUSTOM_TRACKER_SECTIONS).forEach(sectionKey => {
            this.renderSection(sectionKey);
        });
    }

    renderManager() {
        if (!this.managerSummary) return;

        this.managerSummary.innerHTML = Object.entries(CUSTOM_TRACKER_SECTIONS)
            .map(([sectionKey, section]) => {
                const active = this.registry.trackers
                    .filter(tracker => tracker.section === sectionKey && !tracker.archived)
                    .sort((a, b) => (
                        a.subsection.localeCompare(b.subsection)
                        || a.order - b.order
                        || a.name.localeCompare(b.name, 'es')
                    ));
                const archived = this.registry.trackers
                    .filter(tracker => tracker.section === sectionKey && tracker.archived)
                    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
                const activeLabel = `${active.length} ${active.length === 1 ? 'activa' : 'activas'}`;
                const archivedLabel = archived.length > 0
                    ? ` · ${archived.length} ${archived.length === 1 ? 'archivada' : 'archivadas'}`
                    : '';

                return `
                    <section class="custom-manager-section" data-manager-section="${sectionKey}">
                        <div class="custom-manager-section-header">
                            <div>
                                <span class="custom-manager-section-icon">
                                    <i class="ph ${section.defaultIcon}"></i>
                                </span>
                                <span>
                                    <h3>${escapeHtml(section.label)}</h3>
                                    <small>${activeLabel}${archivedLabel}</small>
                                </span>
                            </div>
                            <button type="button" class="custom-manager-add" data-custom-manager-action="new" data-section="${sectionKey}" aria-label="Crear tarjeta en ${escapeHtml(section.label)}">
                                <i class="ph ph-plus"></i>
                            </button>
                        </div>
                        <div class="custom-manager-list">
                            ${active.length > 0
                                ? active.map(tracker => (
                                    this.renderManagerActiveRow(tracker, active)
                                )).join('')
                                : `
                                    <p class="custom-manager-empty">
                                        Sin tarjetas personalizadas en esta sección.
                                    </p>
                                `}
                            ${archived.length > 0 ? `
                                <div class="custom-manager-archived-label">
                                    <i class="ph ph-archive"></i>
                                    Archivadas
                                </div>
                                ${archived.map(tracker => (
                                    this.renderManagerArchivedRow(tracker)
                                )).join('')}
                            ` : ''}
                        </div>
                    </section>
                `;
            })
            .join('');
    }

    renderManagerActiveRow(tracker, sectionTrackers) {
        const subsection = CUSTOM_TRACKER_SECTIONS[tracker.section]
            ?.subsections?.[tracker.subsection];
        const sameDestination = sectionTrackers.filter(item => (
            item.subsection === tracker.subsection
        ));
        const destinationIndex = sameDestination.findIndex(item => item.id === tracker.id);
        return `
            <div class="custom-manager-row">
                <div class="custom-manager-row-name">
                    <i class="ph ${tracker.icon}"></i>
                    <span>
                        <strong>${escapeHtml(tracker.name)}</strong>
                        <small>${escapeHtml(subsection?.label || '')}</small>
                    </span>
                </div>
                <div class="custom-manager-row-actions">
                    <button type="button" data-custom-manager-action="move-up" data-tracker-id="${tracker.id}" ${destinationIndex <= 0 ? 'disabled' : ''} aria-label="Subir ${escapeHtml(tracker.name)}">
                        <i class="ph ph-arrow-up"></i>
                    </button>
                    <button type="button" data-custom-manager-action="move-down" data-tracker-id="${tracker.id}" ${destinationIndex === sameDestination.length - 1 ? 'disabled' : ''} aria-label="Bajar ${escapeHtml(tracker.name)}">
                        <i class="ph ph-arrow-down"></i>
                    </button>
                    <button type="button" data-custom-manager-action="edit" data-tracker-id="${tracker.id}" aria-label="Editar ${escapeHtml(tracker.name)}">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button type="button" data-custom-manager-action="archive" data-tracker-id="${tracker.id}" aria-label="Archivar ${escapeHtml(tracker.name)}">
                        <i class="ph ph-archive"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderManagerArchivedRow(tracker) {
        const awaitingConfirmation = this.pendingDeleteIds.has(tracker.id);
        return `
            <div class="custom-manager-row archived">
                <div class="custom-manager-row-name">
                    <i class="ph ${tracker.icon}"></i>
                    <span>
                        <strong>${escapeHtml(tracker.name)}</strong>
                        <small>Historial conservado</small>
                    </span>
                </div>
                <div class="custom-manager-row-actions ${awaitingConfirmation ? 'confirming' : ''}">
                    <button type="button" data-custom-manager-action="restore" data-tracker-id="${tracker.id}" aria-label="Restaurar ${escapeHtml(tracker.name)}">
                        <i class="ph ph-arrow-counter-clockwise"></i>
                    </button>
                    ${awaitingConfirmation ? `
                        <button type="button" class="text-action" data-custom-manager-action="cancel-delete" data-tracker-id="${tracker.id}">
                            Cancelar
                        </button>
                        <button type="button" class="text-action danger" data-custom-manager-action="confirm-delete" data-tracker-id="${tracker.id}">
                            Borrar
                        </button>
                    ` : `
                        <button type="button" class="danger" data-custom-manager-action="request-delete" data-tracker-id="${tracker.id}" aria-label="Borrar definitivamente ${escapeHtml(tracker.name)}">
                            <i class="ph ph-trash"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    clearRuntimeCards(sectionKey) {
        const section = CUSTOM_TRACKER_SECTIONS[sectionKey];
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
        const section = CUSTOM_TRACKER_SECTIONS[sectionKey];
        if (!section) return;
        this.clearRuntimeCards(sectionKey);

        let active = this.registry.trackers
            .filter(tracker => tracker.section === sectionKey && !tracker.archived);
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

        Object.entries(grouped).forEach(([subsectionKey, trackers]) => {
            const hostId = section.subsections[subsectionKey]?.hostId;
            const host = hostId ? document.getElementById(hostId) : null;
            if (!host) return;

            trackers
                .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'))
                .forEach(tracker => {
                    host.insertAdjacentHTML('beforeend', this.renderTrackerCard(tracker));
                });
        });
    }

    renderTrackerCard(tracker) {
        const history = this.getHistory(tracker.id);
        const state = getCustomTrackerState(tracker, history);
        const status = STATUS_META[state.status] || STATUS_META.new;
        const safeName = escapeHtml(tracker.name);
        const safeAction = escapeHtml(tracker.actionLabel);
        const instructionsOpen = this.openInstructionIds.has(tracker.id);
        const historyOpen = this.openHistoryIds.has(tracker.id);
        const latestLabel = state.latest
            ? DateUtils.formatFriendlyDate(state.latest)
            : 'Nunca';
        const nextLabel = state.nextDate
            ? DateUtils.formatFriendlyDate(state.nextDate)
            : 'Después del primer registro';

        return `
            <article class="custom-tracker-card status-${state.status}" data-tracker-id="${tracker.id}" data-custom-runtime-section="${tracker.section}" style="--custom-status-color: ${status.color};">
                <div class="custom-tracker-card-header">
                    <div class="custom-tracker-identity">
                        <span class="custom-tracker-icon"><i class="ph ${tracker.icon}"></i></span>
                        <div>
                            <h3>${safeName}</h3>
                            <span class="custom-tracker-status">${status.label}</span>
                        </div>
                    </div>
                </div>
                <div class="custom-tracker-metric">
                    <strong>${state.elapsedDays === null ? '--' : state.elapsedDays}</strong>
                    <span>de ${tracker.intervalDays} días</span>
                </div>
                <div class="custom-tracker-dates">
                    <span>Último <strong>${escapeHtml(latestLabel)}</strong></span>
                    <span>Próximo <strong>${escapeHtml(nextLabel)}</strong></span>
                </div>
                <div class="custom-tracker-progress" aria-hidden="true">
                    <span style="width: ${state.progress}%"></span>
                </div>
                ${tracker.instructions ? `
                    <button type="button" class="custom-tracker-secondary-action" data-custom-runtime-action="toggle-instructions" data-tracker-id="${tracker.id}" aria-expanded="${instructionsOpen}">
                        <i class="ph ph-book-open"></i>
                        ${instructionsOpen ? 'Ocultar instrucciones' : 'Ver instrucciones'}
                    </button>
                    <div class="custom-tracker-instructions ${instructionsOpen ? '' : 'hidden'}">
                        ${escapeHtml(tracker.instructions).replace(/\n/g, '<br>')}
                    </div>
                ` : ''}
                <button type="button" class="custom-tracker-secondary-action" data-custom-runtime-action="toggle-history" data-tracker-id="${tracker.id}" aria-expanded="${historyOpen}">
                    <i class="ph ph-clock-counter-clockwise"></i>
                    Historial (${history.length})
                </button>
                <div class="custom-tracker-history ${historyOpen ? '' : 'hidden'}">
                    ${history.length > 0 ? `
                        <div class="custom-tracker-history-toolbar">
                            <span>Últimos registros</span>
                            <button type="button" data-custom-runtime-action="edit-latest" data-tracker-id="${tracker.id}">
                                Editar última fecha
                            </button>
                        </div>
                        <ol>
                            ${history.slice(0, 10).map((date, historyIndex) => {
                                const confirmationKey = this.getHistoryDeleteKey(
                                    tracker.id,
                                    historyIndex
                                );
                                const awaitingConfirmation = (
                                    this.pendingHistoryDeleteKeys.has(confirmationKey)
                                );
                                return `
                                    <li class="${awaitingConfirmation ? 'custom-history-delete-pending' : ''}">
                                        <span>${escapeHtml(DateUtils.formatDateTime(date))}</span>
                                        ${awaitingConfirmation ? `
                                            <span class="custom-history-delete-actions">
                                                <button type="button" data-custom-runtime-action="cancel-delete-history" data-tracker-id="${tracker.id}" data-history-index="${historyIndex}">
                                                    Cancelar
                                                </button>
                                                <button type="button" class="danger" data-custom-runtime-action="confirm-delete-history" data-tracker-id="${tracker.id}" data-history-index="${historyIndex}">
                                                    Borrar
                                                </button>
                                            </span>
                                        ` : `
                                            <button type="button" data-custom-runtime-action="request-delete-history" data-tracker-id="${tracker.id}" data-history-index="${historyIndex}" aria-label="Borrar registro de ${safeName}">
                                                <i class="ph ph-trash"></i>
                                            </button>
                                        `}
                                    </li>
                                `;
                            }).join('')}
                        </ol>
                    ` : '<p>Sin registros todavía.</p>'}
                </div>
                <button type="button" class="btn btn-primary custom-tracker-record" data-custom-runtime-action="record" data-tracker-id="${tracker.id}">
                    <i class="ph ph-check-circle"></i>
                    ${safeAction}
                </button>
            </article>
        `;
    }
}
