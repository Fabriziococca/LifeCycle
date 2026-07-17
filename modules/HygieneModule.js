import { itemsConfig } from '../utils.js';
import { DateUtils } from '../utils.js';

export class HygieneModule {
    constructor(appController) {
        this.app = appController;
        this.currentCategory = 'tecnologia';
        this.robotCard = document.getElementById('robot-cleaner-card');
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
        
        // Inicializar datos del robot aspiradora si no existen
        if (parsedData.robot_cleaner === undefined) {
            parsedData.robot_cleaner = {
                status: 'clean',
                marked_dirty_at: null,
                last_notified_at: null
            };
        }
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
        const date = new Date(dateString);
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
            const dateObj = new Date(dateStr);
            const formatted = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.8rem;">
                    <span>${formatted}</span>
                    <button class="btn-delete-hygiene-history" data-item="${itemId}" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 6px;" title="Borrar registro">❌</button>
                </div>
            `;
        }).join('');

        // Bind delete listeners
        logContainer.querySelectorAll('.btn-delete-hygiene-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.item;
                const idx = parseInt(btn.dataset.index);
                if (confirm('¿Borrar este registro del historial?')) {
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
                }
            });
        });
    }

    render() {
        if (!this.container) return;
        
        // Mostrar u ocultar la tarjeta del robot según la categoría seleccionada
        if (this.robotCard) {
            if (this.currentCategory === 'tecnologia') {
                this.robotCard.style.display = 'block';
                this.renderRobotCard();
            } else {
                this.robotCard.style.display = 'none';
            }
        }

        this.container.innerHTML = '';

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
                
                if (item.instructions && item.instructions.length > 0) {
                    instructionsContent.innerHTML = item.instructions.map(inst => `
                        <div class="instruction-step">
                            <div class="instruction-step-title">${inst.step}</div>
                            <div class="instruction-step-text">${inst.text}</div>
                        </div>
                    `).join('');
                    
                    infoBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isOpen = instructionsCollapse.classList.contains('open');
                        instructionsCollapse.classList.toggle('open', !isOpen);
                        infoBtn.classList.toggle('active', !isOpen);
                    });
                } else {
                    infoBtn.style.display = 'none';
                    instructionsCollapse.style.display = 'none';
                }

                // Botón editar fecha retroactivamente
                const editBtn = clone.querySelector('.btn-card-edit');
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
                    subItemEl.className = 'group-subitem';
                    subItemEl.style.borderTop = index > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none';
                    subItemEl.style.paddingTop = index > 0 ? '1.25rem' : '0.5rem';
                    subItemEl.style.paddingBottom = '0.5rem';
                    
                    subItemEl.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #fff;">${item.subName}</h4>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button class="btn-info sub-info-btn" title="Ver Instrucciones" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px 4px; font-size: 1rem;"><i class="ph ph-book-open"></i></button>
                                <button class="btn-card-edit sub-edit-btn" title="Editar Fecha" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px 4px; font-size: 1rem;"><i class="ph ph-pencil-simple"></i></button>
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
                            <div>Último: <strong style="color: white; font-weight: 500;">${this.formatDate(lastDateVal)}</strong></div>
                            <div>Próximo: <strong style="color: white; font-weight: 500;">${lastDateVal ? this.formatDate(this.getNextDate(lastDateVal, item.limits.red)) : 'N/A'}</strong></div>
                        </div>

                        <div class="progress-container" style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; margin-bottom: 0.75rem;">
                            <div class="progress-bar" style="width: ${this.getProgressWidth(daysElapsed, item.limits.red)}; background-color: ${statusColor}; height: 100%;"></div>
                        </div>

                        <button class="btn btn-history hygiene-history-btn" style="margin-top: 0.5rem; width: 100%; font-size: 0.8rem; padding: 6px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;">Ver historial</button>
                        <div class="history-log hygiene-history-log hidden" style="margin-top: 0.5rem; background: rgba(0,0,0,0.15); border-radius: 6px; padding: 8px;"></div>
                        
                        <div class="card-footer" style="padding-top: 0.75rem; margin-top: 0.5rem;">
                            <button class="btn-wash" style="padding: 0.6rem; font-size: 0.85rem;">
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
                                <div class="instruction-step-title">${inst.step}</div>
                                <div class="instruction-step-text">${inst.text}</div>
                            </div>
                        `).join('');
                        
                        infoBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const isOpen = instCollapse.classList.contains('open');
                            instCollapse.classList.toggle('open', !isOpen);
                            infoBtn.classList.toggle('active', !isOpen);
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
    }

    initTabs() {
        const tabsContainer = document.getElementById('tabs-container');
        if (!tabsContainer) return;
        
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            tabsContainer.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            this.currentCategory = btn.dataset.category;
            this.render();
        });
    }

    renderRobotCard() {
        if (!this.robotCard) return;
        
        if (!this.data.robot_cleaner) {
            this.data.robot_cleaner = {
                status: 'clean',
                marked_dirty_at: null,
                last_notified_at: null
            };
        }
        
        const robot = this.data.robot_cleaner;
        const isDirty = robot.status === 'dirty';
        
        if (isDirty) {
            this.robotCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            this.robotCard.className = 'card status-red';
            
            let timeLabel = '';
            if (robot.marked_dirty_at) {
                const elapsedMs = new Date() - new Date(robot.marked_dirty_at);
                const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
                const elapsedMins = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
                
                if (elapsedHours > 0) {
                    timeLabel = `Hace ${elapsedHours}h ${elapsedMins}m`;
                } else {
                    timeLabel = `Hace ${elapsedMins} min`;
                }
            }
            
            this.robotCard.innerHTML = `
                <div class="card-header" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="icon-container" style="background: rgba(239, 68, 68, 0.1); color: #f87171;">
                            <i class="ph ph-robot" style="font-size: 1.5rem;"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.05rem; color: white;">Robot Aspiradora</h3>
                            <p style="margin: 3px 0 0 0; font-size: 0.75rem; color: #f87171;">Estado: Pendiente de Lavado (${timeLabel})</p>
                        </div>
                    </div>
                    <span class="badge red"><i class="ph ph-warning-circle"></i> Alertas Activas (c/6h)</span>
                </div>
                <div class="card-body" style="padding-top: 0; margin-top: 0.5rem;">
                    <p class="backup-text" style="font-size: 0.85rem; margin-bottom: 1rem; color: var(--text-secondary);">Marcaste el robot como usado. Lávalo para detener los recordatorios cada 6 horas en tu celular.</p>
                    <button id="btn-wash-robot" class="btn btn-secondary" style="width: 100%; border-color: rgba(34, 197, 94, 0.3); color: #4ade80;">
                        <i class="ph ph-sparkle"></i> ✓ Listo, ya lo lavé
                    </button>
                </div>
            `;
            
            document.getElementById('btn-wash-robot')?.addEventListener('click', () => {
                this.markRobotClean();
            });
        } else {
            this.robotCard.style.borderColor = 'rgba(34, 197, 94, 0.2)';
            this.robotCard.className = 'card status-green';
            
            this.robotCard.innerHTML = `
                <div class="card-header" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="icon-container" style="background: rgba(34, 197, 94, 0.1); color: #4ade80;">
                            <i class="ph ph-robot" style="font-size: 1.5rem;"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.05rem; color: white;">Robot Aspiradora</h3>
                            <p style="margin: 3px 0 0 0; font-size: 0.75rem; color: #4ade80;">Estado: Limpio & Listo</p>
                        </div>
                    </div>
                    <span class="badge green"><i class="ph ph-check-circle"></i> Al día</span>
                </div>
                <div class="card-body" style="padding-top: 0; margin-top: 0.5rem;">
                    <p class="backup-text" style="font-size: 0.85rem; margin-bottom: 1rem; color: var(--text-secondary);">El robot está limpio. Cuando tu hermano lo use, márcalo como sucio para iniciar las alertas.</p>
                    <button id="btn-dirty-robot" class="btn btn-secondary" style="width: 100%;">
                        <i class="ph ph-warning"></i> Marcar como Sucio (Iniciar Alertas)
                    </button>
                </div>
            `;
            
            document.getElementById('btn-dirty-robot')?.addEventListener('click', () => {
                this.markRobotDirty();
            });
        }
    }

    markRobotDirty() {
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
        
        setInterval(() => {
            if (this.data?.robot_cleaner?.status === 'dirty' && this.currentCategory === 'tecnologia') {
                this.renderRobotCard();
            }
        }, 30000);
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
