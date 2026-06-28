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
// MÓDULO 4: SALUD
// ==========================================================================
class HealthModule {
    constructor(controller) {
        this.controller = controller;
        this.gridContainer = document.getElementById('salud-grid-section');
        this.bloodDaysCount = document.getElementById('blood-days-count');
        this.bloodLastDate = document.getElementById('blood-last-date');
        this.bloodNextDate = document.getElementById('blood-next-date');
        
        this.btnAddBlood = document.getElementById('btn-add-blood-test');
        this.bloodForm = document.getElementById('blood-test-form');
        this.bloodFormDate = document.getElementById('blood-form-date');
        this.bloodFormPdf = document.getElementById('blood-form-pdf');
        this.bloodFormPortal = document.getElementById('blood-form-portal');
        this.bloodFormCancel = document.getElementById('blood-form-cancel');
        this.bloodFormSave = document.getElementById('blood-form-save');
        this.bloodList = document.getElementById('blood-tests-list');

        // Configuración médica
        this.medicalData = JSON.parse(localStorage.getItem('health_medical_data')) || {
            dentista: { lastVisit: null, frequencyMonths: 6, history: [] },
            oculista: { lastVisit: null, frequencyMonths: 6, history: [] }
        };
        this.bloodTests = JSON.parse(localStorage.getItem('health_blood_tests')) || [];

        this.init();
    }

    saveMedicalData() {
        localStorage.setItem('health_medical_data', JSON.stringify(this.medicalData));
    }

    saveBloodTests() {
        localStorage.setItem('health_blood_tests', JSON.stringify(this.bloodTests));
    }

    init() {
        // Carga formulario análisis
        this.btnAddBlood?.addEventListener('click', () => {
            if (this.bloodForm) this.bloodForm.classList.remove('hidden');
            if (this.bloodFormDate) {
                this.bloodFormDate.value = new Date().toISOString().split('T')[0];
            }
        });

        this.bloodFormCancel?.addEventListener('click', () => {
            this.clearBloodForm();
        });

        this.bloodFormSave?.addEventListener('click', () => {
            this.saveBloodTestEntry();
        });

        this.render();
    }

    clearBloodForm() {
        if (this.bloodForm) this.bloodForm.classList.add('hidden');
        if (this.bloodFormDate) this.bloodFormDate.value = '';
        if (this.bloodFormPdf) this.bloodFormPdf.value = '';
        if (this.bloodFormPortal) this.bloodFormPortal.value = '';
    }

    saveBloodTestEntry() {
        const dateVal = this.bloodFormDate?.value;
        if (!dateVal) {
            alert('Por favor selecciona la fecha del estudio.');
            return;
        }
        
        const entry = {
            id: 'blood_' + Date.now(),
            date: dateVal,
            pdfUrl: this.bloodFormPdf?.value || '',
            portalUrl: this.bloodFormPortal?.value || ''
        };

        this.bloodTests.push(entry);
        this.bloodTests.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.saveBloodTests();
        this.clearBloodForm();
        this.render();
    }

    deleteBloodTest(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este registro de análisis de sangre?')) {
            this.bloodTests = this.bloodTests.filter(t => t.id !== id);
            this.saveBloodTests();
            this.render();
        }
    }

    calculateDaysElapsed(dateStr) {
        if (!dateStr) return null;
        const diffTime = Math.abs(new Date() - new Date(dateStr));
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    formatDate(dateStr) {
        if (!dateStr) return 'Nunca';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }

    addMonths(date, months) {
        const d = new Date(date);
        d.setMonth(d.getMonth() + Number(months));
        return d;
    }

    recordQuickVisit(key) {
        const today = new Date().toISOString().split('T')[0];
        this.medicalData[key].lastVisit = today;
        
        if (!this.medicalData[key].history) {
            this.medicalData[key].history = [];
        }
        this.medicalData[key].history.unshift(today);
        this.saveMedicalData();
        this.render();
    }

    deleteVisitHistory(key, index) {
        if (confirm('¿Seguro que quieres borrar este registro de visita?')) {
            this.medicalData[key].history.splice(index, 1);
            this.medicalData[key].lastVisit = this.medicalData[key].history.length > 0 
                ? this.medicalData[key].history[0] 
                : null;
            this.saveMedicalData();
            this.render();
        }
    }

    render() {
        this.renderMedicalCards();
        this.renderBloodTestsCard();
    }

    renderMedicalCards() {
        if (!this.gridContainer) return;
        this.gridContainer.innerHTML = '';

        Object.keys(this.medicalData).forEach(key => {
            const doc = this.medicalData[key];
            const name = key.charAt(0).toUpperCase() + key.slice(1);
            const daysElapsed = this.calculateDaysElapsed(doc.lastVisit);
            
            const frequencyDays = doc.frequencyMonths * 30.5;
            let statusColor = 'var(--status-green)';
            let statusText = 'Al día';
            let shadowColor = 'var(--status-green-glow)';
            
            if (daysElapsed === null) {
                statusColor = 'var(--text-secondary)';
                statusText = 'Sin datos';
                shadowColor = 'transparent';
            } else if (daysElapsed >= frequencyDays) {
                statusColor = 'var(--status-red)';
                statusText = 'Vencido';
                shadowColor = 'var(--status-red-glow)';
            } else if (daysElapsed >= frequencyDays - 30) {
                statusColor = 'var(--status-orange)';
                statusText = 'Próximo';
                shadowColor = 'var(--status-orange-glow)';
            }

            const daysDisplay = daysElapsed !== null ? `${daysElapsed} días` : '--';
            const lastVisitDisplay = this.formatDate(doc.lastVisit);
            
            let nextVisitDisplay = 'N/A';
            if (doc.lastVisit) {
                const nextDateObj = this.addMonths(doc.lastVisit, doc.frequencyMonths);
                const yyyy = nextDateObj.getFullYear();
                const mm = String(nextDateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(nextDateObj.getDate()).padStart(2, '0');
                nextVisitDisplay = `${dd}/${mm}/${yyyy}`;
            }

            const card = document.createElement('div');
            card.className = 'card';
            
            let historyHtml = '';
            if (doc.history && doc.history.length > 0) {
                historyHtml = doc.history.map((dateStr, idx) => `
                    <li style="font-size: 0.85rem; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0, 0, 0, 0.15); border-radius: var(--border-radius-sm);">
                        <span>${this.formatDate(dateStr)}</span>
                        <button class="btn-delete-visit-history" data-key="${key}" data-index="${idx}" title="Borrar registro" style="border:none; background:transparent; cursor:pointer;">❌</button>
                    </li>
                `).join('');
            } else {
                historyHtml = '<li style="font-size: 0.85rem; padding: 0.5rem; text-align: center; color: var(--text-secondary);">Sin visitas anteriores</li>';
            }

            card.innerHTML = `
                <div class="card-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="icon-container">
                            <i class="ph ${key === 'dentista' ? 'ph-first-aid' : 'ph-eye'}"></i>
                        </div>
                        <h3 style="font-size: 1.20rem; font-weight:600; margin:0;">${name}</h3>
                    </div>
                    <button class="btn-edit-retro-medical" data-key="${key}" title="Editar fecha de última visita" style="background:transparent; border:none; cursor:pointer; color:var(--text-secondary);">
                        <i class="ph ph-pencil-simple" style="font-size: 1.2rem;"></i>
                    </button>
                </div>
                
                <div class="card-body" style="padding: 0;">
                    <div class="frequency-control">
                        <i class="ph ph-calendar-blank"></i>
                        <span>Frecuencia:</span>
                        <input type="number" class="frequency-input" data-key="${key}" value="${doc.frequencyMonths}" min="1" max="60">
                        <span>meses</span>
                    </div>

                    <div class="time-display" style="margin-bottom: 0.5rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span class="days-count" style="color: ${statusColor}; text-shadow: 0 0 20px ${shadowColor};">${daysDisplay}</span>
                        ${daysElapsed !== null ? '<span class="days-label">desde última visita</span>' : ''}
                    </div>

                    <div class="date-info-container" style="margin-bottom: 1rem; display:flex; flex-direction:column; gap:0.4rem;">
                        <div class="date-info" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
                            <i class="ph ph-clock-counter-clockwise"></i>
                            <span>Último control: <strong>${lastVisitDisplay}</strong></span>
                        </div>
                        <div class="date-info" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
                            <i class="ph ph-calendar"></i>
                            <span>Próximo control: <strong>${nextVisitDisplay}</strong></span>
                        </div>
                    </div>

                    <button class="btn btn-record btn-quick-visit" data-key="${key}" style="width: 100%;">✓ Registrar Visita Hoy</button>
                    
                    <button class="btn btn-history btn-toggle-visit-history" style="margin-top: 0.5rem; width:100%;">Ver Historial</button>
                    <div class="history-log hidden" style="margin-top: 0.75rem;">
                        <ul style="padding-left: 0; display:flex; flex-direction:column; gap:0.4rem; list-style:none; margin:0;">
                            ${historyHtml}
                        </ul>
                    </div>
                </div>
            `;

            // Attach event listeners
            card.querySelector('.frequency-input').addEventListener('change', (e) => {
                const k = e.target.dataset.key;
                const val = parseInt(e.target.value) || 6;
                this.medicalData[k].frequencyMonths = val;
                this.saveMedicalData();
                this.render();
            });

            card.querySelector('.btn-quick-visit').addEventListener('click', (e) => {
                const k = e.currentTarget.dataset.key;
                this.recordQuickVisit(k);
            });

            card.querySelector('.btn-toggle-visit-history').addEventListener('click', (e) => {
                const log = card.querySelector('.history-log');
                const btn = e.currentTarget;
                if (log.classList.contains('hidden')) {
                    log.classList.remove('hidden');
                    btn.innerText = 'Ocultar Historial';
                } else {
                    log.classList.add('hidden');
                    btn.innerText = 'Ver Historial';
                }
            });

            card.querySelectorAll('.btn-delete-visit-history').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const k = e.currentTarget.dataset.key;
                    const idx = parseInt(e.currentTarget.dataset.index);
                    this.deleteVisitHistory(k, idx);
                });
            });

            card.querySelector('.btn-edit-retro-medical').addEventListener('click', (e) => {
                const k = e.currentTarget.dataset.key;
                const displayName = k === 'dentista' ? 'Dentista' : 'Oculista';
                this.controller.openEditModal('medical', k, displayName, this.medicalData[k].lastVisit);
            });

            this.gridContainer.appendChild(card);
        });
    }

    renderBloodTestsCard() {
        const lastTest = this.bloodTests[0];
        const daysElapsed = this.calculateDaysElapsed(lastTest?.date);

        if (this.bloodDaysCount) {
            this.bloodDaysCount.innerText = daysElapsed !== null ? daysElapsed : '--';
        }
        if (this.bloodLastDate) {
            this.bloodLastDate.innerText = this.formatDate(lastTest?.date);
        }
        if (this.bloodNextDate) {
            if (lastTest?.date) {
                const nextDate = new Date(lastTest.date);
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                const yyyy = nextDate.getFullYear();
                const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
                const dd = String(nextDate.getDate()).padStart(2, '0');
                this.bloodNextDate.innerText = `${dd}/${mm}/${yyyy}`;
            } else {
                this.bloodNextDate.innerText = 'N/A';
            }
        }

        // Render list
        if (this.bloodList) {
            this.bloodList.innerHTML = '';
            if (this.bloodTests.length > 0) {
                this.bloodTests.forEach(test => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.justifyContent = 'space-between';
                    li.style.alignItems = 'center';
                    li.style.gap = '15px';
                    li.style.padding = '0.75rem 1rem';

                    let linksHtml = '';
                    if (test.pdfUrl) {
                        linksHtml += `<a href="${test.pdfUrl}" target="_blank" class="btn-text" style="color: var(--primary-color); display:flex; align-items:center; gap:0.25rem;"><i class="ph ph-file-pdf"></i> PDF</a>`;
                    }
                    if (test.portalUrl) {
                        linksHtml += `<a href="${test.portalUrl}" target="_blank" class="btn-text" style="color: var(--primary-color); display:flex; align-items:center; gap:0.25rem;"><i class="ph ph-globe"></i> Web</a>`;
                    }

                    li.innerHTML = `
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="hist-date">${this.formatDate(test.date)}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div style="display:flex; gap:0.50rem;">
                                ${linksHtml || '<span style="color:var(--text-secondary); font-size:0.8rem;">Sin enlaces</span>'}
                            </div>
                            <button class="btn-delete-blood" data-id="${test.id}" style="border:none; background:transparent; cursor:pointer;" title="Eliminar registro">❌</button>
                        </div>
                    `;

                    li.querySelector('.btn-delete-blood').addEventListener('click', (e) => {
                        this.deleteBloodTest(e.currentTarget.dataset.id);
                    });

                    this.bloodList.appendChild(li);
                });
            } else {
                this.bloodList.innerHTML = '<li style="justify-content:center; color:var(--text-secondary); font-size:0.85rem; padding:1rem;">No tienes análisis de sangre registrados</li>';
            }
        }
    }
}


// ==========================================================================
// MÓDULO 5: VEHÍCULO
// ==========================================================================
class VehicleModule {
    constructor(controller) {
        this.controller = controller;

        this.odometerInput = document.getElementById('vehicle-odometer-input');
        
        this.oilRemainingKm = document.getElementById('oil-remaining-km');
        this.oilRemainingDays = document.getElementById('oil-remaining-days');
        this.oilLastService = document.getElementById('oil-last-service');
        this.oilNextService = document.getElementById('oil-next-service');
        
        this.btnNewOil = document.getElementById('btn-add-oil-service');
        this.oilForm = document.getElementById('oil-service-form');
        this.oilFormDate = document.getElementById('oil-form-date');
        this.oilFormKm = document.getElementById('oil-form-km');
        this.oilFormCancel = document.getElementById('oil-form-cancel');
        this.oilFormSave = document.getElementById('oil-form-save');
        this.btnToggleOilHist = document.getElementById('btn-toggle-oil-history');
        this.oilHistoryLog = document.getElementById('oil-service-history');

        this.alignLast = document.getElementById('align-last');
        this.alignRemaining = document.getElementById('align-remaining');
        this.btnRecordAlign = document.getElementById('btn-record-align');

        this.rotLast = document.getElementById('rot-last');
        this.rotRemaining = document.getElementById('rot-remaining');
        this.btnRecordRot = document.getElementById('btn-record-rot');

        this.replaceLast = document.getElementById('replace-last');
        this.replaceRemaining = document.getElementById('replace-remaining');
        
        this.btnNewReplace = document.getElementById('btn-add-replace-service');
        this.replaceForm = document.getElementById('replace-service-form');
        this.replaceFormDate = document.getElementById('replace-form-date');
        this.replaceFormKm = document.getElementById('replace-form-km');
        this.replaceFormPos = document.getElementById('replace-form-pos');
        this.replaceFormCancel = document.getElementById('replace-form-cancel');
        this.replaceFormSave = document.getElementById('replace-form-save');
        this.btnToggleTiresHist = document.getElementById('btn-toggle-tires-history');
        this.tiresHistoryLog = document.getElementById('tires-service-history');

        // Load data
        this.odometer = Number(localStorage.getItem('vehicle_odometer')) || 0;
        this.maintenanceLog = JSON.parse(localStorage.getItem('vehicle_maintenance_log')) || [];
        
        this.init();
    }

    saveOdometer() {
        localStorage.setItem('vehicle_odometer', this.odometer.toString());
    }

    saveMaintenanceLog() {
        localStorage.setItem('vehicle_maintenance_log', JSON.stringify(this.maintenanceLog));
    }

    init() {
        if (this.odometerInput) {
            this.odometerInput.value = this.odometer;
            this.odometerInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value) || 0;
                this.odometer = val;
                this.saveOdometer();
                this.render();
            });
        }

        this.btnNewOil?.addEventListener('click', () => {
            if (this.oilForm) this.oilForm.classList.remove('hidden');
            if (this.oilFormDate) this.oilFormDate.value = new Date().toISOString().split('T')[0];
            if (this.oilFormKm) this.oilFormKm.value = this.odometer;
        });
        
        this.oilFormCancel?.addEventListener('click', () => {
            this.clearOilForm();
        });

        this.oilFormSave?.addEventListener('click', () => {
            this.saveOilService();
        });

        this.btnToggleOilHist?.addEventListener('click', () => {
            if (this.oilHistoryLog) {
                if (this.oilHistoryLog.classList.contains('hidden')) {
                    this.oilHistoryLog.classList.remove('hidden');
                    this.btnToggleOilHist.innerText = 'Ocultar historial de servicios';
                } else {
                    this.oilHistoryLog.classList.add('hidden');
                    this.btnToggleOilHist.innerText = 'Ver historial de servicios';
                }
            }
        });

        this.btnRecordAlign?.addEventListener('click', () => {
            this.recordQuickGeometry('Alineación & Balanceo');
        });

        this.btnRecordRot?.addEventListener('click', () => {
            this.recordQuickGeometry('Rotación de Neumáticos');
        });

        this.btnNewReplace?.addEventListener('click', () => {
            if (this.replaceForm) this.replaceForm.classList.remove('hidden');
            if (this.replaceFormDate) this.replaceFormDate.value = new Date().toISOString().split('T')[0];
            if (this.replaceFormKm) this.replaceFormKm.value = this.odometer;
        });

        this.replaceFormCancel?.addEventListener('click', () => {
            this.clearReplaceForm();
        });

        this.replaceFormSave?.addEventListener('click', () => {
            this.saveReplaceService();
        });

        this.btnToggleTiresHist?.addEventListener('click', () => {
            if (this.tiresHistoryLog) {
                if (this.tiresHistoryLog.classList.contains('hidden')) {
                    this.tiresHistoryLog.classList.remove('hidden');
                    this.btnToggleTiresHist.innerText = 'Ocultar historial mecánico';
                } else {
                    this.tiresHistoryLog.classList.add('hidden');
                    this.btnToggleTiresHist.innerText = 'Ver historial mecánico';
                }
            }
        });

        this.render();
    }

    clearOilForm() {
        this.oilForm?.classList.add('hidden');
        if (this.oilFormDate) this.oilFormDate.value = '';
        if (this.oilFormKm) this.oilFormKm.value = '';
    }

    clearReplaceForm() {
        this.replaceForm?.classList.add('hidden');
        if (this.replaceFormDate) this.replaceFormDate.value = '';
        if (this.replaceFormKm) this.replaceFormKm.value = '';
    }

    saveOilService() {
        const dateVal = this.oilFormDate?.value;
        const kmVal = parseInt(this.oilFormKm?.value) || 0;

        if (!dateVal) {
            alert('Por favor selecciona la fecha del servicio.');
            return;
        }

        if (kmVal <= 0) {
            alert('Por favor ingresa un kilometraje válido.');
            return;
        }

        const chkOil = document.getElementById('oil-chk-oil')?.checked || false;
        const chkFilOil = document.getElementById('oil-chk-fil-oil')?.checked || false;
        const chkFilAir = document.getElementById('oil-chk-fil-air')?.checked || false;
        const chkFilCab = document.getElementById('oil-chk-fil-cab')?.checked || false;

        const entry = {
            id: 'maint_' + Date.now(),
            type: 'Aceite y Filtros',
            date: dateVal,
            km: kmVal,
            details: {
                oil: chkOil,
                filterOil: chkFilOil,
                filterAir: chkFilAir,
                filterCabin: chkFilCab
            }
        };

        this.maintenanceLog.push(entry);
        this.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));

        if (kmVal > this.odometer) {
            this.odometer = kmVal;
            this.saveOdometer();
            if (this.odometerInput) this.odometerInput.value = this.odometer;
        }

        this.saveMaintenanceLog();
        this.clearOilForm();
        this.render();
    }

    recordQuickGeometry(type) {
        const dateVal = new Date().toISOString().split('T')[0];
        const kmVal = this.odometer;

        const entry = {
            id: 'maint_' + Date.now(),
            type: type,
            date: dateVal,
            km: kmVal,
            details: {}
        };

        this.maintenanceLog.push(entry);
        this.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));
        this.saveMaintenanceLog();
        this.render();
    }

    saveReplaceService() {
        const dateVal = this.replaceFormDate?.value;
        const kmVal = parseInt(this.replaceFormKm?.value) || 0;
        const posVal = this.replaceFormPos?.value || '4';

        if (!dateVal) {
            alert('Por favor selecciona la fecha del servicio.');
            return;
        }

        if (kmVal <= 0) {
            alert('Por favor ingresa un kilometraje válido.');
            return;
        }

        let posText = 'Las 4 Ruedas';
        if (posVal === '2-del') posText = 'Las 2 Delanteras';
        else if (posVal === '2-tras') posText = 'Las 2 Traseras';

        const entry = {
            id: 'maint_' + Date.now(),
            type: 'Reemplazo de Neumáticos',
            date: dateVal,
            km: kmVal,
            details: {
                position: posText
            }
        };

        this.maintenanceLog.push(entry);
        this.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));

        if (kmVal > this.odometer) {
            this.odometer = kmVal;
            this.saveOdometer();
            if (this.odometerInput) this.odometerInput.value = this.odometer;
        }

        this.saveMaintenanceLog();
        this.clearReplaceForm();
        this.render();
    }

    deleteMaintenance(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este registro de servicio?')) {
            this.maintenanceLog = this.maintenanceLog.filter(m => m.id !== id);
            this.saveMaintenanceLog();
            this.render();
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return 'Nunca';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }

    calculateDaysElapsed(dateStr) {
        if (!dateStr) return null;
        const diffTime = Math.abs(new Date() - new Date(dateStr));
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    render() {
        this.renderOilCard();
        this.renderTiresCard();
        this.renderHistories();
    }

    renderOilCard() {
        const lastOil = this.maintenanceLog.find(m => m.type === 'Aceite y Filtros');
        
        if (lastOil) {
            const nextKm = lastOil.km + 10000;
            const remainingKm = nextKm - this.odometer;
            const daysElapsed = this.calculateDaysElapsed(lastOil.date);
            const remainingDays = 365 - (daysElapsed || 0);

            if (this.oilRemainingKm) {
                this.oilRemainingKm.innerText = remainingKm.toLocaleString('es-AR') + ' km';
                if (remainingKm <= 0) {
                    this.oilRemainingKm.style.color = 'var(--status-red)';
                } else if (remainingKm <= 1000) {
                    this.oilRemainingKm.style.color = 'var(--status-orange)';
                } else {
                    this.oilRemainingKm.style.color = 'var(--status-green)';
                }
            }

            if (this.oilRemainingDays) {
                if (remainingDays <= 0) {
                    this.oilRemainingDays.innerText = `Plazo vencido por tiempo (${Math.abs(remainingDays)} días transcurridos del año)`;
                    this.oilRemainingDays.style.color = 'var(--status-red)';
                } else {
                    this.oilRemainingDays.innerText = `Equivale a aprox. ${remainingDays} días restantes (1 año máx.)`;
                    this.oilRemainingDays.style.color = 'var(--text-secondary)';
                }
            }

            if (this.oilLastService) {
                this.oilLastService.innerText = `${lastOil.km.toLocaleString('es-AR')} km (${this.formatDate(lastOil.date)})`;
            }

            if (this.oilNextService) {
                this.oilNextService.innerText = `${nextKm.toLocaleString('es-AR')} km`;
            }
        } else {
            if (this.oilRemainingKm) this.oilRemainingKm.innerText = '-- km';
            if (this.oilRemainingDays) this.oilRemainingDays.innerText = 'Sin registros de cambio';
            if (this.oilLastService) this.oilLastService.innerText = 'Nunca';
            if (this.oilNextService) this.oilNextService.innerText = 'N/A';
        }
    }

    renderTiresCard() {
        const lastAlign = this.maintenanceLog.find(m => m.type === 'Alineación & Balanceo');
        const lastRot = this.maintenanceLog.find(m => m.type === 'Rotación de Neumáticos');
        const lastReplace = this.maintenanceLog.find(m => m.type === 'Reemplazo de Neumáticos');

        if (lastAlign) {
            const nextKm = lastAlign.km + 10000;
            const remaining = nextKm - this.odometer;
            if (this.alignLast) this.alignLast.innerText = `${lastAlign.km.toLocaleString('es-AR')} km (${this.formatDate(lastAlign.date)})`;
            if (this.alignRemaining) {
                this.alignRemaining.innerText = remaining <= 0 ? 'Vencido' : `${remaining.toLocaleString('es-AR')} km rest.`;
                this.alignRemaining.style.color = remaining <= 0 ? 'var(--status-red)' : 'var(--text-secondary)';
            }
        } else {
            if (this.alignLast) this.alignLast.innerText = 'Nunca';
            if (this.alignRemaining) this.alignRemaining.innerText = '-- km rest.';
        }

        if (lastRot) {
            const nextKm = lastRot.km + 10000;
            const remaining = nextKm - this.odometer;
            if (this.rotLast) this.rotLast.innerText = `${lastRot.km.toLocaleString('es-AR')} km (${this.formatDate(lastRot.date)})`;
            if (this.rotRemaining) {
                this.rotRemaining.innerText = remaining <= 0 ? 'Vencido' : `${remaining.toLocaleString('es-AR')} km rest.`;
                this.rotRemaining.style.color = remaining <= 0 ? 'var(--status-red)' : 'var(--text-secondary)';
            }
        } else {
            if (this.rotLast) this.rotLast.innerText = 'Nunca';
            if (this.rotRemaining) this.rotRemaining.innerText = '-- km rest.';
        }

        if (lastReplace) {
            const nextKm = lastReplace.km + 60000;
            const remaining = nextKm - this.odometer;
            if (this.replaceLast) this.replaceLast.innerText = `${lastReplace.km.toLocaleString('es-AR')} km (${this.formatDate(lastReplace.date)})`;
            if (this.replaceRemaining) {
                this.replaceRemaining.innerText = remaining <= 0 ? 'Vencido' : `${remaining.toLocaleString('es-AR')} km rest.`;
                this.replaceRemaining.style.color = remaining <= 0 ? 'var(--status-red)' : 'var(--text-secondary)';
            }
        } else {
            if (this.replaceLast) this.replaceLast.innerText = 'Nunca';
            if (this.replaceRemaining) this.replaceRemaining.innerText = '-- km rest.';
        }
    }

    renderHistories() {
        if (this.oilHistoryLog) {
            this.oilHistoryLog.innerHTML = '';
            const oilEntries = this.maintenanceLog.filter(m => m.type === 'Aceite y Filtros');
            if (oilEntries.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'history-list';
                ul.style.paddingLeft = '0';
                ul.style.listStyle = 'none';

                oilEntries.forEach(entry => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.flexDirection = 'column';
                    li.style.alignItems = 'stretch';
                    li.style.padding = '0.75rem';
                    li.style.gap = '8px';

                    const details = entry.details || {};
                    const components = [];
                    if (details.oil) components.push('Aceite');
                    if (details.filterOil) components.push('F. Aceite');
                    if (details.filterAir) components.push('F. Aire');
                    if (details.filterCabin) components.push('F. Habitáculo');

                    li.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:600; margin-bottom: 0.25rem;">
                            <span>${entry.km.toLocaleString('es-AR')} km</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">${this.formatDate(entry.date)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.8rem; color:var(--text-secondary);">Cambio: ${components.join(', ') || 'Ninguno'}</span>
                            <button class="btn-delete-maint" data-id="${entry.id}" style="border:none; background:transparent; cursor:pointer;" title="Eliminar registro">❌</button>
                        </div>
                    `;

                    li.querySelector('.btn-delete-maint').addEventListener('click', (e) => {
                        this.deleteMaintenance(e.currentTarget.dataset.id);
                    });

                    ul.appendChild(li);
                });
                this.oilHistoryLog.appendChild(ul);
            } else {
                this.oilHistoryLog.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; padding: 1rem 0;">No hay servicios de aceite registrados.</p>';
            }
        }

        if (this.tiresHistoryLog) {
            this.tiresHistoryLog.innerHTML = '';
            const tiresEntries = this.maintenanceLog.filter(m => m.type !== 'Aceite y Filtros');
            if (tiresEntries.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'history-list';
                ul.style.paddingLeft = '0';
                ul.style.listStyle = 'none';

                tiresEntries.forEach(entry => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.flexDirection = 'column';
                    li.style.alignItems = 'stretch';
                    li.style.padding = '0.75rem';
                    li.style.gap = '8px';

                    let extraDetails = '';
                    if (entry.type === 'Reemplazo de Neumáticos' && entry.details && entry.details.position) {
                        extraDetails = ` (${entry.details.position})`;
                    }

                    li.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:600; margin-bottom: 0.25rem;">
                            <span>${entry.type}${extraDetails}</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">${this.formatDate(entry.date)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.8rem; color:var(--text-secondary);">A los ${entry.km.toLocaleString('es-AR')} km</span>
                            <button class="btn-delete-maint" data-id="${entry.id}" style="border:none; background:transparent; cursor:pointer;" title="Eliminar registro">❌</button>
                        </div>
                    `;

                    li.querySelector('.btn-delete-maint').addEventListener('click', (e) => {
                        this.deleteMaintenance(e.currentTarget.dataset.id);
                    });

                    ul.appendChild(li);
                });
                this.tiresHistoryLog.appendChild(ul);
            } else {
                this.tiresHistoryLog.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; padding: 1rem 0;">No hay historial mecánico de ruedas registrado.</p>';
            }
        }
    }
}


// ==========================================================================
// MÓDULO 6: COPIAS DE SEGURIDAD (BackupModule - Tolerante a Fallos)
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
            clothChangeDate: localStorage.getItem('clothChangeDate'),
            health_medical_data: localStorage.getItem('health_medical_data'),
            health_blood_tests: localStorage.getItem('health_blood_tests'),
            vehicle_odometer: localStorage.getItem('vehicle_odometer'),
            vehicle_maintenance_log: localStorage.getItem('vehicle_maintenance_log')
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

                // Salud
                let healthFound = false;
                if (rawData.health_medical_data) {
                    const dataVal = typeof rawData.health_medical_data === 'string' 
                        ? rawData.health_medical_data 
                        : JSON.stringify(rawData.health_medical_data);
                    localStorage.setItem('health_medical_data', dataVal);
                    healthFound = true;
                }
                if (rawData.health_blood_tests) {
                    const dataVal = typeof rawData.health_blood_tests === 'string' 
                        ? rawData.health_blood_tests 
                        : JSON.stringify(rawData.health_blood_tests);
                    localStorage.setItem('health_blood_tests', dataVal);
                    healthFound = true;
                }
                if (healthFound) {
                    importedCategories.push("Salud y Controles Médicos");
                }

                // Vehículo
                let vehicleFound = false;
                if (rawData.vehicle_odometer !== undefined && rawData.vehicle_odometer !== null) {
                    localStorage.setItem('vehicle_odometer', rawData.vehicle_odometer.toString());
                    vehicleFound = true;
                }
                if (rawData.vehicle_maintenance_log) {
                    const dataVal = typeof rawData.vehicle_maintenance_log === 'string' 
                        ? rawData.vehicle_maintenance_log 
                        : JSON.stringify(rawData.vehicle_maintenance_log);
                    localStorage.setItem('vehicle_maintenance_log', dataVal);
                    vehicleFound = true;
                }
                if (vehicleFound) {
                    importedCategories.push("Vehículo y Mantenimiento");
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
            } else if (activeSectionId === 'lenses-section') {
                this.lenses.updateUI();
                this.lenses.loadDatesAndStock();
                this.lenses.renderHistory();
            } else if (activeSectionId === 'higiene-section') {
                this.hygiene.render();
            } else if (activeSectionId === 'salud-section') {
                this.health.render();
            } else if (activeSectionId === 'vehiculo-section') {
                this.vehicle.render();
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
        } else if (this.currentEditType === 'medical') {
            const k = this.currentEditId;
            const dateStr = isoString.split('T')[0];
            this.health.medicalData[k].lastVisit = dateStr;
            
            if (!this.health.medicalData[k].history) {
                this.health.medicalData[k].history = [];
            }
            if (this.health.medicalData[k].history.length > 0) {
                this.health.medicalData[k].history[0] = dateStr;
            } else {
                this.health.medicalData[k].history.unshift(dateStr);
            }
            this.health.saveMedicalData();
            this.health.render();
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
        this.health = new HealthModule(this);
        this.vehicle = new VehicleModule(this);
        this.backups = new BackupModule(this);
        
        setInterval(() => {
            const activeSection = document.querySelector('.main-section:not(.hidden)');
            if (activeSection) {
                if (activeSection.id === 'higiene-section') this.hygiene.render();
                else if (activeSection.id === 'cuidado-section') this.grooming.render();
                else if (activeSection.id === 'lenses-section') this.lenses.loadDatesAndStock();
                else if (activeSection.id === 'salud-section') this.health.render();
                else if (activeSection.id === 'vehiculo-section') this.vehicle.render();
            }
        }, 1000 * 60 * 60);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new AppController();
    controller.start();
});
