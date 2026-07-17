import { ZONES } from '../config.js';
import { DateUtils } from '../utils.js';

export class GroomingModule {
    constructor(appController) {
        this.app = appController;
        this.data = this.loadData();
        
        this.barbaSection = document.getElementById('barba-section');
        this.gridSection = document.getElementById('cuidado-grid-section');
        this.toolsSection = document.getElementById('cuidado-tools-section');
        
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
        
        // Filtrar duplicados o registros muy cercanos (menos de 12 horas)
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
            // Sugerir en 2 días por defecto (frecuencia óptima para la barba)
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
        
        // Si la diferencia promedio es mayor a 4 días (el límite crítico máximo), la limitamos
        if (avgDiff > 4 * 24 * 60 * 60 * 1000) {
            avgDiff = 2.5 * 24 * 60 * 60 * 1000; // Valor razonable por defecto para afeitado regular
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
                <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span>${formatted}</span>
                    <button class="btn-delete-grooming-history" data-zone="${zoneId}" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 6px; font-size: 0.85rem;" title="Borrar registro">❌</button>
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

    render() {
        if (!this.barbaSection || !this.gridSection || !this.toolsSection) return;

        this.barbaSection.innerHTML = '';
        this.gridSection.innerHTML = '';
        this.toolsSection.innerHTML = '';

        ZONES.forEach(zone => {
            const history = this.data[zone.id] || [];
            const lastSession = history[0] || null;
            const daysDiff = this.getDaysDiff(lastSession);
            
            let daysText = 'Nunca';
            let colorVar = 'var(--text-secondary)';
            let borderColor = 'var(--surface-border)';

            if (daysDiff !== null) {
                daysText = daysDiff === 0 ? 'Hoy' : daysDiff === 1 ? '1 día' : `${daysDiff} días`;
                
                // Get limits from rulesConfig
                const zRules = this.app.auth?.config?.rulesConfig?.grooming?.[zone.id]?.limits || {};
                
                if (zone.id === 'barba') {
                    if (daysDiff <= (zRules.green || 2)) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff === (zRules.yellow || 3)) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'pelo') {
                    if (daysDiff <= 14) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 17) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 19) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'axilas') {
                    if (daysDiff <= 20) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 25) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 29) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'hoja_gillette') {
                    if (daysDiff <= 20) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 29) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'pecho_panza') {
                    if (daysDiff <= 40) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 50) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 59) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'brazos') {
                    if (daysDiff <= 120) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 150) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 179) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'piernas') {
                    if (daysDiff <= 80) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 100) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 119) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'intimas') {
                    if (daysDiff <= 15) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 22) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 29) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'unas_manos') {
                    if (daysDiff <= 10) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 14) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 17) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'unas_pies') {
                    if (daysDiff <= 30) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 40) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else if (daysDiff <= 49) { colorVar = 'var(--status-orange)'; borderColor = 'var(--status-orange)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else {
                    colorVar = 'var(--primary-color)';
                }
            }

            const card = document.createElement('div');
            card.className = zone.isHero ? 'card hero-card' : 'card';
            if (daysDiff !== null) {
                card.style.borderColor = borderColor;
            }

            let iconClass = 'ph-user';
            if (zone.id === 'barba') iconClass = 'ph-scissors';
            else if (zone.id === 'unas_manos') iconClass = 'ph-hand';
            else if (zone.id === 'unas_pies') iconClass = 'ph-scissors';
            else if (zone.id === 'hoja_gillette') iconClass = 'ph-sparkle';

            if (zone.isHero) {
                // Render Hero Card for Barba
                const predictionText = this.updatePrediction(history);
                card.innerHTML = `
                    <div class="hero-flex">
                        <div class="hero-main-info">
                            <div class="icon-container-large">
                                <i class="ph-fill ${iconClass}"></i>
                            </div>
                            <div>
                                <h2 style="margin:0; font-size:1.45rem;">${zone.name}</h2>
                                <p style="margin:5px 0 0 0; font-size:0.85rem; color: ${colorVar}; font-weight:600;">Estado: ${daysText === 'Nunca' ? 'Nunca registrado' : 'Hace ' + daysText}</p>
                                <p class="prediction-text" style="margin:8px 0 0 0; font-size:0.8rem; color:var(--text-secondary); font-style:italic;">${predictionText}</p>
                            </div>
                        </div>
                        <div class="hero-actions">
                            <button class="btn btn-primary btn-record-grooming" data-zone="${zone.id}"><i class="ph-bold ph-scissors"></i> Afeitarme AHORA</button>
                            <div style="display:flex; gap:10px; width:100%;">
                                <button class="btn btn-secondary btn-card-edit" data-zone="${zone.id}" style="flex:1;"><i class="ph ph-pencil-simple"></i> Editar</button>
                                <button class="btn btn-secondary btn-history-grooming" style="flex:1;">Ver historial</button>
                            </div>
                        </div>
                    </div>
                    <div class="history-log hidden" style="margin-top: 1.25rem; background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px;"></div>
                `;
                
                card.querySelector('.btn-record-grooming').addEventListener('click', () => this.recordSession(zone.id));
                card.querySelector('.btn-card-edit').addEventListener('click', () => {
                    this.app.openEditModal('grooming', zone.id, zone.name, lastSession);
                });
                
                const logContainer = card.querySelector('.history-log');
                const histBtn = card.querySelector('.btn-history-grooming');
                this.renderHistoryLog(zone.id, history, logContainer);
                
                histBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isHidden = logContainer.classList.contains('hidden');
                    logContainer.classList.toggle('hidden', !isHidden);
                    histBtn.innerText = isHidden ? 'Ocultar historial' : 'Ver historial';
                });
                
                this.barbaSection.appendChild(card);
            } else {
                // Render standard card
                card.innerHTML = `
                    <div class="card-header">
                        <div class="icon-container">
                            <i class="ph ${iconClass}"></i>
                        </div>
                        <h3>${zone.name}</h3>
                    </div>
                    <div class="card-body">
                        <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 0.5rem;">
                            <span class="days-count" style="font-size: 1.5rem; font-weight: 700; color: ${colorVar};">${daysDiff !== null ? daysDiff : '--'}</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">días</span>
                        </div>
                        <p style="font-size:0.75rem; color: var(--text-secondary); margin-bottom: 1rem;">Último: <strong style="color:white; font-weight:500;">${DateUtils.formatFriendlyDate(lastSession)}</strong></p>
                        
                        <button class="btn btn-history btn-history-grooming" style="margin-bottom: 0.75rem; width:100%; font-size:0.8rem; padding:6px 12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:var(--text-secondary); cursor:pointer;">Ver historial</button>
                        <div class="history-log hidden" style="margin-bottom:0.75rem; background: rgba(0,0,0,0.15); border-radius: 6px; padding: 8px;"></div>
                    </div>
                    <div class="card-footer" style="display:flex; gap:8px;">
                        <button class="btn-card-edit" data-zone="${zone.id}" title="Editar Fecha" style="padding: 0.6rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; width: 42px; height: 42px; transition: all 0.2s;"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-wash btn-record-grooming" style="flex:1;">
                            <i class="ph-bold ph-check"></i>
                            <span>${zone.isTool ? 'Renovar' : 'Registrar'}</span>
                        </button>
                    </div>
                `;
                
                card.querySelector('.btn-record-grooming').addEventListener('click', () => this.recordSession(zone.id));
                card.querySelector('.btn-card-edit').addEventListener('click', () => {
                    this.app.openEditModal('grooming', zone.id, zone.name, lastSession);
                });
                
                const logContainer = card.querySelector('.history-log');
                const histBtn = card.querySelector('.btn-history-grooming');
                this.renderHistoryLog(zone.id, history, logContainer);
                
                histBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isHidden = logContainer.classList.contains('hidden');
                    logContainer.classList.toggle('hidden', !isHidden);
                    histBtn.innerText = isHidden ? 'Ocultar historial' : 'Ver historial';
                });
                
                if (zone.isTool) {
                    this.toolsSection.appendChild(card);
                } else {
                    this.gridSection.appendChild(card);
                }
            }
        });
    }

    init() {
        this.render();
    }
}
