import { ALERT_DEFINITIONS, CATEGORY_NAMES } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

export class AlertsModule {
    constructor(appController) {
        this.app = appController;
        this.configs = {};
        this.activeCategory = 'higiene'; // Categoría inicial por defecto (SIN opción "Todas")
        window.alertsManager = this;
        this.loadData();
    }

    getDefinitions() {
        const trackerDefinitions = this.app.customTrackers?.getAlertDefinitions?.() || [];
        const trackerKeys = this.app.customTrackers?.getManagedAlertKeys?.()
            || new Set(trackerDefinitions.map(definition => definition.key));
        return [
            ...ALERT_DEFINITIONS.filter(definition => !trackerKeys.has(definition.key)),
            ...trackerDefinitions
        ];
    }

    loadData() {
        try {
            const defaultConfigs = {};
            this.getDefinitions().forEach(def => {
                const config = {
                    enabled: def.defaultEnabled !== false,
                    time: def.defaultTime,
                    days: def.defaultDays || []
                };
                if (def.key === 'robot') config.interval_hours = 6;
                if (def.key === 'very_urgent_tasks') config.interval_hours = 4;
                defaultConfigs[def.key] = config;
            });

            const localVal = localStorage.getItem('alerts_config');
            if (localVal) {
                const storedConfigs = JSON.parse(localVal);
                this.configs = { ...storedConfigs };
                Object.keys(defaultConfigs).forEach(key => {
                    const storedConfig = storedConfigs[key] && typeof storedConfigs[key] === 'object'
                        ? storedConfigs[key]
                        : {};
                    this.configs[key] = {
                        ...defaultConfigs[key],
                        ...storedConfig,
                        days: Array.isArray(storedConfig.days)
                            ? storedConfig.days
                            : defaultConfigs[key].days
                    };
                });
                this.saveData();
            } else {
                const oldGym = localStorage.getItem('gym_supplements');
                if (oldGym) {
                    try {
                        const parsedGym = JSON.parse(oldGym);
                        const oldReminders = parsedGym.custom_reminders;
                        if (oldReminders) {
                            ['creatine', 'salmon', 'neck', 'weigh_in', 'laundry'].forEach(key => {
                                if (oldReminders[key]) {
                                    defaultConfigs[key] = {
                                        enabled: oldReminders[key].enabled ?? true,
                                        time: oldReminders[key].time || defaultConfigs[key].time,
                                        days: oldReminders[key].days || defaultConfigs[key].days
                                    };
                                }
                            });
                        }
                    } catch(e) {}
                }
                this.configs = defaultConfigs;
                this.saveData();
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

            const nextConfig = {
                enabled: enabledInput ? enabledInput.checked : false,
                time: timeInput ? timeInput.value : (prevConfig.time || '23:00'),
                days: days
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
                const isActive = conf.days.includes(day);
                return `<button type="button" class="day-btn ${isActive ? 'active' : ''}" data-day="${day}" aria-label="${fullName}" aria-pressed="${isActive}">${shortName}</button>`;
            }).join('');

            const card = document.createElement('div');
            card.className = 'alert-card-item';
            card.dataset.alertKey = def.key;

            card.innerHTML = `
                <div class="alert-card-header">
                    <div class="alert-card-title">${safeName}</div>
                    <label class="custom-checkbox-container" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="alert-enabled-check" aria-label="Activar alerta de ${safeName}" ${conf.enabled ? 'checked' : ''}>
                        <span class="custom-checkbox"></span>
                    </label>
                </div>
                <div class="alert-card-controls">
                    ${(def.key === 'robot' || def.key === 'very_urgent_tasks') ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);" title="Frecuencia de repetición dinámica mientras esté pendiente/sucio">Repetir cada:</span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <input type="number" class="alert-interval-input" min="1" max="48" value="${conf.interval_hours || (def.key === 'robot' ? 6 : 4)}" aria-label="Horas entre alertas de ${safeName}" style="width: 60px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--surface-border); background: rgba(0,0,0,0.3); color: white; font-size: 0.85rem; text-align: center;">
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">hs</span>
                        </div>
                    </div>
                    ` : `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Hora de push:</span>
                        <input type="time" class="alert-time-input" value="${conf.time}" aria-label="Hora de alerta de ${safeName}" style="width: 95px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--surface-border); background: rgba(0,0,0,0.3); color: white; font-size: 0.85rem;">
                    </div>
                    `}
                    ${isRecurring ? `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                        <span style="font-size: 0.78rem; color: var(--text-secondary);">Días activos:</span>
                        <div class="day-selectors">
                            ${dayButtons}
                        </div>
                    </div>
                    ` : ''}
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
