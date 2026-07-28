import { DateUtils, getLocalISODate, LENS_LIMITS } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

const CIRCUMFERENCE = 502; // 2 * Math.PI * 80 (basado en r=80 del SVG)

export class LensModule {
    constructor(appController) {
        this.app = appController;
        this.startTime = localStorage.getItem('lensesStartTime');
        this.interval = null;
        this.notificationSent = false;
        
        this.uiActiveState = document.getElementById('lenses-activeState');
        this.uiIdleState = document.getElementById('lenses-idleState');
        this.uiStartTimeDisplay = document.getElementById('lenses-startTimeDisplay');
        this.uiTimer = document.getElementById('lenses-timer');
        this.ring = document.getElementById('progressRing');
        
        this.inputCustomTime = document.getElementById('lenses-customTime');
        this.inputCustomEndTime = document.getElementById('lenses-customEndTime');
        this.btnPut = document.getElementById('lenses-btnPut');
        this.btnRemove = document.getElementById('lenses-btnRemove');
        
        this.inputStock = document.getElementById('lenses-lensStock');
        this.btnNewPair = document.getElementById('lenses-btnNewPair');
        this.stockWarning = document.getElementById('lenses-stockWarning');
        
        this.historyList = document.getElementById('lenses-historyList');
        this.btnClearHistory = document.getElementById('lenses-btnClearHistory');

        this.init();
    }

    requestNotificationPermission() {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

    calculateTime() {
        if (!this.startTime) return;
        const now = new Date();
        const start = new Date(this.startTime);
        const diff = now - start;

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        if (this.uiTimer) {
            this.uiTimer.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        
        const maxHours = 10;
        const totalSeconds = (h * 3600) + (m * 60) + s;
        const maxSeconds = maxHours * 3600;
        let percent = Math.min(totalSeconds / maxSeconds, 1);

        if (this.ring) {
            const offset = CIRCUMFERENCE - (percent * CIRCUMFERENCE);
            this.ring.style.strokeDashoffset = offset;
            if (h < 6) this.ring.style.stroke = "var(--status-green)";
            else if (h < 8) this.ring.style.stroke = "var(--status-yellow)";
            else this.ring.style.stroke = "var(--status-red)";
        }

        if (h >= 8 && !this.notificationSent && "Notification" in window && Notification.permission === "granted") {
            new Notification("LifeCycle - Lentes", { body: "Llevás 8 horas con los lentes. ¡Dales un descanso!", icon: "icon-v2.png" });
            this.notificationSent = true;
        }
    }

    updateUI() {
        if (this.startTime) {
            this.uiActiveState?.classList.remove('hidden');
            this.uiIdleState?.classList.add('hidden');
            
            const start = new Date(this.startTime);
            const hours = start.getHours().toString().padStart(2, '0');
            const minutes = start.getMinutes().toString().padStart(2, '0');
            if (this.uiStartTimeDisplay) {
                this.uiStartTimeDisplay.innerText = `Puestos a las ${hours}:${minutes}`;
            }
            
            if (this.interval) clearInterval(this.interval);
            this.interval = setInterval(() => this.calculateTime(), 1000);
            this.calculateTime(); 
        } else {
            this.uiActiveState?.classList.add('hidden');
            this.uiIdleState?.classList.remove('hidden');
            if (this.interval) clearInterval(this.interval);
            if (this.ring) {
                this.ring.style.strokeDashoffset = CIRCUMFERENCE;
            }
            if (this.uiTimer) this.uiTimer.innerText = "00:00:00";
        }
    }

    putLenses() {
        this.requestNotificationPermission();
        const customValue = this.inputCustomTime ? this.inputCustomTime.value : "";
        let start = new Date();
        
        if (customValue) {
            const [h, m] = customValue.split(':');
            start.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
            if (start > new Date()) start.setDate(start.getDate() - 1);
        }

        this.startTime = start.toISOString();
        this.notificationSent = false;
        localStorage.setItem('lensesStartTime', this.startTime);
        if (this.inputCustomTime) this.inputCustomTime.value = '';
        this.updateUI();
    }

    removeLenses() {
        const customEndValue = this.inputCustomEndTime ? this.inputCustomEndTime.value : "";
        let end = new Date();
        
        if (customEndValue && this.startTime) {
            const [h, m] = customEndValue.split(':');
            const startObj = new Date(this.startTime);
            end = new Date(startObj);
            end.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
            
            if (end < startObj) end.setDate(end.getDate() + 1);
            if (end > new Date()) end = new Date();
        }

        if (confirm('¿Te sacaste los lentes?')) {
            this.saveToHistory(end);
            localStorage.removeItem('lensesStartTime');
            this.startTime = null;
            if (this.inputCustomEndTime) this.inputCustomEndTime.value = '';
            this.updateUI();
        }
    }

    calculateDaysElapsed(dateString) {
        const elapsed = DateUtils.getDaysElapsed(dateString);
        return elapsed === null ? '--' : elapsed;
    }

    updateLabelStyle(element, days, limit, inputElement = null) {
        if (!element) return;
        if (days === "--" || days === null || days === undefined) {
            element.style.color = "var(--text-secondary)";
            if (inputElement) {
                inputElement.style.borderColor = "var(--surface-border)";
                inputElement.style.boxShadow = "none";
            }
            return;
        }
        
        const daysInt = parseInt(days);
        let colorVar = "var(--status-green)";
        let glowVar = "rgba(74, 222, 128, 0.1)";
        
        if (daysInt >= limit) {
            colorVar = "var(--status-red)";
            glowVar = "rgba(239, 68, 68, 0.15)";
        } else if (daysInt >= limit * 0.85) {
            colorVar = "var(--status-yellow)";
            glowVar = "rgba(234, 179, 8, 0.15)";
        } else if (daysInt >= limit * 0.70) {
            colorVar = "var(--status-orange)";
            glowVar = "rgba(249, 115, 22, 0.15)";
        }
        
        element.style.color = colorVar;
        if (inputElement) {
            inputElement.style.borderColor = colorVar;
            inputElement.style.boxShadow = `0 0 8px ${glowVar}`;
        }
    }

    loadDatesAndStock() {
        let stock = localStorage.getItem('lensStock') || 0;
        if (this.inputStock) this.inputStock.value = stock;
        this.checkStockWarning(stock);

        this.renderCards();
        this.app.notificationsCenter?.updateBadge();
    }

    renderCards() {
        const container = document.getElementById('lenses-cards-container');
        if (!container) return;

        container.innerHTML = '';

        const items = [
            { key: 'lensDate', name: 'Lentes de Contacto', limit: LENS_LIMITS.lenses, icon: 'ph-eye', actionText: 'Nuevo Par', isLens: true },
            { key: 'solutionDate', name: 'Solución Limpiadora', limit: LENS_LIMITS.solution, icon: 'ph-drop', actionText: 'Abrir Solución' },
            { key: 'caseDate', name: 'Estuche de Lentes', limit: LENS_LIMITS.case, icon: 'ph-archive', actionText: 'Cambiar Estuche' },
            { key: 'systaneDate', name: 'Gotas Systane', limit: LENS_LIMITS.systane, icon: 'ph-eyedropper', actionText: 'Abrir Gotas' },
            { key: 'clothWashDate', name: 'Pañuelo (Lavado)', limit: LENS_LIMITS.clothWash, icon: 'ph-spray', actionText: 'Lavar Pañuelo' },
            { key: 'clothChangeDate', name: 'Pañuelo (Cambio)', limit: LENS_LIMITS.clothChange, icon: 'ph-arrows-clockwise', actionText: 'Cambiar Pañuelo' }
        ];

        items.forEach(item => {
            const lastDateVal = localStorage.getItem(item.key) || null;
            const daysElapsed = this.calculateDaysElapsed(lastDateVal);
            
            let statusClass = 'status-green';
            let colorVar = 'var(--status-green)';
            let statusBadge = 'OK';

            if (daysElapsed !== '--' && daysElapsed !== null) {
                const daysInt = parseInt(daysElapsed);
                if (daysInt >= item.limit) {
                    statusClass = 'status-red';
                    colorVar = 'var(--status-red)';
                    statusBadge = 'CAMBIAR URGENTE';
                } else if (daysInt >= item.limit * 0.85) {
                    statusClass = 'status-yellow';
                    colorVar = 'var(--status-yellow)';
                    statusBadge = 'REEMPLAZAR PRONTO';
                } else if (daysInt >= item.limit * 0.70) {
                    statusClass = 'status-orange';
                    colorVar = 'var(--status-orange)';
                    statusBadge = 'ATENCIÓN';
                }
            }

            const card = document.createElement('div');
            card.className = `lenses-mini-card ${statusClass}`;
            card.style.cssText = `
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.9));
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-top: 3px solid ${colorVar};
                border-radius: 14px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: 12px;
                position: relative;
                box-shadow: 0 8px 20px rgba(0,0,0,0.25);
                backdrop-filter: blur(10px);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            `;

            let nextDateStr = 'N/A';
            if (lastDateVal) {
                const d = new Date(lastDateVal);
                d.setDate(d.getDate() + item.limit);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                nextDateStr = `${dd}/${mm}/${yyyy}`;
            }
            const lastDateStr = lastDateVal ? lastDateVal.split('-').reverse().join('/') : 'N/A';
            const daysDisplay = daysElapsed !== null && daysElapsed !== '--' ? daysElapsed : '--';
            const progressPct = daysElapsed !== '--' && daysElapsed !== null ? Math.min((parseInt(daysElapsed) / item.limit) * 100, 100) : 0;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="ph ${item.icon}" style="font-size: 1.25rem; color: ${colorVar};"></i>
                        </div>
                        <strong style="font-size: 0.92rem; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;">${item.name}</strong>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                        <button class="btn-card-edit" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); cursor: pointer; padding: 4px 6px; border-radius: 6px; font-size: 0.85rem; transition: all 0.2s;" title="Editar Fecha de Último Uso"><i class="ph ph-pencil"></i></button>
                        <span class="badge ${statusClass}" style="font-size: 0.65rem; padding: 3px 8px; font-weight: 700; border-radius: 20px; letter-spacing: 0.3px;">${statusBadge}</span>
                    </div>
                </div>

                <div style="display: flex; align-items: baseline; justify-content: space-between; margin: 2px 0;">
                    <div style="display: flex; align-items: baseline; gap: 6px;">
                        <span style="font-size: 1.8rem; font-weight: 800; color: ${colorVar}; line-height: 1; font-variant-numeric: tabular-nums;">${daysDisplay}</span>
                        <span style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 500;">días transcurridos (máx. ${item.limit}d)</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-secondary);">
                        <span>Último: <strong style="color: rgba(255,255,255,0.85);">${lastDateStr}</strong></span>
                        <span>Próximo: <strong style="color: rgba(255,255,255,0.85);">${nextDateStr}</strong></span>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; position: relative;">
                        <div style="width: ${progressPct}%; height: 100%; background: ${colorVar}; border-radius: 3px; transition: width 0.4s ease;"></div>
                    </div>
                </div>

                <button class="btn-mini-action btn btn-secondary" style="width: 100%; padding: 8px 12px; font-size: 0.85rem; margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid ${colorVar}50; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                    <i class="ph-bold ph-check-circle" style="color: ${colorVar}; font-size: 1rem;"></i>
                    <span>${item.actionText}</span>
                </button>
            `;

            // Edit listener
            card.querySelector('.btn-card-edit')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.openEditModal('lenses', item.key, item.name, lastDateVal);
            });

            // Action listener
            card.querySelector('.btn-mini-action')?.addEventListener('click', () => {
                if (item.isLens) {
                    let stock = parseInt(localStorage.getItem('lensStock')) || 0;
                    if (stock > 0) {
                        stock -= 1;
                        localStorage.setItem('lensStock', stock);
                        const today = getLocalISODate();
                        localStorage.setItem('lensDate', today);
                        this.loadDatesAndStock();
                        this.app.auth?.syncToCloud(false).catch(() => {});
                        alert('Nuevo par en uso. Stock descontado.');
                    } else {
                        const today = getLocalISODate();
                        localStorage.setItem('lensDate', today);
                        this.loadDatesAndStock();
                        this.app.auth?.syncToCloud(false).catch(() => {});
                        alert('Nuevo par en uso registrado.');
                    }
                } else {
                    const today = getLocalISODate();
                    localStorage.setItem(item.key, today);
                    this.loadDatesAndStock();
                    this.app.auth?.syncToCloud(false).catch(() => {});
                }
            });

            container.appendChild(card);
        });
    }

    checkStockWarning(stock) {
        if (!this.stockWarning || !this.inputStock) return;
        const val = parseInt(stock) || 0;
        
        let colorVar = 'var(--status-green)';
        let glowVar = 'rgba(16, 185, 129, 0.15)';
        
        if (val <= 1) {
            colorVar = 'var(--status-red)';
            glowVar = 'rgba(239, 68, 68, 0.15)';
            this.stockWarning.innerText = "⚠️ ¡Atención! Stock crítico. Comprar repuestos urgente.";
            this.stockWarning.classList.remove('hidden');
            this.stockWarning.style.color = colorVar;
        } else if (val === 2) {
            colorVar = 'var(--status-orange)';
            glowVar = 'rgba(249, 115, 22, 0.15)';
            this.stockWarning.innerText = "⚠️ Stock bajo. Recordar comprar repuestos pronto.";
            this.stockWarning.classList.remove('hidden');
            this.stockWarning.style.color = colorVar;
        } else if (val === 3) {
            colorVar = 'var(--status-yellow)';
            glowVar = 'rgba(245, 158, 11, 0.15)';
            this.stockWarning.innerText = "Stock aceptable (3 pares restantes).";
            this.stockWarning.classList.remove('hidden');
            this.stockWarning.style.color = colorVar;
        } else {
            this.stockWarning.classList.add('hidden');
        }

        this.inputStock.style.borderColor = colorVar;
        this.inputStock.style.color = colorVar;
        this.inputStock.style.boxShadow = `0 0 8px ${glowVar}`;
    }

    getLensesHistory() {
        const raw = localStorage.getItem('lensesHistory');
        if (!raw) return [];
        try {
            return JSON.parse(raw) || [];
        } catch (e) {
            console.error("Error parsing lensesHistory:", e);
            return [];
        }
    }

    saveToHistory(endTime = new Date()) {
        if (!this.startTime) return;
        const start = new Date(this.startTime);
        let diff = Math.max(endTime - start, 0);
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        
        const session = {
            date: start.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
            duration: `${h}h ${m}m`
        };

        let history = this.getLensesHistory();
        history.unshift(session);
        if (history.length > 7) history.pop();
        
        localStorage.setItem('lensesHistory', JSON.stringify(history));
        this.renderHistory();
    }

    renderHistory() {
        if (!this.historyList) return;
        const history = this.getLensesHistory();
        this.historyList.innerHTML = '';
        
        if (history.length === 0) {
            this.historyList.innerHTML = '<li><span class="hist-date">Sin registros aún</span></li>';
            return;
        }

        history.forEach((item, index) => {
            const li = document.createElement('li');
            const safeDate = escapeHtml(item.date || '-');
            const safeDuration = escapeHtml(item.duration || '-');
            li.innerHTML = `
                <div style="display: flex; gap: 10px; flex-grow: 1; justify-content: space-between; align-items: center;">
                    <span class="hist-date">${safeDate}</span>
                    <span class="hist-time">${safeDuration}</span>
                </div>
                <button type="button" class="btn-delete-entry" data-index="${index}" title="Borrar registro" aria-label="Borrar uso de lentes del ${safeDate}">❌</button>
            `;
            this.historyList.appendChild(li);
        });

        this.historyList.querySelectorAll('.btn-delete-entry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.closest('button').getAttribute('data-index');
                if (confirm('¿Borrar este registro del historial?')) {
                    let history = this.getLensesHistory();
                    history.splice(index, 1);
                    localStorage.setItem('lensesHistory', JSON.stringify(history));
                    this.renderHistory();
                }
            });
        });
    }

    initListeners() {
        const dateInputIds = [
            { id: 'lenses-lensDate', key: 'lensDate' },
            { id: 'lenses-solutionDate', key: 'solutionDate' },
            { id: 'lenses-caseDate', key: 'caseDate' },
            { id: 'lenses-systaneDate', key: 'systaneDate' },
            { id: 'lenses-clothWashDate', key: 'clothWashDate' },
            { id: 'lenses-clothChangeDate', key: 'clothChangeDate' }
        ];

        dateInputIds.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) {
                el.addEventListener('change', (e) => {
                    localStorage.setItem(item.key, e.target.value);
                    this.loadDatesAndStock();
                });
            }
        });

        if (this.inputStock) {
            this.inputStock.addEventListener('change', (e) => {
                localStorage.setItem('lensStock', e.target.value);
                this.checkStockWarning(e.target.value);
            });
        }

        if (this.btnNewPair) {
            this.btnNewPair.addEventListener('click', () => {
                let stock = parseInt(localStorage.getItem('lensStock')) || 0;
                if (stock > 0) {
                    stock -= 1;
                    localStorage.setItem('lensStock', stock);
                    const today = getLocalISODate();
                    localStorage.setItem('lensDate', today);
                    this.loadDatesAndStock();
                    alert('Nuevo par en uso. Stock descontado.');
                } else {
                    alert('El stock ya está en 0.');
                }
            });
        }

        if (this.btnClearHistory) {
            this.btnClearHistory.addEventListener('click', () => {
                if (confirm('¿Borrar todo el historial de uso de lentes?')) {
                    localStorage.removeItem('lensesHistory');
                    this.renderHistory();
                }
            });
        }

        if (this.btnPut) this.btnPut.addEventListener('click', () => this.putLenses());
        if (this.btnRemove) this.btnRemove.addEventListener('click', () => this.removeLenses());
    }

    init() {
        this.initListeners();
        this.updateUI();
        this.loadDatesAndStock();
        this.renderHistory();
    }
}
