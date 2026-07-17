import { ZONES, GROOMING_RULES } from '../utils.js';
import { DateUtils } from '../utils.js';

export class GroomingModule {
    constructor(appController) {
        this.app = appController;
        this.data = this.loadData();
        
        this.barbaSection = document.getElementById('barba-section');
        this.gridSection = document.getElementById('cuidado-grid-section');
        this.toolsSection = document.getElementById('cuidado-tools-section');
        this.template = document.getElementById('card-template');
        
        window.grooming = this;
        this.init();
    }

    loadData() {
        const raw = localStorage.getItem('groomingData_v2');
        if (!raw) return {};
        try {
            return JSON.parse(raw) || {};
        } catch (e) {
            console.error("Error parsing grooming data:", e);
            return {};
        }
    }

    saveData() {
        localStorage.setItem('groomingData_v2', JSON.stringify(this.data));
    }

    getDaysDiff(dateString) {
        if (!dateString) return null;
        const now = new Date();
        const past = new Date(dateString);
        now.setHours(0,0,0,0);
        past.setHours(0,0,0,0);
        return Math.floor((now - past) / (1000 * 60 * 60 * 24));
    }

    updatePrediction(historyArray) {
        if (!historyArray || historyArray.length === 0) return 'Sin registros';
        
        const validDates = [];
        for (let i = 0; i < historyArray.length; i++) {
            const current = new Date(historyArray[i]);
            if (validDates.length === 0) {
                validDates.push(current);
            } else {
                const prev = validDates[validDates.length - 1];
                if (Math.abs(prev - current) > 12 * 60 * 60 * 1000) {
                    validDates.push(current);
                }
            }
        }

        if (validDates.length < 2) {
            const nextDate = new Date(validDates[0] ? validDates[0].getTime() : Date.now());
            nextDate.setDate(nextDate.getDate() + 2);
            let dateStr = nextDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
            return `Próximo afeitado proyectado: ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} (Estimado)`;
        }
        
        let totalDiff = 0;
        let count = Math.min(validDates.length - 1, 3);
        for (let i = 0; i < count; i++) {
            totalDiff += (validDates[i].getTime() - validDates[i+1].getTime());
        }
        let avgDiff = totalDiff / count;
        
        if (avgDiff > 4 * 24 * 60 * 60 * 1000) {
            avgDiff = 2.5 * 24 * 60 * 60 * 1000;
        }
        
        const nextDate = new Date(validDates[0].getTime() + avgDiff);
        let dateStr = nextDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
        return `Próximo afeitado proyectado: ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`;
    }

    recordSession(zoneId, customDate = null) {
        if (navigator.vibrate) navigator.vibrate(50);

        if (!this.data[zoneId]) this.data[zoneId] = [];
        
        const dateToSave = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
        
        this.data[zoneId].unshift(dateToSave);
        
        this.data[zoneId].sort((a, b) => new Date(b) - new Date(a));
        if (this.data[zoneId].length > 10) this.data[zoneId].pop();
        
        this.saveData();
        this.render();
        this.app.notificationsCenter?.updateBadge();
    }

    renderHistoryLog(zoneId, historyArray, logContainer) {
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
                    <button class="btn-delete-grooming-history" data-zone="${zoneId}" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 6px;" title="Borrar registro">❌</button>
                </div>
            `;
        }).join('');

        // Bind delete listeners
        logContainer.querySelectorAll('.btn-delete-grooming-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const zone = btn.dataset.zone;
                const idx = parseInt(btn.dataset.index);
                if (confirm('¿Borrar este registro del historial?')) {
                    this.data[zone].splice(idx, 1);
                    this.saveData();
                    this.render();
                    this.app.auth?.syncToCloud(false).catch(() => {});
                    this.app.notificationsCenter?.updateBadge();
                }
            });
        });
    }

    getStatusClass(daysElapsed, limits) {
        if (daysElapsed === null) return 'status-green';
        if (daysElapsed >= limits.red) return 'status-red';
        if (limits.orange && daysElapsed >= limits.orange) return 'status-orange';
        if (daysElapsed >= limits.yellow) return 'status-yellow';
        return 'status-green';
    }

    getStatusText(statusClass, zoneId) {
        const statusMap = { 'status-green': 'green', 'status-yellow': 'yellow', 'status-orange': 'orange', 'status-red': 'red' };
        const status = statusMap[statusClass] || 'green';
        
        if (zoneId === 'barba') {
            return { green: 'Afeitado', yellow: 'Toca Afeitar', red: '¡Afeitate ya!' }[status];
        }
        if (zoneId === 'pelo') {
            return { green: 'Corte OK', yellow: 'Atención', orange: 'Cortar Pronto', red: 'Corte Urgente' }[status];
        }
        if (zoneId === 'unas_manos' || zoneId === 'unas_pies') {
            return { green: 'Uñas OK', yellow: 'Atención', orange: 'Cortar Pronto', red: 'Cortar Uñas ya' }[status];
        }
        if (zoneId === 'hoja_gillette') {
            return { green: 'Filo OK', yellow: 'Atención', red: 'Cambiar Hoja' }[status];
        }
        return { green: 'Depilación OK', yellow: 'Atención', orange: 'Rebajar Pronto', red: 'Rebajar Urgente' }[status];
    }

    render() {
        if (!this.gridSection || !this.toolsSection) return;

        this.gridSection.innerHTML = '';
        this.toolsSection.innerHTML = '';
        if (this.barbaSection) this.barbaSection.innerHTML = '';

        ZONES.forEach(zone => {
            const history = this.data[zone.id] || [];
            const lastSession = history[0] || null;
            const daysDiff = this.getDaysDiff(lastSession);
            
            const limits = GROOMING_RULES[zone.id]?.limits || { red: 30, yellow: 20 };
            const statusClass = this.getStatusClass(daysDiff, limits);
            const statusText = this.getStatusText(statusClass, zone.id);

            const clone = this.template.content.cloneNode(true);
            const cardEl = clone.querySelector('.card');
            
            let colorVar = 'var(--status-green)';
            if (statusClass === 'status-yellow') colorVar = 'var(--status-yellow)';
            else if (statusClass === 'status-orange') colorVar = 'var(--status-orange)';
            else if (statusClass === 'status-red') colorVar = 'var(--status-red)';
            
            cardEl.className = `card ${statusClass}`;
            cardEl.style.borderColor = colorVar;

            clone.querySelector('.card-title').textContent = zone.name;
            
            let iconClass = 'ph-user';
            if (zone.id === 'barba') iconClass = 'ph-scissors';
            else if (zone.id === 'unas_manos') iconClass = 'ph-hand';
            else if (zone.id === 'unas_pies') iconClass = 'ph-scissors';
            else if (zone.id === 'hoja_gillette') iconClass = 'ph-sparkle';
            
            clone.querySelector('.card-icon').className = `card-icon ph ${iconClass}`;
            clone.querySelector('.days-count').textContent = daysDiff !== null ? daysDiff : '--';
            clone.querySelector('.days-count').style.color = colorVar;
            clone.querySelector('.status-text').textContent = statusText;
            clone.querySelector('.status-dot').style.backgroundColor = colorVar;

            clone.querySelector('.last-date-label').textContent = 'Último registro';
            clone.querySelector('.next-date-label').textContent = 'Próximo aviso';
            clone.querySelector('.last-date').textContent = DateUtils.formatFriendlyDate(lastSession);
            
            if (lastSession) {
                const nextDateVal = new Date(lastSession);
                nextDateVal.setDate(nextDateVal.getDate() + limits.red);
                clone.querySelector('.next-date').textContent = DateUtils.formatFriendlyDate(nextDateVal.toISOString());
            } else {
                clone.querySelector('.next-date').textContent = 'N/A';
            }
            
            const maxLimit = limits.red || 30;
            const progressPercent = daysDiff !== null ? Math.min(100, (daysDiff / maxLimit) * 100) : 0;
            clone.querySelector('.progress-bar').style.width = `${progressPercent}%`;
            clone.querySelector('.progress-bar').style.backgroundColor = colorVar;

            // Ocultar botón de info ya que cuidado corporal no tiene instrucciones
            const infoBtn = clone.querySelector('.btn-info');
            const instructionsCollapse = clone.querySelector('.instructions-collapse');
            if (infoBtn) infoBtn.style.display = 'none';
            if (instructionsCollapse) instructionsCollapse.style.display = 'none';

            // Editar fecha
            const editBtn = clone.querySelector('.btn-card-edit');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.openEditModal('grooming', zone.id, zone.name, lastSession);
            });

            // Registrar acción
            const actionBtn = clone.querySelector('.btn-wash');
            let btnText = 'Registrar';
            let btnIcon = 'ph-check';
            if (zone.id === 'barba') { btnText = 'Registrar Afeitado'; btnIcon = 'ph-scissors'; }
            else if (zone.id === 'pelo') { btnText = 'Registrar Corte'; btnIcon = 'ph-scissors'; }
            else if (zone.id === 'unas_manos' || zone.id === 'unas_pies') { btnText = 'Registrar Corte'; btnIcon = 'ph-scissors'; }
            else if (zone.id === 'hoja_gillette') { btnText = 'Renovar Hoja'; btnIcon = 'ph-sparkle'; }
            else { btnText = 'Registrar Depilación'; btnIcon = 'ph-scissors'; }

            actionBtn.querySelector('span').textContent = btnText;
            actionBtn.querySelector('i').className = `ph-bold ${btnIcon}`;
            actionBtn.addEventListener('click', () => this.recordSession(zone.id));

            // Historial
            const histBtn = clone.querySelector('.hygiene-history-btn');
            const logContainer = clone.querySelector('.hygiene-history-log');

            histBtn.style.display = 'block';
            histBtn.classList.remove('hidden');
            this.renderHistoryLog(zone.id, history, logContainer);
            
            histBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = logContainer.classList.contains('hidden');
                logContainer.classList.toggle('hidden', !isHidden);
                histBtn.innerText = isHidden ? 'Ocultar historial' : 'Ver historial';
            });

            // Proyección barba
            if (zone.id === 'barba') {
                const predictionText = this.updatePrediction(history);
                const predEl = document.createElement('div');
                predEl.style.fontSize = '0.75rem';
                predEl.style.color = 'var(--text-secondary)';
                predEl.style.fontStyle = 'italic';
                predEl.style.marginTop = '0.5rem';
                predEl.style.textAlign = 'center';
                predEl.textContent = predictionText;
                clone.querySelector('.progress-container').before(predEl);
            }

            if (zone.isTool) {
                this.toolsSection.appendChild(clone);
            } else {
                this.gridSection.appendChild(clone);
            }
        });
    }

    init() {
        this.render();
    }
}
