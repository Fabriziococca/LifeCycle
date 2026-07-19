import { LENS_LIMITS } from '../utils.js';
import { getLocalISODate } from '../utils.js';

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
        if (!dateString) return "--";
        const start = new Date(dateString);
        start.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffTime = Math.abs(today - start);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
        const template = document.getElementById('card-template');
        if (!container || !template) return;

        container.innerHTML = '';

        const items = [
            { key: 'lensDate', name: 'Lentes de Contacto', limit: LENS_LIMITS.lenses, icon: 'ph-eye', actionText: 'Registrar Cambio', isLens: true },
            { key: 'solutionDate', name: 'Solución Limpiadora', limit: LENS_LIMITS.solution, icon: 'ph-drop', actionText: 'Registrar Apertura' },
            { key: 'caseDate', name: 'Estuche de Lentes', limit: LENS_LIMITS.case, icon: 'ph-archive', actionText: 'Registrar Reemplazo' },
            { key: 'systaneDate', name: 'Gotas Systane', limit: LENS_LIMITS.systane, icon: 'ph-eyedropper', actionText: 'Registrar Apertura' },
            { key: 'clothWashDate', name: 'Pañuelo (Lavado)', limit: LENS_LIMITS.clothWash, icon: 'ph-spray', actionText: 'Registrar Lavado' },
            { key: 'clothChangeDate', name: 'Pañuelo (Cambio)', limit: LENS_LIMITS.clothChange, icon: 'ph-arrows-clockwise', actionText: 'Registrar Reemplazo' }
        ];

        items.forEach(item => {
            const lastDateVal = localStorage.getItem(item.key) || null;
            const daysElapsed = this.calculateDaysElapsed(lastDateVal);
            
            let statusClass = 'status-green';
            let colorVar = 'var(--status-green)';
            let statusText = 'OK';

            if (daysElapsed !== '--' && daysElapsed !== null) {
                const daysInt = parseInt(daysElapsed);
                if (daysInt >= item.limit) {
                    statusClass = 'status-red';
                    colorVar = 'var(--status-red)';
                    statusText = 'CAMBIAR URGENTE';
                } else if (daysInt >= item.limit * 0.85) {
                    statusClass = 'status-yellow';
                    colorVar = 'var(--status-yellow)';
                    statusText = 'REEMPLAZAR PRONTO';
                } else if (daysInt >= item.limit * 0.70) {
                    statusClass = 'status-orange';
                    colorVar = 'var(--status-orange)';
                    statusText = 'ATENCIÓN';
                }
            }

            const clone = template.content.cloneNode(true);
            const cardEl = clone.querySelector('.card');
            cardEl.className = `card ${statusClass}`;
            cardEl.style.borderColor = colorVar;

            clone.querySelector('.card-title').textContent = item.name;
            clone.querySelector('.card-icon').className = `card-icon ph ${item.icon}`;
            clone.querySelector('.days-count').textContent = daysElapsed !== null && daysElapsed !== '--' ? daysElapsed : '--';
            clone.querySelector('.days-count').style.color = colorVar;
            clone.querySelector('.status-text').textContent = statusText;
            clone.querySelector('.status-dot').style.backgroundColor = colorVar;

            clone.querySelector('.last-date-label').textContent = 'Último cambio';
            clone.querySelector('.next-date-label').textContent = 'Próximo cambio';
            clone.querySelector('.last-date').textContent = lastDateVal ? lastDateVal.split('-').reverse().join('/') : 'N/A';

            if (lastDateVal) {
                const d = new Date(lastDateVal);
                d.setDate(d.getDate() + item.limit);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                clone.querySelector('.next-date').textContent = `${dd}/${mm}/${yyyy}`;
            } else {
                clone.querySelector('.next-date').textContent = 'N/A';
            }

            const progressPct = daysElapsed !== '--' && daysElapsed !== null ? Math.min((parseInt(daysElapsed) / item.limit) * 100, 100) : 0;
            clone.querySelector('.progress-bar').style.width = `${progressPct}%`;
            clone.querySelector('.progress-bar').style.backgroundColor = colorVar;

            // Ocultar instrucciones
            const infoBtn = clone.querySelector('.btn-info');
            if (infoBtn) infoBtn.style.display = 'none';
            const instCollapse = clone.querySelector('.instructions-collapse');
            if (instCollapse) instCollapse.style.display = 'none';

            // Botón Editar
            const editBtn = clone.querySelector('.btn-card-edit');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.app.openEditModal('lenses', item.key, item.name, lastDateVal);
                });
            }

            // Botón de Acción Principal
            let actionBtn = clone.querySelector('.btn-wash');
            if (actionBtn) {
                actionBtn.querySelector('span').textContent = item.actionText;
                actionBtn.querySelector('i').className = 'ph-bold ph-check-circle';
                actionBtn.addEventListener('click', () => {
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
            }

            container.appendChild(clone);
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
            li.innerHTML = `
                <div style="display: flex; gap: 10px; flex-grow: 1; justify-content: space-between; align-items: center;">
                    <span class="hist-date">${item.date}</span>
                    <span class="hist-time">${item.duration}</span>
                </div>
                <button class="btn-delete-entry" data-index="${index}" title="Borrar registro">❌</button>
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
