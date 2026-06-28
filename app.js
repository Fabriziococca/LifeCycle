// Configuración original de ítems de Higiene (LifeCycle)
const itemsConfig = [
    {
        id: 'esponja_africana',
        name: 'Esponja Africana',
        icon: 'ph-sparkle',
        limits: { yellow: 11, orange: 15, red: 30 },
        type: 'wash',
        category: 'cuidado_personal'
    },
    {
        id: 'toalla_mano',
        name: 'Toalla de Mano',
        icon: 'ph-hand-palm',
        limits: { yellow: 2, orange: 3, red: 4 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'toalla_cuerpo',
        name: 'Toalla de Cuerpo',
        icon: 'ph-drop',
        limits: { yellow: 5, orange: 7, red: 8 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'sabanas',
        name: 'Sábanas (Completas)',
        icon: 'ph-bed',
        limits: { yellow: 5, orange: 7, red: 8 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'funda_almohada',
        name: 'Funda de Almohada',
        icon: 'ph-moon',
        limits: { yellow: 2, orange: 3, red: 4 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'cepillo_dientes',
        name: 'Cepillo de Dientes',
        icon: 'ph-tooth',
        limits: { yellow: 75, orange: 85, red: 90 },
        type: 'change',
        category: 'cuidado_personal'
    },
    {
        id: 'celular',
        name: 'Celular (Funda y Pantalla)',
        icon: 'ph-phone',
        limits: { yellow: 3, orange: 5, red: 7 },
        type: 'clean',
        category: 'tecnologia',
        instructions: [
            { step: 'Acción', text: 'Rocía el limpiador de pantallas Compitt en un paño de microfibra óptico tipo gamuza.' },
            { step: 'Técnica', text: 'Pasa el paño suavemente en movimientos rectos para eliminar huellas y grasitud. Nunca apliques el líquido directo sobre el vidrio ni uses alcohol común.' },
            { step: 'Acción', text: 'Retira la funda del teléfono. Humedece una microfibra multiuso con alcohol isopropílico.' },
            { step: 'Técnica', text: 'Frota todo el cuerpo interno y externo para cortar la grasitud pegada. Si está muy sucia, lavala en la bacha con agua y una gota de jabón blanco neutro. Secala al 100% antes de volver a colocarla.' }
        ]
    },
    {
        id: 'computadora',
        name: 'Computadora (Teclado y Ext.)',
        icon: 'ph-laptop',
        limits: { yellow: 7, orange: 11, red: 15 },
        type: 'clean',
        category: 'tecnologia',
        instructions: [
            { step: 'Teclado y Puertos', text: 'Usa la perita de aire y los cepillos del kit 20 en 1 para sacar el polvo flotante de las ranuras.' },
            { step: 'Chasis y Plásticos', text: 'Humedece una microfibra multiuso con alcohol isopropílico y repasa la tapa, la base y el apoya muñecas para eliminar el brillo aceitoso.' },
            { step: 'Pantalla Mate', text: 'Rocía el Compitt Kleen Screen únicamente sobre el paño de lentes y limpia sin presionar para no dañar el panel IPS.' },
            { step: 'Cables', text: 'Limpia el cable de carga con isopropílico y acomodalo por detrás del equipo con una curva relajada para evitar tensiones mecánicas.' }
        ]
    },
    {
        id: 'mouse',
        name: 'Mouse (Limpieza)',
        icon: 'ph-mouse',
        limits: { yellow: 7, orange: 14, red: 21 },
        type: 'clean',
        category: 'tecnologia',
        instructions: [
            { step: 'Acción', text: 'Usa la punta de precisión del kit 20 en 1 para recorrer las uniones de los plásticos y rasquetear la grasitud acumulada.' },
            { step: 'Técnica', text: 'Barre el residuo con el cepillo de cerdas duras. Luego, humedece una microfibra con alcohol isopropílico y repasa todo el cuerpo y la ruedita para desengrasarlo.' }
        ]
    },
    {
        id: 'auriculares',
        name: 'Auriculares (Limpieza)',
        icon: 'ph-headphones',
        limits: { yellow: 15, orange: 30, red: 45 },
        type: 'clean',
        category: 'tecnologia',
        instructions: [
            { step: 'Almohadillas (Cuerina)', text: 'Humedece apenas una microfibra con limpiador de pantallas neutro. Nunca uses isopropílico acá porque cuartea el material sintético.' },
            { step: 'Rejillas y Ranuras', text: 'Limpia las mallas metálicas o de tela usando los cepillos cilíndricos finos del kit y sopletea con la perita de aire para eliminar pelusas que obstruyan el sonido.' }
        ]
    },
    {
        id: 'pad_cepillado',
        name: 'Pad XL (Cepillado en seco)',
        icon: 'ph-paint-brush',
        limits: { yellow: 7, orange: 14, red: 21 },
        type: 'brush',
        category: 'tecnologia',
        instructions: [
            { step: 'Acción', text: 'Usa un cepillo de cerdas medianas o duras (como el de ropa o interiores de auto).' },
            { step: 'Técnica', text: 'Frota de forma vertical y con firmeza sobre la tela para levantar el polvo depositado, las migas y las escamas de piel. Lleva el pad afuera y sacudilo con ganas para eliminar el polvillo suelto.' }
        ]
    },
    {
        id: 'pad_lavado',
        name: 'Pad XL (Lavado a fondo)',
        icon: 'ph-waves',
        limits: { yellow: 60, orange: 75, red: 90 },
        type: 'wash',
        category: 'tecnologia',
        instructions: [
            { step: 'Lavado', text: 'Sumerge el pad en la bacha con agua tibia (nunca caliente). Aplica un chorrito de shampoo para el pelo para cortar el sebo corporal. Frega suavemente en círculos con un cepillo de cerdas blandas.' },
            { step: 'Enjuague y Secado', text: 'Enjuaga con agua fría hasta retirar todo el jabón. No lo retuerzas. Apoyalo plano sobre una toalla, enrollalo como un pionono para sacar el exceso de agua y déjalo secar estirado a la sombra.' }
        ]
    }
];

// Configuración de Zonas de Cuidado Corporal (HabitSync)
const ZONES = [
    { id: 'barba', name: 'Barba', isHero: true },
    { id: 'pelo', name: 'Pelo', isHero: false },
    { id: 'axilas', name: 'Axilas', isHero: false },
    { id: 'pecho_panza', name: 'Pecho y Panza', isHero: false },
    { id: 'brazos', name: 'Brazos', isHero: false },
    { id: 'piernas', name: 'Piernas', isHero: false },
    { id: 'intimas', name: 'Zonas Íntimas', isHero: false },
    { id: 'hoja_gillette', name: 'Hoja Gillette', isHero: false, isTool: true }
];

// Límites de Lentes de Contacto (LensTracker) en Días
const LENS_LIMITS = {
    lenses: 60,
    solution: 90,
    case: 90,
    systane: 90,
    clothWash: 15,
    clothChange: 270
};

const CIRCUMFERENCE = 502; // 2 * Math.PI * 80 (basado en r=80 del SVG)

// ==========================================================================
// MÓDULO 1: HIGIENE (Original HygieneTracker)
// ==========================================================================
class HygieneModule {
    constructor(appController) {
        this.app = appController;
        this.currentCategory = 'todos';
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
        if (!dateString) return null;
        const lastWashed = new Date(dateString);
        lastWashed.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - lastWashed);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
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
        if (!dateInput) return 'Nunca (Nuevo)';
        const date = new Date(dateInput);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateCompare = new Date(date);
        dateCompare.setHours(0, 0, 0, 0);
        
        if (dateCompare.getTime() === today.getTime()) return 'Hoy';
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateCompare.getTime() === yesterday.getTime()) return 'Ayer';

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (dateCompare.getTime() === tomorrow.getTime()) return 'Mañana';

        const currentYear = today.getFullYear();
        const displayOptions = dateCompare.getFullYear() !== currentYear 
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { month: 'short', day: 'numeric' };
            
        return date.toLocaleDateString('es-ES', displayOptions);
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
        this.data[id] = new Date().toISOString();
        this.saveData();
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const filteredItems = this.currentCategory === 'todos' 
            ? itemsConfig 
            : itemsConfig.filter(item => item.category === this.currentCategory);

        filteredItems.forEach(item => {
            const type = item.type || 'wash';
            const lastDateVal = this.data[item.id];
            const daysElapsed = this.getDaysElapsed(lastDateVal);
            const statusClass = this.getStatusClass(daysElapsed, item.limits);
            const statusText = this.getStatusText(statusClass, type);

            const clone = this.template.content.cloneNode(true);
            const cardEl = clone.querySelector('.card');
            
            cardEl.className = `card ${statusClass}`;
            clone.querySelector('.card-icon').className = `ph ${item.icon}`;
            clone.querySelector('.card-title').textContent = item.name;
            clone.querySelector('.status-text').textContent = statusText;
            clone.querySelector('.days-count').textContent = daysElapsed === null ? '0' : daysElapsed;
            
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

            this.container.appendChild(clone);
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

    init() {
        this.initTabs();
        this.render();
    }
}


// ==========================================================================
// MÓDULO 2: CUIDADO CORPORAL (HabitSync)
// ==========================================================================
class GroomingModule {
    constructor(appController) {
        this.app = appController;
        this.data = this.loadData();
        
        this.barbaSection = document.getElementById('barba-section');
        this.gridSection = document.getElementById('cuidado-grid-section');
        this.toolsSection = document.getElementById('cuidado-tools-section');
        this.btnFullReset = document.getElementById('btn-full-reset');
        
        this.init();
    }

    loadData() {
        return JSON.parse(localStorage.getItem('groomingData_v2')) || {};
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
        if (!historyArray || historyArray.length < 2) return 'Sugerencia: Faltan registros para proyectar';
        
        let totalDiff = 0;
        let count = Math.min(historyArray.length - 1, 3);
        for (let i = 0; i < count; i++) {
            const d1 = new Date(historyArray[i]);
            const d2 = new Date(historyArray[i+1]);
            totalDiff += (d1 - d2);
        }
        const avgDiff = totalDiff / count; 
        const nextDate = new Date(new Date(historyArray[0]).getTime() + avgDiff);
        
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
    }

    renderHistoryLog(zoneId, historyArray, logContainer) {
        if (!historyArray || historyArray.length === 0) {
            logContainer.innerHTML = '<i>Sin registros</i>';
            return;
        }
        logContainer.innerHTML = historyArray.slice(0, 5).map(dateStr => {
            const dateObj = new Date(dateStr);
            const formatted = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
            return `<div class="history-item"><span>${formatted}</span></div>`;
        }).join('');
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
                
                if (zone.id === 'barba') {
                    if (daysDiff <= 2) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff === 3) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else if (zone.id === 'hoja_gillette') {
                    if (daysDiff <= 30) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 40) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
                    else { colorVar = 'var(--status-red)'; borderColor = 'var(--status-red)'; }
                } else {
                    colorVar = 'var(--primary-color)';
                }
            }

            const card = document.createElement('div');
            card.className = zone.isHero ? 'card hero-card' : 'card';
            if (zone.isHero && daysDiff !== null) {
                card.style.borderColor = borderColor;
            }

            card.innerHTML = `
                <div class="card-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="icon-container">
                            <i class="ph ${zone.id === 'barba' ? 'ph-scissors' : zone.isTool ? 'ph-sparkle' : 'ph-user'}"></i>
                        </div>
                        <h3 style="font-size: 1.2rem; font-weight:600;">${zone.name}</h3>
                    </div>
                    <button class="btn-edit" title="Editar última fecha">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                </div>
                <div class="days-count" style="color: ${colorVar}">${daysText}</div>
                ${zone.id === 'barba' ? `<div class="prediction-text">${this.updatePrediction(history)}</div>` : ''}
                <button class="btn btn-record">✓ Listo</button>
                <button class="btn btn-history" style="margin-top: 0.5rem;">Ver historial</button>
                <div class="history-log hidden"></div>
            `;

            card.querySelector('.btn-record').addEventListener('click', () => this.recordSession(zone.id));
            
            const logContainer = card.querySelector('.history-log');
            this.renderHistoryLog(zone.id, history, logContainer);
            
            card.querySelector('.btn-history').addEventListener('click', () => {
                logContainer.classList.toggle('hidden');
            });

            card.querySelector('.btn-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.openEditModal('grooming', zone.id, zone.name, lastSession);
            });

            if (zone.isHero) {
                this.barbaSection.appendChild(card);
            } else if (zone.isTool) {
                this.toolsSection.appendChild(card);
            } else {
                this.gridSection.appendChild(card);
            }
        });
    }

    init() {
        if (this.btnFullReset) {
            this.btnFullReset.addEventListener('click', () => {
                if (confirm('¿Hiciste un service corporal completo HOY? Se actualizarán todas las zonas.')) {
                    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                    const now = new Date().toISOString();
                    ZONES.forEach(zone => {
                        if (zone.isTool) return;
                        if (!this.data[zone.id]) this.data[zone.id] = [];
                        this.data[zone.id].unshift(now);
                        if (this.data[zone.id].length > 10) this.data[zone.id].pop();
                    });
                    this.saveData();
                    this.render();
                }
            });
        }
        this.render();
    }
}


// ==========================================================================
// MÓDULO 3: LENTES DE CONTACTO (LensTracker)
// ==========================================================================
class LensModule {
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
            new Notification("LifeCycle - Lentes", { body: "Llevás 8 horas con los lentes. ¡Dales un descanso!", icon: "icon.png" });
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

    updateLabelStyle(element, days, limit) {
        if (!element) return;
        if (days === "--") {
            element.style.color = "var(--text-secondary)";
            return;
        }
        
        const daysInt = parseInt(days);
        if (daysInt >= limit) {
            element.style.color = "var(--status-red)";
        } else if (daysInt >= limit * 0.85) {
            element.style.color = "var(--status-yellow)";
        } else {
            element.style.color = "var(--status-green)";
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
            this.updateLabelStyle(elLDays, lDays, LENS_LIMITS.lenses);
        }

        // Líquido
        const sDays = this.calculateDaysElapsed(sDate);
        const elSDate = document.getElementById('lenses-solutionDate');
        if (elSDate) elSDate.value = sDate || "";
        const elSDays = document.getElementById('lenses-solutionDaysElapsed');
        if (elSDays) {
            elSDays.innerText = `${sDays} días de uso`;
            this.updateLabelStyle(elSDays, sDays, LENS_LIMITS.solution);
        }

        // Estuche
        const cDays = this.calculateDaysElapsed(cDate);
        const elCDate = document.getElementById('lenses-caseDate');
        if (elCDate) elCDate.value = cDate || "";
        const elCDays = document.getElementById('lenses-caseDaysElapsed');
        if (elCDays) {
            elCDays.innerText = `${cDays} días de uso`;
            this.updateLabelStyle(elCDays, cDays, LENS_LIMITS.case);
        }

        // Systane
        const sysDays = this.calculateDaysElapsed(sysDate);
        const elSysDate = document.getElementById('lenses-systaneDate');
        if (elSysDate) elSysDate.value = sysDate || "";
        const elSysDays = document.getElementById('lenses-systaneDaysElapsed');
        if (elSysDays) {
            elSysDays.innerText = `${sysDays} días de uso`;
            this.updateLabelStyle(elSysDays, sysDays, LENS_LIMITS.systane);
        }

        // Pañuelo lavado
        const cwDays = this.calculateDaysElapsed(cwDate);
        const elCwDate = document.getElementById('lenses-clothWashDate');
        if (elCwDate) elCwDate.value = cwDate || "";
        const elCwDays = document.getElementById('lenses-clothWashDaysElapsed');
        if (elCwDays) {
            elCwDays.innerText = `${cwDays} días desde lavado`;
            this.updateLabelStyle(elCwDays, cwDays, LENS_LIMITS.clothWash);
        }

        // Pañuelo cambio
        const ccDays = this.calculateDaysElapsed(ccDate);
        const elCcDate = document.getElementById('lenses-clothChangeDate');
        if (elCcDate) elCcDate.value = ccDate || "";
        const elCcDays = document.getElementById('lenses-clothChangeDaysElapsed');
        if (elCcDays) {
            elCcDays.innerText = `${ccDays} días de uso`;
            this.updateLabelStyle(elCcDays, ccDays, LENS_LIMITS.clothChange);
        }
    }

    checkStockWarning(stock) {
        if (!this.stockWarning) return;
        if (parseInt(stock) <= 1) this.stockWarning.classList.remove('hidden');
        else this.stockWarning.classList.add('hidden');
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

        let history = JSON.parse(localStorage.getItem('lensesHistory')) || [];
        history.unshift(session);
        if (history.length > 7) history.pop();
        
        localStorage.setItem('lensesHistory', JSON.stringify(history));
        this.renderHistory();
    }

    renderHistory() {
        if (!this.historyList) return;
        const history = JSON.parse(localStorage.getItem('lensesHistory')) || [];
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
                    let history = JSON.parse(localStorage.getItem('lensesHistory')) || [];
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
                    const today = new Date().toISOString().split('T')[0];
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


// ==========================================================================
// MÓDULO 4: COPIAS DE SEGURIDAD (BackupModule - Tolerante a Fallos)
// ==========================================================================
class BackupModule {
    constructor(appController) {
        this.app = appController;
        this.btnExport = document.getElementById('btnExportUnified');
        this.importFile = document.getElementById('importFileUnified');
        this.init();
    }

    exportUnifiedData() {
        const unifiedData = {
            appName: "LifeCycle",
            exportDate: new Date().toISOString(),
            hygiene_tracker_data: localStorage.getItem('hygiene_tracker_data'),
            groomingData_v2: localStorage.getItem('groomingData_v2'),
            lensesStartTime: localStorage.getItem('lensesStartTime'),
            lensesHistory: localStorage.getItem('lensesHistory'),
            lensStock: localStorage.getItem('lensStock'),
            lensDate: localStorage.getItem('lensDate'),
            solutionDate: localStorage.getItem('solutionDate'),
            caseDate: localStorage.getItem('caseDate'),
            systaneDate: localStorage.getItem('systaneDate'),
            clothWashDate: localStorage.getItem('clothWashDate'),
            clothChangeDate: localStorage.getItem('clothChangeDate')
        };

        const blob = new Blob([JSON.stringify(unifiedData, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `LifeCycle_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawData = JSON.parse(e.target.result);
                let importedCategories = [];

                if (rawData.groomingData_v2) {
                    const dataVal = typeof rawData.groomingData_v2 === 'string' 
                        ? rawData.groomingData_v2 
                        : JSON.stringify(rawData.groomingData_v2);
                    localStorage.setItem('groomingData_v2', dataVal);
                    importedCategories.push("Cuidado Corporal (HabitSync)");
                }

                const lensKeys = [
                    'lensDate', 'solutionDate', 'caseDate', 'systaneDate',
                    'clothWashDate', 'clothChangeDate', 'lensStock',
                    'lensesHistory', 'lensesStartTime'
                ];
                let lensFound = false;
                lensKeys.forEach(key => {
                    if (rawData[key] !== undefined && rawData[key] !== null) {
                        const val = typeof rawData[key] === 'object' ? JSON.stringify(rawData[key]) : rawData[key];
                        localStorage.setItem(key, val);
                        lensFound = true;
                    }
                });
                if (lensFound) {
                    importedCategories.push("Lentes de Contacto (LensTracker)");
                }

                if (rawData.hygiene_tracker_data) {
                    const dataVal = typeof rawData.hygiene_tracker_data === 'string' 
                        ? rawData.hygiene_tracker_data 
                        : JSON.stringify(rawData.hygiene_tracker_data);
                    localStorage.setItem('hygiene_tracker_data', dataVal);
                    importedCategories.push("Higiene");
                } else if (rawData.appName === undefined && !rawData.groomingData_v2 && !lensFound) {
                    localStorage.setItem('hygiene_tracker_data', JSON.stringify(rawData));
                    importedCategories.push("Higiene");
                }

                if (importedCategories.length > 0) {
                    alert(`Backup restaurado correctamente. Módulos importados:\n- ${importedCategories.join('\n- ')}`);
                    location.reload();
                } else {
                    alert('Archivo JSON válido pero no contiene datos compatibles de LifeCycle, HabitSync o LensTracker.');
                }
            } catch (err) {
                console.error(err);
                alert('Ocurrió un error al procesar el archivo. Asegúrate de que sea un JSON válido.');
            }
        };
        reader.readAsText(file);
    }

    init() {
        if (this.btnExport) {
            this.btnExport.addEventListener('click', () => this.exportUnifiedData());
        }
        if (this.importFile) {
            this.importFile.addEventListener('change', (e) => this.importData(e));
        }
    }
}


// ==========================================================================
// CONTROLADOR CENTRAL: APP CONTROLLER
// ==========================================================================
class AppController {
    constructor() {
        this.currentEditType = null;
        this.currentEditId = null;

        this.modal = document.getElementById('edit-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalDesc = document.getElementById('modal-desc');
        this.modalDate = document.getElementById('modal-date');
        this.modalCancel = document.getElementById('modal-cancel');
        this.modalSave = document.getElementById('modal-save');
        
        this.initNavigation();
        this.initModalListeners();
        this.deferredPrompt = null;
        this.initPWAInstall();
    }

    initNavigation() {
        const mainNav = document.getElementById('main-nav');
        if (!mainNav) return;

        mainNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-btn');
            if (!btn) return;

            mainNav.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const activeSectionId = btn.dataset.section;
            document.querySelectorAll('.main-section').forEach(sec => {
                sec.classList.toggle('hidden', sec.id !== activeSectionId);
            });
            
            if (activeSectionId === 'cuidado-section') {
                this.grooming.render();
            } else if (activeSectionId === 'lentes-section') {
                this.lenses.updateUI();
                this.lenses.loadDatesAndStock();
                this.lenses.renderHistory();
            } else if (activeSectionId === 'higiene-section') {
                this.hygiene.render();
            }
        });
    }

    openEditModal(type, id, displayName, currentDateVal) {
        this.currentEditType = type;
        this.currentEditId = id;
        
        if (this.modalTitle) {
            this.modalTitle.innerText = `Editar: ${displayName}`;
        }
        if (this.modalDesc) {
            this.modalDesc.innerText = type === 'hygiene' 
                ? '¿Cuándo realizaste la última acción de lavado o limpieza?' 
                : '¿Cuándo registraste este hábito corporal por última vez?';
        }

        let dateToSet = new Date();
        if (currentDateVal) {
            dateToSet = new Date(currentDateVal);
        }
        
        const yyyy = dateToSet.getFullYear();
        const mm = String(dateToSet.getMonth() + 1).padStart(2, '0');
        const dd = String(dateToSet.getDate()).padStart(2, '0');
        
        if (this.modalDate) {
            this.modalDate.value = `${yyyy}-${mm}-${dd}`;
        }

        this.modal?.classList.remove('hidden');
    }

    closeModal() {
        this.modal?.classList.add('hidden');
        this.currentEditType = null;
        this.currentEditId = null;
    }

    saveModalDate() {
        if (!this.currentEditId || !this.modalDate || !this.modalDate.value) return;

        const selectedDate = new Date(this.modalDate.value);
        const now = new Date();
        selectedDate.setHours(now.getHours());
        selectedDate.setMinutes(now.getMinutes());
        selectedDate.setSeconds(now.getSeconds());

        const isoString = selectedDate.toISOString();

        if (this.currentEditType === 'hygiene') {
            this.hygiene.data[this.currentEditId] = isoString;
            this.hygiene.saveData();
            this.hygiene.render();
        } else if (this.currentEditType === 'grooming') {
            if (!this.grooming.data[this.currentEditId]) {
                this.grooming.data[this.currentEditId] = [];
            }
            
            if (this.grooming.data[this.currentEditId].length > 0) {
                this.grooming.data[this.currentEditId][0] = isoString;
            } else {
                this.grooming.data[this.currentEditId].unshift(isoString);
            }
            
            this.grooming.data[this.currentEditId].sort((a, b) => new Date(b) - new Date(a));
            this.grooming.saveData();
            this.grooming.render();
        }

        this.closeModal();
    }

    initModalListeners() {
        this.modalCancel?.addEventListener('click', () => this.closeModal());
        this.modalSave?.addEventListener('click', () => this.saveModalDate());
    }

    initPWAInstall() {
        const installCard = document.getElementById('pwa-install-card');
        const btnInstall = document.getElementById('btnInstallPWA');
        const manualGuide = document.getElementById('pwa-manual-guide');
        const installedMessage = document.getElementById('pwa-installed-message');
        const installControls = document.getElementById('pwa-install-controls');

        // Detectar modo standalone (ya instalada)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (isStandalone) {
            if (installedMessage) installedMessage.classList.remove('hidden');
            if (installControls) installControls.classList.add('hidden');
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            this.deferredPrompt = e;
            // Mostrar botón de instalación nativo
            if (btnInstall && !isStandalone) {
                btnInstall.classList.remove('hidden');
            }
            // Ocultar guía manual ya que el botón nativo está activo
            if (manualGuide && !isStandalone) {
                manualGuide.classList.add('hidden');
            }
        });

        if (btnInstall) {
            btnInstall.addEventListener('click', async () => {
                if (!this.deferredPrompt) return;
                // Show the install prompt
                this.deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`User response to install: ${outcome}`);
                // Clear the prompt, it can't be reused
                this.deferredPrompt = null;
                // Ocultar el botón
                btnInstall.classList.add('hidden');
                // Mostrar guía manual si cancelaron
                if (outcome !== 'accepted' && manualGuide) {
                    manualGuide.classList.remove('hidden');
                }
            });
        }

        window.addEventListener('appinstalled', (e) => {
            console.log('LifeCycle was installed');
            this.deferredPrompt = null;
            if (installedMessage) installedMessage.classList.remove('hidden');
            if (installControls) installControls.classList.add('hidden');
        });
    }

    start() {
        this.hygiene = new HygieneModule(this);
        this.grooming = new GroomingModule(this);
        this.lenses = new LensModule(this);
        this.backups = new BackupModule(this);
        
        setInterval(() => {
            const activeSection = document.querySelector('.main-section:not(.hidden)');
            if (activeSection) {
                if (activeSection.id === 'higiene-section') this.hygiene.render();
                else if (activeSection.id === 'cuidado-section') this.grooming.render();
                else if (activeSection.id === 'lenses-section') this.lenses.loadDatesAndStock();
            }
        }, 1000 * 60 * 60);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new AppController();
    controller.start();
});
