import { DateUtils, itemsConfig, parseDateLocal } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs';
import {
    DEFAULT_ROBOT_TRACKER_ID,
    isUnifiedCustomTrackerRegistry
} from '../custom-tracker-utils.mjs?v=20260818-unified-registry';

export class HygieneModule {
    constructor(appController) {
        this.app = appController;
        this.currentCategory = this.app.uiState?.hygieneCategory || 'tecnologia';
        this.data = this.loadData();
        this.container = document.getElementById('tracker-container');
        this.template = document.getElementById('card-template');
        this.init();
    }

    loadData() {
        const stored = localStorage.getItem('hygiene_tracker_data');
        let parsedData = {};
        if (stored) {
            try { parsedData = JSON.parse(stored); } catch (e) { parsedData = {}; }
        }
        itemsConfig.forEach(item => {
            if (parsedData[item.id] === undefined) {
                parsedData[item.id] = null;
            }
        });
        
        return parsedData;
    }

    saveData() {
        localStorage.setItem('hygiene_tracker_data', JSON.stringify(this.data));
    }

    getDaysElapsed(dateString) {
        return DateUtils.getDaysElapsed(dateString);
    }

    getStatusClass(daysElapsed, limits) {
        if (daysElapsed === null) return 'status-green';
        if (daysElapsed >= limits.red) return 'status-red';
        if (daysElapsed >= limits.orange) return 'status-orange';
        if (daysElapsed >= limits.yellow) return 'status-yellow';
        return 'status-green';
    }

    getStatusText(statusClass, type = 'wash') {
        const typeMap = {
            change: { green: 'OK', yellow: 'Atención', orange: 'Cambiar Pronto', red: '¡Cámbialo ya!' },
            clean: { green: 'OK', yellow: 'Atención', orange: 'Limpiar Pronto', red: 'Limpieza Urgente' },
            brush: { green: 'OK', yellow: 'Atención', orange: 'Cepillar Pronto', red: 'Cepillado Urgente' },
            wash: { green: 'OK', yellow: 'Atención', orange: 'Lavar Pronto', red: 'Lavado Urgente' }
        };
        const statusMap = { 'status-green': 'green', 'status-yellow': 'yellow', 'status-orange': 'orange', 'status-red': 'red' };
        return typeMap[type]?.[statusMap[statusClass]] || 'OK';
    }

    formatDate(dateInput) {
        return DateUtils.formatFriendlyDate(dateInput);
    }

    getNextDate(dateString, limitDays) {
        if (!dateString) return null;
        const date = parseDateLocal(dateString);
        if (!date) return null;
        date.setDate(date.getDate() + limitDays);
        return date;
    }

    getProgressWidth(daysElapsed, maxLimit) {
        if (daysElapsed === null) return '0%';
        if (daysElapsed >= maxLimit) return '100%';
        return `${(daysElapsed / maxLimit) * 100}%`;
    }

    washItem(id) {
        if (navigator.vibrate) navigator.vibrate(50);
        
        const nowIso = new Date().toISOString();
        const isHistory = itemsConfig.find(x => x.id === id)?.category === 'tecnologia' || id === 'esponja_africana' || id === 'cepillo_dientes';
        if (isHistory) {
            let history = Array.isArray(this.data[id]) 
                ? this.data[id] 
                : (this.data[id] ? [this.data[id]] : []);
            history.unshift(nowIso);
            if (history.length > 10) history.pop();
            this.data[id] = history;
        } else {
            this.data[id] = nowIso;
        }
        
        this.saveData();
        this.render();
        this.app.notificationsCenter?.updateBadge();
    }

    renderHygieneHistoryLog(itemId, historyArray, logContainer) {
        if (!historyArray || historyArray.length === 0) {
            logContainer.innerHTML = '<i>Sin registros</i>';
            return;
        }
        logContainer.innerHTML = historyArray.slice(0, 5).map((dateStr, index) => {
            const dateObj = parseDateLocal(dateStr);
            const formatted = dateObj
                ? dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
                : dateStr;
            const safeItemId = escapeHtml(itemId);
            return `
                <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.8rem;">
                    <span>${escapeHtml(formatted)}</span>
                    <button type="button" class="btn-delete-hygiene-history icon-btn icon-btn-sm is-danger" data-item="${safeItemId}" data-index="${index}" data-tooltip="Borrar registro" aria-label="Borrar registro de higiene"><i class="ph ph-trash" aria-hidden="true"></i></button>
                </div>
            `;
        }).join('');

        // Bind delete listeners
        logContainer.querySelectorAll('.btn-delete-hygiene-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.item;
                const idx = parseInt(btn.dataset.index);
                const previousValue = Array.isArray(this.data[itemId])
                    ? [...this.data[itemId]]
                    : this.data[itemId];
                if (Array.isArray(this.data[itemId])) {
                    this.data[itemId].splice(idx, 1);
                    if (this.data[itemId].length === 0) {
                        this.data[itemId] = null;
                    }
                } else {
                    this.data[itemId] = null;
                }
                this.saveData();
                this.render();
                this.app.auth?.syncToCloud(false).catch(() => {});
                this.app.notificationsCenter?.updateBadge();
                this.app.showUndo('Registro eliminado del historial.', () => {
                    this.data[itemId] = Array.isArray(previousValue)
                        ? [...previousValue]
                        : previousValue;
                    this.saveData();
                    this.render();
                    this.app.auth?.syncToCloud(false).catch(() => {});
                    this.app.notificationsCenter?.updateBadge();
                });
            });
        });
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        if (isUnifiedCustomTrackerRegistry(this.app.customTrackers?.registry)) {
            this.app.customTrackers.renderSection('hygiene');
            return;
        }

        const filteredItems = itemsConfig.filter(item => item.category === this.currentCategory);

        // Agrupación visual
        const groups = {};
        const renderedCards = [];

        filteredItems.forEach(item => {
            if (item.group) {
                if (!groups[item.group]) {
                    groups[item.group] = {
                        name: item.groupName,
                        icon: item.groupIcon,
                        items: []
                    };
                }
                groups[item.group].items.push(item);
            } else {
                // Item normal (sin grupo)
                renderedCards.push({ type: 'normal', item });
            }
        });

        // Añadir los grupos al listado de renderizado
        Object.keys(groups).forEach(groupKey => {
            renderedCards.push({ type: 'group', key: groupKey, groupData: groups[groupKey] });
        });

        // Renderizar cada elemento
        renderedCards.forEach(cardData => {
            if (cardData.type === 'normal') {
                const item = cardData.item;
                const type = item.type || 'wash';
                const history = Array.isArray(this.data[item.id]) 
                    ? this.data[item.id] 
                    : (this.data[item.id] ? [this.data[item.id]] : []);
                const lastDateVal = history[0] || null;
                const daysElapsed = this.getDaysElapsed(lastDateVal);
                const statusClass = this.getStatusClass(daysElapsed, item.limits);
                const statusText = this.getStatusText(statusClass, type);

                const clone = this.template.content.cloneNode(true);
                const cardEl = clone.querySelector('.card');
                
                // Color glow based on status
                let colorVar = 'var(--status-green)';
                if (statusClass === 'status-yellow') colorVar = 'var(--status-yellow)';
                else if (statusClass === 'status-orange') colorVar = 'var(--status-orange)';
                else if (statusClass === 'status-red') colorVar = 'var(--status-red)';
                
                cardEl.className = `card ${statusClass}`;
                cardEl.style.borderColor = colorVar;

                clone.querySelector('.card-title').textContent = item.name;
                clone.querySelector('.card-icon').className = `card-icon ph ${item.icon}`;
                clone.querySelector('.days-count').textContent = daysElapsed !== null ? daysElapsed : '--';
                clone.querySelector('.days-count').style.color = colorVar;
                clone.querySelector('.status-text').textContent = statusText;
                clone.querySelector('.status-dot').style.backgroundColor = colorVar;

                let lastDateLabel = 'Último lavado';
                let nextDateLabel = 'Próximo lavado';
                if (type === 'change') {
                    lastDateLabel = 'Último cambio';
                    nextDateLabel = 'Próximo cambio';
                } else if (type === 'clean') {
                    lastDateLabel = 'Última limpieza';
                    nextDateLabel = 'Próxima limpieza';
                } else if (type === 'brush') {
                    lastDateLabel = 'Último cepillado';
                    nextDateLabel = 'Próximo cepillado';
                }
                
                clone.querySelector('.last-date-label').textContent = lastDateLabel;
                clone.querySelector('.next-date-label').textContent = nextDateLabel;
                clone.querySelector('.last-date').textContent = this.formatDate(lastDateVal);
                
                if (lastDateVal) {
                    const nextDateVal = this.getNextDate(lastDateVal, item.limits.red);
                    clone.querySelector('.next-date').textContent = this.formatDate(nextDateVal);
                } else {
                    clone.querySelector('.next-date').textContent = 'N/A';
                }
                
                clone.querySelector('.progress-bar').style.width = this.getProgressWidth(daysElapsed, item.limits.red);
                clone.querySelector('.progress-bar').style.backgroundColor = colorVar;

                // Instrucciones desplegables
                const infoBtn = clone.querySelector('.btn-info');
                const instructionsCollapse = clone.querySelector('.instructions-collapse');
                const instructionsContent = clone.querySelector('.instructions-content');
                infoBtn.setAttribute('aria-label', `Ver instrucciones de ${item.name}`);
                infoBtn.setAttribute('title', `Ver instrucciones de ${item.name}`);
                
                if (item.instructions && item.instructions.length > 0) {
                    instructionsContent.innerHTML = item.instructions.map(inst => `
                        <div class="instruction-step">
                            <div class="instruction-step-title">${escapeHtml(inst.step)}</div>
                            <div class="instruction-step-text">${escapeHtml(inst.text)}</div>
                        </div>
                    `).join('');
                    
                    infoBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isOpen = instructionsCollapse.classList.contains('open');
                        instructionsCollapse.classList.toggle('open', !isOpen);
                        infoBtn.classList.toggle('active', !isOpen);
                        infoBtn.setAttribute('aria-expanded', String(!isOpen));
                    });
                } else {
                    infoBtn.style.display = 'none';
                    instructionsCollapse.style.display = 'none';
                }

                // Botón editar fecha retroactivamente
                const editBtn = clone.querySelector('.btn-card-edit');
                editBtn.setAttribute('aria-label', `Editar fecha del último registro de ${item.name}`);
                editBtn.setAttribute('title', `Editar fecha del último registro de ${item.name}`);
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.app.openEditModal('hygiene', item.id, item.name, lastDateVal);
                });

                // Botón de acción principal
                const actionBtn = clone.querySelector('.btn-wash');
                let btnText = 'Registrar Lavado';
                let btnIcon = 'ph-waves';
                if (type === 'change') { btnText = 'Registrar Cambio'; btnIcon = 'ph-arrows-clockwise'; }
                else if (type === 'clean') { btnText = 'Registrar Limpieza'; btnIcon = 'ph-sparkle'; }
                else if (type === 'brush') { btnText = 'Registrar Cepillado'; btnIcon = 'ph-paint-brush'; }
                
                actionBtn.querySelector('span').textContent = btnText;
                actionBtn.querySelector('i').className = `ph-bold ${btnIcon}`;
                
                actionBtn.addEventListener('click', () => this.washItem(item.id));

                // Historial (sólo para esponja africana, cepillo de dientes y tecnología)
                const histBtn = clone.querySelector('.hygiene-history-btn');
                const logContainer = clone.querySelector('.hygiene-history-log');

                const isHistoryEnabled = item.category === 'tecnologia' || item.id === 'esponja_africana' || item.id === 'cepillo_dientes';

                if (isHistoryEnabled) {
                    histBtn.style.display = 'block';
                    histBtn.classList.remove('hidden');
                    
                    this.renderHygieneHistoryLog(item.id, history, logContainer);
                    
                    histBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isHidden = logContainer.classList.contains('hidden');
                        logContainer.classList.toggle('hidden', !isHidden);
                        histBtn.innerText = isHidden ? 'Ocultar historial' : 'Ver historial';
                    });
                } else {
                    histBtn.style.display = 'none';
                    logContainer.style.display = 'none';
                }

                this.container.appendChild(clone);

            } else if (cardData.type === 'group') {
                const groupData = cardData.groupData;
                const groupKey = cardData.key;
                
                // Buscar la plantilla de tarjeta grupal
                const groupTemplate = document.getElementById('group-card-template');
                const clone = groupTemplate.content.cloneNode(true);
                const cardEl = clone.querySelector('.card');
                
                clone.querySelector('.card-title').textContent = groupData.name;
                clone.querySelector('.card-icon').className = `card-icon ph ${groupData.icon}`;
                
                const subitemsContainer = clone.querySelector('.group-subitems-container');
                subitemsContainer.innerHTML = '';
                
                // Determinar el peor estado entre los subitems para definir el color de borde de la tarjeta grupal
                let worstStatus = 'green';
                
                groupData.items.forEach((item, index) => {
                    const type = item.type || 'wash';
                    const history = Array.isArray(this.data[item.id]) 
                        ? this.data[item.id] 
                        : (this.data[item.id] ? [this.data[item.id]] : []);
                    const lastDateVal = history[0] || null;
                    const daysElapsed = this.getDaysElapsed(lastDateVal);
                    const statusClass = this.getStatusClass(daysElapsed, item.limits);
                    const statusText = this.getStatusText(statusClass, type);
                    
                    if (statusClass === 'status-red') worstStatus = 'red';
                    else if (statusClass === 'status-orange' && worstStatus !== 'red') worstStatus = 'orange';
                    else if (statusClass === 'status-yellow' && worstStatus !== 'red' && worstStatus !== 'orange') worstStatus = 'yellow';
                    
                    let statusColor = 'var(--status-green)';
                    if (statusClass === 'status-yellow') statusColor = 'var(--status-yellow)';
                    else if (statusClass === 'status-orange') statusColor = 'var(--status-orange)';
                    else if (statusClass === 'status-red') statusColor = 'var(--status-red)';
                    
                    let btnText = 'Registrar Lavado';
                    let btnIcon = 'ph-waves';
                    if (type === 'change') { btnText = 'Registrar Cambio'; btnIcon = 'ph-arrows-clockwise'; }
                    else if (type === 'clean') { btnText = 'Registrar Limpieza'; btnIcon = 'ph-sparkle'; }
                    else if (type === 'brush') { btnText = 'Registrar Cepillado'; btnIcon = 'ph-paint-brush'; }
                    
                    const subItemEl = document.createElement('div');
                    const safeSubName = escapeHtml(item.subName);
                    subItemEl.className = 'group-subitem';
                    subItemEl.style.borderTop = index > 0 ? '1px solid var(--divider-color)' : 'none';
                    subItemEl.style.paddingTop = index > 0 ? '1.25rem' : '0.5rem';
                    subItemEl.style.paddingBottom = '0.5rem';
                    
                    subItemEl.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-primary);">${safeSubName}</h4>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button type="button" class="btn-info sub-info-btn" title="Ver instrucciones de ${safeSubName}" aria-label="Ver instrucciones de ${safeSubName}" aria-expanded="false" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px 4px; font-size: 1rem;"><i class="ph ph-book-open"></i></button>
                                <button type="button" class="btn-card-edit sub-edit-btn" title="Editar fecha del último registro de ${safeSubName}" aria-label="Editar fecha del último registro de ${safeSubName}" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px 4px; font-size: 1rem;"><i class="ph ph-pencil-simple"></i></button>
                                <span class="status-dot" style="background-color: ${statusColor}; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px ${statusColor};"></span>
                            </div>
                        </div>
                        
                        <div class="instructions-collapse">
                            <div class="instructions-content"></div>
                        </div>

                        <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 0.5rem;">
                            <span style="font-size: 1.5rem; font-weight: 700; color: ${statusColor};">${daysElapsed !== null ? daysElapsed : '--'}</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">días</span>
                        </div>

                        <div style="font-size: 0.75rem; color: var(--text-secondary); display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 0.75rem;">
                            <div>Último: <strong style="color: var(--text-primary); font-weight: 500;">${this.formatDate(lastDateVal)}</strong></div>
                            <div>Próximo: <strong style="color: var(--text-primary); font-weight: 500;">${lastDateVal ? this.formatDate(this.getNextDate(lastDateVal, item.limits.red)) : 'N/A'}</strong></div>
                        </div>

                        <div class="progress-container" style="height: 4px; background: var(--progress-track); border-radius: 2px; overflow: hidden; margin-bottom: 0.75rem;">
                            <div class="progress-bar" style="width: ${this.getProgressWidth(daysElapsed, item.limits.red)}; background-color: ${statusColor}; height: 100%;"></div>
                        </div>

                        <button type="button" class="btn btn-history hygiene-history-btn" style="margin-top: 0.5rem; width: 100%; font-size: 0.8rem; padding: 6px 12px; background: var(--surface-subtle); border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;">Ver historial</button>
                        <div class="history-log hygiene-history-log hidden" style="margin-top: 0.5rem; background: var(--surface-inset); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px;"></div>
                        
                        <div class="card-footer" style="padding-top: 0.75rem; margin-top: 0.5rem;">
                            <button type="button" class="btn-wash" style="padding: 0.6rem; font-size: 0.85rem;">
                                <i class="ph-bold ${btnIcon}"></i>
                                <span>${btnText}</span>
                            </button>
                        </div>
                    `;
                    
                    // Bind actions
                    const infoBtn = subItemEl.querySelector('.sub-info-btn');
                    const instCollapse = subItemEl.querySelector('.instructions-collapse');
                    const instContent = subItemEl.querySelector('.instructions-content');
                    
                    if (item.instructions && item.instructions.length > 0) {
                        instContent.innerHTML = item.instructions.map(inst => `
                            <div class="instruction-step">
                                <div class="instruction-step-title">${escapeHtml(inst.step)}</div>
                                <div class="instruction-step-text">${escapeHtml(inst.text)}</div>
                            </div>
                        `).join('');
                        
                        infoBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const isOpen = instCollapse.classList.contains('open');
                            instCollapse.classList.toggle('open', !isOpen);
                            infoBtn.classList.toggle('active', !isOpen);
                            infoBtn.setAttribute('aria-expanded', String(!isOpen));
                        });
                    } else {
                        infoBtn.style.display = 'none';
                        instCollapse.style.display = 'none';
                    }
                    
                    subItemEl.querySelector('.sub-edit-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.app.openEditModal('hygiene', item.id, `${groupData.name} (${item.subName})`, lastDateVal);
                    });
                    
                    subItemEl.querySelector('.btn-wash').addEventListener('click', () => this.washItem(item.id));
                    
                    const logContainer = subItemEl.querySelector('.hygiene-history-log');
                    const histBtn = subItemEl.querySelector('.hygiene-history-btn');
                    
                    this.renderHygieneHistoryLog(item.id, history, logContainer);
                    
                    histBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isHidden = logContainer.classList.contains('hidden');
                        logContainer.classList.toggle('hidden', !isHidden);
                        histBtn.innerText = isHidden ? 'Ocultar historial' : 'Ver historial';
                    });
                    
                    subitemsContainer.appendChild(subItemEl);
                });
                
                // Color borde según peor estado
                let groupColor = 'var(--status-green)';
                if (worstStatus === 'yellow') groupColor = 'var(--status-yellow)';
                else if (worstStatus === 'orange') groupColor = 'var(--status-orange)';
                else if (worstStatus === 'red') groupColor = 'var(--status-red)';
                
                cardEl.style.borderColor = groupColor;
                
                this.container.appendChild(clone);
            }
        });

        // Esta grilla se reconstruye completa en cada cambio de categoría o registro.
        this.app.customTrackers?.renderSection('hygiene');
    }

    initTabs() {
        const tabsContainer = document.getElementById('tabs-container');
        if (!tabsContainer) return;

        tabsContainer.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === this.currentCategory);
        });
        
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            if (
                btn.dataset.category !== this.currentCategory
                && this.app.customTrackers?.reorderContext?.scope === 'runtime'
                && this.app.customTrackers.reorderContext.sectionKey === 'hygiene'
            ) {
                this.app.customTrackers.cancelReorderMode();
            }
            if (
                btn.dataset.category !== this.currentCategory
                && this.app.customTrackers?.bulkContext?.sectionKey === 'hygiene'
            ) {
                this.app.customTrackers.cancelBulkMode({ silent: true });
            }
            tabsContainer.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            this.currentCategory = btn.dataset.category;
            this.app.saveUiState?.({ hygieneCategory: this.currentCategory });
            this.render();
        });
    }

    markRobotDirty() {
        if (this.app.customTrackers?.setStateReminderActive?.(
            DEFAULT_ROBOT_TRACKER_ID,
            true
        )) return;
        if (navigator.vibrate) navigator.vibrate(50);
        this.data.robot_cleaner = {
            status: 'dirty',
            marked_dirty_at: new Date().toISOString(),
            last_notified_at: new Date().toISOString()
        };
        this.saveData();
        this.render();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.app.notificationsCenter?.updateBadge();
    }

    markRobotClean() {
        if (this.app.customTrackers?.setStateReminderActive?.(
            DEFAULT_ROBOT_TRACKER_ID,
            false
        )) return;
        if (navigator.vibrate) navigator.vibrate(50);
        this.data.robot_cleaner = {
            status: 'clean',
            marked_dirty_at: null,
            last_notified_at: null
        };
        this.saveData();
        this.render();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.app.notificationsCenter?.updateBadge();
    }

    init() {
        this.initTabs();
        this.render();
    }

    getCalendarDaysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        const diffTime = d2 - d1;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
}
