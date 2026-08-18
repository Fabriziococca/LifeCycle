import { ALERT_DEFINITIONS, CATEGORY_NAMES } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import {
    buildRecurringReminderDefinitions,
    createRecurringReminderId,
    describeRecurringSchedule,
    migrateRecurringReminderConfigs,
    normalizeRecurringSchedule,
    normalizeRecurringReminderRegistry,
    RECURRING_REMINDERS_FIELD,
    removeRecurringReminder,
    upsertRecurringReminder
} from '../recurring-reminder-utils.mjs?v=20260801-recurring-reminders';

const EARNINGS_SEASON_REMINDER_PRESET = Object.freeze([
    Object.freeze({
        id: 'earnings_season_q4',
        name: 'Temporada de balances Q4 / Cierre anual',
        title: '📊 Temporada de balances Q4',
        body: 'Comienza la ventana orientativa de resultados Q4 y cierres anuales. Revisá las fechas oficiales de cada empresa.',
        month: 1,
        day: 15
    }),
    Object.freeze({
        id: 'earnings_season_q1',
        name: 'Temporada de balances Q1',
        title: '📊 Temporada de balances Q1',
        body: 'Comienza la ventana orientativa de resultados Q1. Revisá las fechas oficiales de cada empresa.',
        month: 4,
        day: 15
    }),
    Object.freeze({
        id: 'earnings_season_q2',
        name: 'Temporada de balances Q2',
        title: '📊 Temporada de balances Q2',
        body: 'Comienza la ventana orientativa de resultados Q2. Revisá las fechas oficiales de cada empresa.',
        month: 7,
        day: 15
    }),
    Object.freeze({
        id: 'earnings_season_q3',
        name: 'Temporada de balances Q3',
        title: '📊 Temporada de balances Q3',
        body: 'Comienza la ventana orientativa de resultados Q3. Revisá las fechas oficiales de cada empresa.',
        month: 10,
        day: 15
    })
]);

export class AlertsModule {
    constructor(appController) {
        this.app = appController;
        this.configs = {};
        this.activeCategory = this.app.uiState?.alertsCategory || 'higiene';
        this.editingRecurringReminderId = null;
        this.reminderModalReturnFocus = null;
        window.alertsManager = this;
        this.loadData();
    }

    getDefinitions() {
        const trackerDefinitions = this.app.customTrackers?.getAlertDefinitions?.() || [];
        const vehicleDefinitions = this.app.vehicle?.getAlertDefinitions?.() || [];
        const managedKeys = new Set([
            ...(this.app.customTrackers?.getManagedAlertKeys?.()
                || trackerDefinitions.map(definition => definition.key)),
            ...(this.app.vehicle?.getManagedAlertKeys?.()
                || vehicleDefinitions.map(definition => definition.key))
        ]);
        return [
            ...ALERT_DEFINITIONS.filter(definition => (
                definition.type !== 'recurring'
                && !managedKeys.has(definition.key)
            )),
            ...buildRecurringReminderDefinitions(this.configs),
            ...trackerDefinitions,
            ...vehicleDefinitions
        ];
    }

    loadData() {
        try {
            const localVal = localStorage.getItem('alerts_config');
            let storedConfigs = {};
            if (localVal) {
                const parsedConfigs = JSON.parse(localVal);
                storedConfigs = this.app.vehicle?.migrateAlertConfigs?.(
                    parsedConfigs
                ) || parsedConfigs;
            }

            let oldReminders = {};
            const oldGym = localStorage.getItem('gym_supplements');
            if (oldGym) {
                try {
                    oldReminders = JSON.parse(oldGym)?.custom_reminders || {};
                } catch (error) {
                    console.warn('No se pudieron migrar recordatorios antiguos del gimnasio:', error);
                }
            }

            const hadRecurringRegistry = Boolean(storedConfigs?.[RECURRING_REMINDERS_FIELD]);
            this.configs = migrateRecurringReminderConfigs(storedConfigs, {
                legacyGymReminders: oldReminders
            });

            const defaultConfigs = {};
            this.getDefinitions().forEach(def => {
                const config = {
                    enabled: def.defaultEnabled !== false,
                    time: def.defaultTime,
                    schedule: def.type === 'recurring'
                        ? normalizeRecurringSchedule(
                            def.defaultSchedule || { type: 'weekly', days: def.defaultDays || [] }
                        )
                        : undefined,
                    days: def.defaultDays || []
                };
                if (def.key === 'robot' || def.repeatWhileActive) {
                    config.interval_hours = def.intervalHours || 6;
                }
                if (def.key === 'very_urgent_tasks') config.interval_hours = 4;
                defaultConfigs[def.key] = config;
            });
            Object.keys(defaultConfigs).forEach(key => {
                const storedConfig = this.configs[key] && typeof this.configs[key] === 'object'
                    ? this.configs[key]
                    : {};
                this.configs[key] = {
                    ...defaultConfigs[key],
                    ...storedConfig,
                    schedule: defaultConfigs[key].schedule
                        ? normalizeRecurringSchedule(
                            storedConfig.schedule || (
                                Array.isArray(storedConfig.days)
                                    ? { type: 'weekly', days: storedConfig.days }
                                    : null
                            ),
                            defaultConfigs[key].schedule
                        )
                        : storedConfig.schedule,
                    days: Array.isArray(storedConfig.days)
                        ? storedConfig.days
                        : defaultConfigs[key].days
                };
            });
            this.saveData();
            if (localVal && !hadRecurringRegistry) {
                queueMicrotask(() => this.app.triggerDataSync?.('alerts_config'));
            }
        } catch (err) {
            console.error('Error al cargar configuraciones de alertas:', err);
        }
    }

    saveData() {
        localStorage.setItem('alerts_config', JSON.stringify(this.configs));
    }

    setupListeners() {
        const container = document.getElementById('alerts-categories-container');
        if (container) {
            container.onclick = (e) => {
                const actionButton = e.target.closest('[data-recurring-reminder-action]');
                if (actionButton) {
                    const reminderId = actionButton.dataset.reminderId;
                    if (actionButton.dataset.recurringReminderAction === 'edit') {
                        this.openRecurringReminderEditor(reminderId, actionButton);
                    } else if (actionButton.dataset.recurringReminderAction === 'delete') {
                        void this.deleteRecurringReminder(reminderId);
                    }
                    return;
                }
                const dayBtn = e.target.closest('.day-btn[data-day]');
                if (dayBtn) {
                    dayBtn.classList.toggle('active');
                    dayBtn.setAttribute(
                        'aria-pressed',
                        String(dayBtn.classList.contains('active'))
                    );
                }
            };
        }

        const tabsNav = document.getElementById('alerts-category-tabs');
        if (tabsNav) {
            tabsNav.onclick = (e) => {
                const tabBtn = e.target.closest('.alerts-tab-btn[data-category]');
                if (tabBtn) {
                    this.saveCurrentCategoryUIState();
                    this.activeCategory = tabBtn.dataset.category;
                    this.app.saveUiState?.({ alertsCategory: this.activeCategory });
                    this.renderTabs();
                    this.renderContent();
                }
            };
        }

        const saveBtn = document.getElementById('btn-save-all-alerts');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                this.saveFromUI();
            };
        }

        const newReminderButton = document.getElementById('btn-new-recurring-reminder');
        if (newReminderButton) {
            newReminderButton.onclick = () => this.openRecurringReminderEditor(null, newReminderButton);
        }
        const earningsSeasonButton = document.getElementById('btn-add-earnings-season-reminders');
        if (earningsSeasonButton) {
            earningsSeasonButton.onclick = () => {
                void this.addEarningsSeasonReminderPreset(earningsSeasonButton);
            };
        }

        const reminderModal = document.getElementById('recurring-reminder-modal');
        const reminderForm = document.getElementById('recurring-reminder-form');
        const closeButtons = reminderModal?.querySelectorAll('[data-recurring-reminder-close]') || [];
        closeButtons.forEach(button => {
            button.onclick = () => this.closeRecurringReminderEditor();
        });
        if (reminderModal) {
            reminderModal.onclick = event => {
                if (event.target === reminderModal) this.closeRecurringReminderEditor();
            };
            reminderModal.onkeydown = event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.closeRecurringReminderEditor();
                    return;
                }
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    this.saveRecurringReminderFromEditor();
                    return;
                }
                if (event.key === 'Tab') {
                    const focusable = [...reminderModal.querySelectorAll(
                        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
                    )].filter(element => element.offsetParent !== null);
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
            };
        }
        const reminderDays = document.getElementById('recurring-reminder-days');
        if (reminderDays) {
            reminderDays.onclick = event => {
                const dayButton = event.target.closest('.day-btn[data-day]');
                if (!dayButton) return;
                dayButton.classList.toggle('active');
                dayButton.setAttribute('aria-pressed', String(dayButton.classList.contains('active')));
            };
        }
        const reminderFrequency = document.getElementById('recurring-reminder-frequency');
        if (reminderFrequency) {
            reminderFrequency.onchange = () => {
                this.updateRecurringScheduleFields(reminderFrequency.value);
            };
        }
        if (reminderForm) {
            reminderForm.onsubmit = event => {
                event.preventDefault();
                this.saveRecurringReminderFromEditor();
            };
        }
    }

    getRecurringReminderRegistry() {
        return normalizeRecurringReminderRegistry(
            this.configs?.[RECURRING_REMINDERS_FIELD]
        );
    }

    getRecurringReminder(reminderId) {
        return this.getRecurringReminderRegistry().reminders
            .find(reminder => reminder.id === reminderId) || null;
    }

    updateRecurringScheduleFields(type) {
        const normalizedType = ['weekly', 'monthly', 'yearly'].includes(type)
            ? type
            : 'weekly';
        document.querySelectorAll('[data-recurring-schedule-fields]').forEach(element => {
            element.classList.toggle(
                'hidden',
                element.dataset.recurringScheduleFields !== normalizedType
            );
        });
    }

    readRecurringScheduleFromEditor() {
        const type = document.getElementById('recurring-reminder-frequency')?.value || 'weekly';
        if (type === 'monthly') {
            return normalizeRecurringSchedule({
                type,
                day: Number(document.getElementById('recurring-reminder-month-day')?.value)
            });
        }
        if (type === 'yearly') {
            return normalizeRecurringSchedule({
                type,
                month: Number(document.getElementById('recurring-reminder-year-month')?.value),
                day: Number(document.getElementById('recurring-reminder-year-day')?.value)
            });
        }
        return normalizeRecurringSchedule({
            type: 'weekly',
            days: [...document.querySelectorAll('#recurring-reminder-days .day-btn.active')]
                .map(button => Number(button.dataset.day))
        });
    }

    async addEarningsSeasonReminderPreset(trigger = null) {
        this.saveCurrentCategoryUIState();
        const existingIds = new Set(
            this.getRecurringReminderRegistry().reminders.map(reminder => reminder.id)
        );
        const missing = EARNINGS_SEASON_REMINDER_PRESET.filter(item => !existingIds.has(item.id));
        if (missing.length === 0) {
            this.activeCategory = 'trading';
            this.app.saveUiState?.({ alertsCategory: 'trading' });
            this.render();
            this.app.showToast?.('Las cuatro temporadas de balances ya están configuradas.');
            return;
        }

        const confirmed = await this.app.confirmAction({
            title: 'Agregar temporadas de balances',
            message: 'Se crearán avisos anuales orientativos. Podrás editar sus fechas y mensajes individualmente desde Recordatorios.',
            tone: 'info',
            details: missing.map(item => ({
                label: item.name,
                value: `${String(item.day).padStart(2, '0')}/${String(item.month).padStart(2, '0')} · 10:00`
            })),
            cancelLabel: 'Cancelar',
            confirmLabel: missing.length === 4 ? 'Crear 4 recordatorios' : `Crear ${missing.length} pendientes`,
            closeOnBackdrop: false
        });
        if (!confirmed) {
            trigger?.focus?.();
            return;
        }

        missing.forEach(item => {
            this.configs = upsertRecurringReminder(this.configs, {
                id: item.id,
                name: item.name,
                category: 'trading',
                title: item.title,
                body: item.body,
                time: '10:00',
                schedule: {
                    type: 'yearly',
                    month: item.month,
                    day: item.day
                }
            });
        });
        this.activeCategory = 'trading';
        this.app.saveUiState?.({ alertsCategory: 'trading' });
        this.saveData();
        this.app.triggerDataSync?.('alerts_config');
        this.render();
        this.app.showToast?.(
            missing.length === 4
                ? 'Temporadas de balances agregadas.'
                : 'Se agregaron las temporadas que faltaban.'
        );
    }

    openRecurringReminderEditor(reminderId = null, trigger = null) {
        this.saveCurrentCategoryUIState();
        const modal = document.getElementById('recurring-reminder-modal');
        const form = document.getElementById('recurring-reminder-form');
        if (!modal || !form) return;

        const reminder = reminderId ? this.getRecurringReminder(reminderId) : null;
        const config = reminder ? (this.configs[reminder.id] || {}) : {};
        this.editingRecurringReminderId = reminder?.id || null;
        this.reminderModalReturnFocus = trigger || document.activeElement;

        document.getElementById('recurring-reminder-modal-title').textContent = reminder
            ? 'Editar recordatorio'
            : 'Nuevo recordatorio';
        document.getElementById('recurring-reminder-name').value = reminder?.name || '';
        document.getElementById('recurring-reminder-category').value = reminder?.category || 'otros';
        document.getElementById('recurring-reminder-title').value = reminder?.title || '';
        document.getElementById('recurring-reminder-body').value = reminder?.body || '';
        document.getElementById('recurring-reminder-time').value = config.time || reminder?.defaultTime || '09:00';
        document.getElementById('recurring-reminder-enabled').checked = config.enabled ?? true;
        const schedule = normalizeRecurringSchedule(
            config.schedule || (
                Array.isArray(config.days) ? { type: 'weekly', days: config.days } : null
            ),
            reminder?.defaultSchedule || {
                type: 'weekly',
                days: reminder?.defaultDays || [1, 2, 3, 4, 5, 6, 0]
            }
        );
        document.getElementById('recurring-reminder-frequency').value = schedule.type;
        document.getElementById('recurring-reminder-month-day').value = String(
            schedule.type === 'monthly' ? schedule.day : 1
        );
        document.getElementById('recurring-reminder-year-month').value = String(
            schedule.type === 'yearly' ? schedule.month : 1
        );
        document.getElementById('recurring-reminder-year-day').value = String(
            schedule.type === 'yearly' ? schedule.day : 1
        );
        this.updateRecurringScheduleFields(schedule.type);
        const selectedDays = new Set(
            schedule.type === 'weekly' ? schedule.days : [1, 2, 3, 4, 5, 6, 0]
        );
        document.querySelectorAll('#recurring-reminder-days .day-btn[data-day]').forEach(button => {
            const selected = selectedDays.has(Number(button.dataset.day));
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        const error = document.getElementById('recurring-reminder-error');
        error.textContent = '';
        error.classList.add('hidden');
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => document.getElementById('recurring-reminder-name')?.focus());
    }

    closeRecurringReminderEditor({ restoreFocus = true } = {}) {
        document.getElementById('recurring-reminder-modal')?.classList.add('hidden');
        if (!document.querySelector('.modal:not(.hidden), .custom-tracker-dialog:not(.hidden)')) {
            document.body.classList.remove('modal-open');
        }
        if (restoreFocus && this.reminderModalReturnFocus?.isConnected) {
            requestAnimationFrame(() => this.reminderModalReturnFocus.focus());
        }
        this.editingRecurringReminderId = null;
        this.reminderModalReturnFocus = null;
    }

    saveRecurringReminderFromEditor() {
        const name = document.getElementById('recurring-reminder-name')?.value.trim() || '';
        const body = document.getElementById('recurring-reminder-body')?.value.trim() || '';
        const error = document.getElementById('recurring-reminder-error');
        if (!name || !body) {
            error.textContent = 'Completá el nombre y el mensaje del recordatorio.';
            error.classList.remove('hidden');
            return;
        }

        const wasEditing = Boolean(this.editingRecurringReminderId);
        const registry = this.getRecurringReminderRegistry();
        const reminderId = this.editingRecurringReminderId || createRecurringReminderId(
            name,
            registry.reminders.map(reminder => reminder.id)
        );
        const frequency = document.getElementById('recurring-reminder-frequency')?.value || 'weekly';
        const monthlyDay = Number(document.getElementById('recurring-reminder-month-day')?.value);
        const yearlyMonth = Number(document.getElementById('recurring-reminder-year-month')?.value);
        const yearlyDay = Number(document.getElementById('recurring-reminder-year-day')?.value);
        if (
            (frequency === 'monthly' && (!Number.isInteger(monthlyDay) || monthlyDay < 1 || monthlyDay > 31))
            || (
                frequency === 'yearly'
                && (
                    !Number.isInteger(yearlyMonth)
                    || yearlyMonth < 1
                    || yearlyMonth > 12
                    || !Number.isInteger(yearlyDay)
                    || yearlyDay < 1
                    || yearlyDay > 31
                )
            )
        ) {
            error.textContent = 'Elegí una fecha válida para la frecuencia seleccionada.';
            error.classList.remove('hidden');
            return;
        }
        const schedule = this.readRecurringScheduleFromEditor();
        if (schedule.type === 'weekly' && schedule.days.length === 0) {
            error.textContent = 'Elegí al menos un día activo.';
            error.classList.remove('hidden');
            return;
        }

        const category = document.getElementById('recurring-reminder-category').value;
        const time = document.getElementById('recurring-reminder-time').value;
        this.configs = upsertRecurringReminder(this.configs, {
            id: reminderId,
            name,
            category,
            title: document.getElementById('recurring-reminder-title').value.trim() || `⏰ ${name}`,
            body,
            time,
            schedule
        });
        this.configs[reminderId].enabled = document.getElementById('recurring-reminder-enabled').checked;
        this.activeCategory = category;
        this.app.saveUiState?.({ alertsCategory: category });
        this.saveData();
        this.app.triggerDataSync?.('alerts_config');
        this.closeRecurringReminderEditor({ restoreFocus: false });
        this.render();
        this.app.showToast?.(
            wasEditing ? 'Recordatorio actualizado.' : 'Recordatorio creado.'
        );
    }

    async deleteRecurringReminder(reminderId) {
        const reminder = this.getRecurringReminder(reminderId);
        if (!reminder) return;
        const confirmed = await this.app.confirmAction({
            title: 'Eliminar recordatorio',
            message: `Se eliminará “${reminder.name}” y su programación. Esta acción no afecta las tarjetas ni otros avisos.`,
            confirmLabel: 'Eliminar',
            tone: 'danger'
        });
        if (!confirmed) return;

        const previousConfigs = this.configs;
        this.configs = removeRecurringReminder(this.configs, reminderId);
        this.saveData();
        this.app.triggerDataSync?.('alerts_config');
        this.render();
        this.app.showUndo?.('Recordatorio eliminado.', () => {
            this.configs = previousConfigs;
            this.saveData();
            this.app.triggerDataSync?.('alerts_config');
            this.render();
        });
    }

    saveCurrentCategoryUIState() {
        const rows = document.querySelectorAll('.alert-card-item[data-alert-key], .alert-config-row[data-alert-key]');
        rows.forEach(row => {
            const key = row.dataset.alertKey;
            const enabledInput = row.querySelector('.alert-enabled-check');
            const timeInput = row.querySelector('.alert-time-input');
            const dayBtns = row.querySelectorAll('.day-btn.active');
            const intervalInput = row.querySelector('.alert-interval-input');

            const days = Array.from(dayBtns).map(btn => parseInt(btn.dataset.day));
            const prevConfig = this.configs[key] || {};
            const scheduleType = row.dataset.recurringScheduleType;
            const previousSchedule = scheduleType
                ? normalizeRecurringSchedule(
                    prevConfig.schedule || { type: 'weekly', days: prevConfig.days || [] }
                )
                : null;
            const schedule = previousSchedule?.type === 'weekly'
                ? normalizeRecurringSchedule({ type: 'weekly', days })
                : previousSchedule;

            const nextConfig = {
                enabled: enabledInput ? enabledInput.checked : false,
                time: timeInput ? timeInput.value : (prevConfig.time || '23:00'),
                ...(schedule ? { schedule } : {}),
                days: schedule?.type === 'weekly' ? [...schedule.days] : days
            };
            if (intervalInput) {
                const fallback = key === 'very_urgent_tasks' ? 4 : 6;
                nextConfig.interval_hours = Math.min(
                    48,
                    Math.max(1, parseInt(intervalInput.value, 10) || fallback)
                );
            } else if (prevConfig.interval_hours !== undefined) {
                nextConfig.interval_hours = prevConfig.interval_hours;
            }
            this.configs[key] = nextConfig;
        });
    }

    saveFromUI() {
        this.saveCurrentCategoryUIState();
        this.saveData();
        
        if (navigator.vibrate) navigator.vibrate(50);
        
        if (this.app.auth) {
            this.app.auth.syncToCloud(true).catch(() => {});
        } else {
            this.app.showToast('Configuraciones de alertas guardadas.');
        }

        this.renderContent();
    }

    renderTabs() {
        const tabsNav = document.getElementById('alerts-category-tabs');
        if (!tabsNav) return;

        let html = '';
        const definitions = this.getDefinitions();
        const availableCategories = Object.keys(CATEGORY_NAMES).filter(cat => (
            definitions.some(definition => definition.category === cat)
        ));
        if (!availableCategories.includes(this.activeCategory)) {
            this.activeCategory = availableCategories[0] || 'higiene';
            this.app.saveUiState?.({ alertsCategory: this.activeCategory });
        }
        Object.keys(CATEGORY_NAMES).forEach(cat => {
            const count = definitions.filter(d => d.category === cat).length;
            if (count === 0) return;
            const isActive = this.activeCategory === cat;

            html += `
                <button type="button" class="alerts-tab-btn ${isActive ? 'active' : ''}" data-category="${cat}" aria-pressed="${isActive}">
                    <span>${CATEGORY_NAMES[cat]}</span>
                    <span style="background: rgba(255,255,255,0.15); padding: 1px 7px; border-radius: 10px; font-size: 0.75rem;">${count}</span>
                </button>
            `;
        });

        tabsNav.innerHTML = html;
    }

    renderContent() {
        const container = document.getElementById('alerts-categories-container');
        if (!container) return;

        container.innerHTML = '';

        const list = this.getDefinitions().filter(def => def.category === this.activeCategory);

        if (list.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No hay alertas en esta categoría.</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'alerts-grid';

        list.forEach(def => {
            const conf = this.configs[def.key] || { enabled: true, time: def.defaultTime, days: def.defaultDays || [] };
            const isRecurring = def.type === 'recurring';
            const schedule = isRecurring
                ? normalizeRecurringSchedule(
                    conf.schedule || { type: 'weekly', days: conf.days || def.defaultDays || [] },
                    def.defaultSchedule
                )
                : null;
            const safeName = escapeHtml(def.name);
            const dayButtons = [
                [1, 'L', 'Lunes'],
                [2, 'M', 'Martes'],
                [3, 'M', 'Miércoles'],
                [4, 'J', 'Jueves'],
                [5, 'V', 'Viernes'],
                [6, 'S', 'Sábado'],
                [0, 'D', 'Domingo']
            ].map(([day, shortName, fullName]) => {
                const isActive = schedule?.type === 'weekly' && schedule.days.includes(day);
                return `<button type="button" class="day-btn ${isActive ? 'active' : ''}" data-day="${day}" aria-label="${fullName}" aria-pressed="${isActive}">${shortName}</button>`;
            }).join('');

            const card = document.createElement('div');
            card.className = 'alert-card-item';
            card.dataset.alertKey = def.key;
            if (schedule) card.dataset.recurringScheduleType = schedule.type;

            card.innerHTML = `
                <div class="alert-card-header">
                    <div class="alert-card-title">${safeName}</div>
                    <div class="alert-card-header-actions">
                        ${def.recurringReminder ? `
                            <button
                                type="button"
                                class="alert-card-icon-action"
                                data-recurring-reminder-action="edit"
                                data-reminder-id="${def.key}"
                                aria-label="Editar recordatorio ${safeName}"
                                data-tooltip="Editar recordatorio"
                            ><i class="ph ph-pencil-simple"></i></button>
                            <button
                                type="button"
                                class="alert-card-icon-action is-danger"
                                data-recurring-reminder-action="delete"
                                data-reminder-id="${def.key}"
                                aria-label="Eliminar recordatorio ${safeName}"
                                data-tooltip="Eliminar recordatorio"
                            ><i class="ph ph-trash"></i></button>
                        ` : ''}
                        <label class="custom-checkbox-container alert-card-enabled-toggle">
                            <input type="checkbox" class="alert-enabled-check" aria-label="Activar alerta de ${safeName}" ${conf.enabled ? 'checked' : ''}>
                            <span class="custom-checkbox"></span>
                        </label>
                    </div>
                </div>
                <div class="alert-card-controls">
                    ${(def.key === 'robot' || def.key === 'very_urgent_tasks' || def.repeatWhileActive) ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);" title="Frecuencia de repetición dinámica mientras esté pendiente/sucio">Repetir cada:</span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <input type="number" class="alert-interval-input" min="1" max="48" value="${conf.interval_hours || def.intervalHours || (def.key === 'very_urgent_tasks' ? 4 : 6)}" aria-label="Horas entre alertas de ${safeName}" style="width: 60px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--surface-border); background: rgba(0,0,0,0.3); color: white; font-size: 0.85rem; text-align: center;">
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">hs</span>
                        </div>
                    </div>
                    ` : `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Hora de push:</span>
                        <input type="time" class="alert-time-input" value="${conf.time}" aria-label="Hora de alerta de ${safeName}" style="width: 95px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--surface-border); background: rgba(0,0,0,0.3); color: white; font-size: 0.85rem;">
                    </div>
                    `}
                    ${isRecurring && schedule.type === 'weekly' ? `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                        <span style="font-size: 0.78rem; color: var(--text-secondary);">Días activos:</span>
                        <div class="day-selectors">
                            ${dayButtons}
                        </div>
                    </div>
                    ` : (isRecurring ? `
                    <div class="alert-recurring-schedule-summary">
                        <i class="ph ph-calendar-dots" aria-hidden="true"></i>
                        <span>${escapeHtml(describeRecurringSchedule(schedule))}</span>
                    </div>
                    ` : '')}
                </div>
            `;

            grid.appendChild(card);
        });

        container.appendChild(grid);
    }

    render() {
        this.renderTabs();
        this.renderContent();
        this.setupListeners();
    }
}
