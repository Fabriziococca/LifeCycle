import { ALERT_DEFINITIONS, CATEGORY_NAMES } from '../utils.js';

export class AlertsModule {
    constructor(appController) {
        this.app = appController;
        this.configs = {};
        this.activeCategory = 'higiene'; // Categoría inicial por defecto (SIN opción "Todas")
        window.alertsManager = this;
        this.loadData();
    }

    loadData() {
        try {
            const defaultConfigs = {};
            ALERT_DEFINITIONS.forEach(def => {
                defaultConfigs[def.key] = {
                    enabled: true,
                    time: def.defaultTime,
                    days: def.defaultDays || []
                };
            });

            const localVal = localStorage.getItem('alerts_config');
            if (localVal) {
                this.configs = { ...defaultConfigs, ...JSON.parse(localVal) };
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

            const days = Array.from(dayBtns).map(btn => parseInt(btn.dataset.day));

            this.configs[key] = {
                enabled: enabledInput ? enabledInput.checked : false,
                time: timeInput ? timeInput.value : '23:00',
                days: days
            };
        });
    }

    saveFromUI() {
        this.saveCurrentCategoryUIState();
        this.saveData();
        
        if (navigator.vibrate) navigator.vibrate(50);
        
        if (this.app.auth) {
            this.app.auth.syncToCloud(true).catch(() => {});
        } else {
            alert('¡Configuraciones de alertas guardadas!');
        }

        this.renderContent();
    }

    renderTabs() {
        const tabsNav = document.getElementById('alerts-category-tabs');
        if (!tabsNav) return;

        let html = '';
        Object.keys(CATEGORY_NAMES).forEach(cat => {
            const count = ALERT_DEFINITIONS.filter(d => d.category === cat).length;
            if (count === 0) return;
            const isActive = this.activeCategory === cat;

            html += `
                <button class="alerts-tab-btn ${isActive ? 'active' : ''}" data-category="${cat}">
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

        const list = ALERT_DEFINITIONS.filter(def => def.category === this.activeCategory);

        if (list.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No hay alertas en esta categoría.</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'alerts-grid';

        list.forEach(def => {
            const conf = this.configs[def.key] || { enabled: true, time: def.defaultTime, days: def.defaultDays || [] };
            const isRecurring = def.type === 'recurring';

            const card = document.createElement('div');
            card.className = 'alert-card-item';
            card.dataset.alertKey = def.key;

            card.innerHTML = `
                <div class="alert-card-header">
                    <div class="alert-card-title">${def.name}</div>
                    <label class="custom-checkbox-container" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="alert-enabled-check" ${conf.enabled ? 'checked' : ''}>
                        <span class="custom-checkbox"></span>
                    </label>
                </div>
                <div class="alert-card-controls">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Hora de push:</span>
                        <input type="time" class="alert-time-input" value="${conf.time}" style="width: 95px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--surface-border); background: rgba(0,0,0,0.3); color: white; font-size: 0.85rem;">
                    </div>
                    ${isRecurring ? `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                        <span style="font-size: 0.78rem; color: var(--text-secondary);">Días activos:</span>
                        <div class="day-selectors" style="display: flex; gap: 3px; justify-content: space-between;">
                            <button class="day-btn ${conf.days.includes(1) ? 'active' : ''}" data-day="1" style="flex: 1; padding: 4px 0; font-size: 0.75rem;">L</button>
                            <button class="day-btn ${conf.days.includes(2) ? 'active' : ''}" data-day="2" style="flex: 1; padding: 4px 0; font-size: 0.75rem;">M</button>
                            <button class="day-btn ${conf.days.includes(3) ? 'active' : ''}" data-day="3" style="flex: 1; padding: 4px 0; font-size: 0.75rem;">M</button>
                            <button class="day-btn ${conf.days.includes(4) ? 'active' : ''}" data-day="4" style="flex: 1; padding: 4px 0; font-size: 0.75rem;">J</button>
                            <button class="day-btn ${conf.days.includes(5) ? 'active' : ''}" data-day="5" style="flex: 1; padding: 4px 0; font-size: 0.75rem;">V</button>
                            <button class="day-btn ${conf.days.includes(6) ? 'active' : ''}" data-day="6" style="flex: 1; padding: 4px 0; font-size: 0.75rem;">S</button>
                            <button class="day-btn ${conf.days.includes(0) ? 'active' : ''}" data-day="0" style="flex: 1; padding: 4px 0; font-size: 0.75rem;">D</button>
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
