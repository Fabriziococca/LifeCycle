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
        const lDate = localStorage.getItem('lensDate');
        const sDate = localStorage.getItem('solutionDate');
        const cDate = localStorage.getItem('caseDate');
        const sysDate = localStorage.getItem('systaneDate');
        const cwDate = localStorage.getItem('clothWashDate');
        const ccDate = localStorage.getItem('clothChangeDate');
        let stock = localStorage.getItem('lensStock') || 0;
        
        if (this.inputStock) this.inputStock.value = stock;
        this.checkStockWarning(stock);

        // Lentes
        const lDays = this.calculateDaysElapsed(lDate);
        const elLDate = document.getElementById('lenses-lensDate');
        if (elLDate) elLDate.value = lDate || "";
        const elLDays = document.getElementById('lenses-lensDaysElapsed');
        if (elLDays) {
            elLDays.innerText = `${lDays} días de uso`;
            this.updateLabelStyle(elLDays, lDays, LENS_LIMITS.lenses, elLDate);
        }

        // Líquido
        const sDays = this.calculateDaysElapsed(sDate);
        const elSDate = document.getElementById('lenses-solutionDate');
        if (elSDate) elSDate.value = sDate || "";
        const elSDays = document.getElementById('lenses-solutionDaysElapsed');
        if (elSDays) {
            elSDays.innerText = `${sDays} días de uso`;
            this.updateLabelStyle(elSDays, sDays, LENS_LIMITS.solution, elSDate);
        }

        // Estuche
        const cDays = this.calculateDaysElapsed(cDate);
        const elCDate = document.getElementById('lenses-caseDate');
        if (elCDate) elCDate.value = cDate || "";
        const elCDays = document.getElementById('lenses-caseDaysElapsed');
        if (elCDays) {
            elCDays.innerText = `${cDays} días de uso`;
            this.updateLabelStyle(elCDays, cDays, LENS_LIMITS.case, elCDate);
        }

        // Systane
        const sysDays = this.calculateDaysElapsed(sysDate);
        const elSysDate = document.getElementById('lenses-systaneDate');
        if (elSysDate) elSysDate.value = sysDate || "";
        const elSysDays = document.getElementById('lenses-systaneDaysElapsed');
        if (elSysDays) {
            elSysDays.innerText = `${sysDays} días de uso`;
            this.updateLabelStyle(elSysDays, sysDays, LENS_LIMITS.systane, elSysDate);
        }

        // Pañuelo lavado
        const cwDays = this.calculateDaysElapsed(cwDate);
        const elCwDate = document.getElementById('lenses-clothWashDate');
        if (elCwDate) elCwDate.value = cwDate || "";
        const elCwDays = document.getElementById('lenses-clothWashDaysElapsed');
        if (elCwDays) {
            elCwDays.innerText = `${cwDays} días desde lavado`;
            this.updateLabelStyle(elCwDays, cwDays, LENS_LIMITS.clothWash, elCwDate);
        }

        // Pañuelo cambio
        const ccDays = this.calculateDaysElapsed(ccDate);
        const elCcDate = document.getElementById('lenses-clothChangeDate');
        if (elCcDate) elCcDate.value = ccDate || "";
        const elCcDays = document.getElementById('lenses-clothChangeDaysElapsed');
        if (elCcDays) {
            elCcDays.innerText = `${ccDays} días de uso`;
            this.updateLabelStyle(elCcDays, ccDays, LENS_LIMITS.clothChange, elCcDate);
        }
        this.app.notificationsCenter?.updateBadge();
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
