import { ALERT_DEFINITIONS, CATEGORY_NAMES } from '../utils.js';

export class AlertsModule {
    constructor(appController) {
        this.app = appController;
        this.configs = {};
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
                // Intentar migrar configuraciones viejas de recordatorios personalizados de gimnasio
                const oldGym = localStorage.getItem('gym_supplements');
                if (oldGym) {
                    try {
                        const parsedGym = JSON.parse(oldGym);
                        const oldReminders = parsedGym.custom_reminders;
                        if (oldReminders) {
                            ['creatine', 'salmon', 'neck'].forEach(key => {
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
        if (!container) return;

        // Limpiar escuchadores duplicados delegando eventos
        container.onclick = (e) => {
            const dayBtn = e.target.closest('.day-btn[data-day]');
            if (dayBtn) {
                dayBtn.classList.toggle('active');
            }
        };

        const saveBtn = document.getElementById('btn-save-all-alerts');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                this.saveFromUI();
            };
        }
    }

    saveFromUI() {
        const rows = document.querySelectorAll('.alert-config-row[data-alert-key]');
        const newConfigs = {};

        rows.forEach(row => {
            const key = row.dataset.alertKey;
            const enabledInput = row.querySelector('.alert-enabled-check');
            const timeInput = row.querySelector('.alert-time-input');
            const dayBtns = row.querySelectorAll('.day-btn.active');

            const days = Array.from(dayBtns).map(btn => parseInt(btn.dataset.day));

            newConfigs[key] = {
                enabled: enabledInput ? enabledInput.checked : false,
                time: timeInput ? timeInput.value : '23:00',
                days: days
            };
        });

        this.configs = newConfigs;
        this.saveData();
        
        if (navigator.vibrate) navigator.vibrate(50);
        
        if (this.app.auth) {
            this.app.auth.syncToCloud(true).catch(() => {});
        } else {
            alert('¡Configuraciones guardadas localmente!');
        }

        // Renderizar nuevamente para refrescar visuales
        this.render();
    }

    render() {
        const container = document.getElementById('alerts-categories-container');
        if (!container) return;

        container.innerHTML = '';

        // Agrupar por categoría
        const grouped = {};
        Object.keys(CATEGORY_NAMES).forEach(cat => {
            grouped[cat] = ALERT_DEFINITIONS.filter(def => def.category === cat);
        });

        Object.keys(grouped).forEach(cat => {
            const list = grouped[cat];
            if (list.length === 0) return;

            const card = document.createElement('div');
            card.className = 'card';
            card.style.margin = '0';
            card.style.background = 'rgba(15, 23, 42, 0.4)';
            card.style.borderColor = 'rgba(255, 255, 255, 0.05)';

            let bodyHtml = `
                <div style="font-size: 1rem; font-weight: bold; color: var(--primary-color); margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                    ${CATEGORY_NAMES[cat]}
                </div>
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            `;

            list.forEach(def => {
                const conf = this.configs[def.key] || { enabled: true, time: def.defaultTime, days: def.defaultDays || [] };
                const isRecurring = def.type === 'recurring';

                bodyHtml += `
                    <div class="alert-config-row" data-alert-key="${def.key}" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); padding-bottom: 1.25rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <span style="font-size: 0.95rem; font-weight: 500; color: white;">${def.name}</span>
                            <label class="custom-checkbox-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                                <input type="checkbox" class="alert-enabled-check" ${conf.enabled ? 'checked' : ''}>
                                <span class="custom-checkbox"></span>
                                <span style="font-size: 0.8rem; color: var(--text-secondary);">Recibir push</span>
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <label style="font-size: 0.8rem; color: var(--text-secondary);">Notificar a las:</label>
                                <input type="time" class="alert-time-input" value="${conf.time}" style="width: 100px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--surface-border); background: rgba(0,0,0,0.2); color: white;">
                            </div>
                            ${isRecurring ? `
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <span style="font-size: 0.8rem; color: var(--text-secondary);">Días de notificación:</span>
                                <div class="day-selectors" style="display: flex; gap: 4px;">
                                    <button class="day-btn ${conf.days.includes(1) ? 'active' : ''}" data-day="1" style="min-width: 32px; padding: 4px 0;">L</button>
                                    <button class="day-btn ${conf.days.includes(2) ? 'active' : ''}" data-day="2" style="min-width: 32px; padding: 4px 0;">M</button>
                                    <button class="day-btn ${conf.days.includes(3) ? 'active' : ''}" data-day="3" style="min-width: 32px; padding: 4px 0;">M</button>
                                    <button class="day-btn ${conf.days.includes(4) ? 'active' : ''}" data-day="4" style="min-width: 32px; padding: 4px 0;">J</button>
                                    <button class="day-btn ${conf.days.includes(5) ? 'active' : ''}" data-day="5" style="min-width: 32px; padding: 4px 0;">V</button>
                                    <button class="day-btn ${conf.days.includes(6) ? 'active' : ''}" data-day="6" style="min-width: 32px; padding: 4px 0;">S</button>
                                    <button class="day-btn ${conf.days.includes(0) ? 'active' : ''}" data-day="0" style="min-width: 32px; padding: 4px 0;">D</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });

            bodyHtml += `</div>`;
            card.innerHTML = bodyHtml;
            container.appendChild(card);
        });

        // Configurar los escuchadores después de renderizar
        this.setupListeners();
    }
}
