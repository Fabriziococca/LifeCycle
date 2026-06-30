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
        
        // Mostrar u ocultar la tarjeta del robot según la categoría seleccionada
        if (this.robotCard) {
            if (this.currentCategory === 'todos' || this.currentCategory === 'tecnologia') {
                this.robotCard.style.display = 'block';
                this.renderRobotCard();
            } else {
                this.robotCard.style.display = 'none';
            }
        }

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

    renderRobotCard() {
        if (!this.robotCard) return;
        
        // Si no existen datos del robot, los inicializamos
        if (!this.data.robot_cleaner) {
            this.data.robot_cleaner = {
                status: 'clean',
                marked_dirty_at: null,
                last_notified_at: null
            };
        }
        
        const robot = this.data.robot_cleaner;
        const isDirty = robot.status === 'dirty';
        
        // Cambiar borde/estilo según estado
        if (isDirty) {
            this.robotCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            this.robotCard.className = 'card status-red';
            
            // Calcular cuánto tiempo lleva sucio (aproximado)
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
                    <p class="backup-text" style="font-size: 0.85rem; margin-bottom: 1rem; color: var(--text-secondary);">Tu hermano marcó el robot como usado. Lávalo para detener los recordatorios cada 6 horas en tu celular.</p>
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
            last_notified_at: new Date().toISOString() // Seteado a la hora actual para que la primera alerta ocurra 6 horas después
        };
        this.saveData();
        this.render();
        this.app.auth?.syncToCloud(false).catch(() => {});
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
    }

    init() {
        this.initTabs();
        this.render();
        
        // Timer de actualización para refrescar el "hace X min" dinámicamente si el robot está sucio
        setInterval(() => {
            if (this.data?.robot_cleaner?.status === 'dirty' && this.currentCategory === 'todos') {
                this.renderRobotCard();
            }
        }, 30000); // cada 30 segundos
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
                    if (daysDiff <= 30) { colorVar = 'var(--status-green)'; borderColor = 'var(--status-green)'; }
                    else if (daysDiff <= 40) { colorVar = 'var(--status-yellow)'; borderColor = 'var(--status-yellow)'; }
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
        this.bloodFormPortal = document.getElementById('blood-form-portal');
        this.bloodFormCancel = document.getElementById('blood-form-cancel');
        this.bloodFormSave = document.getElementById('blood-form-save');
        this.bloodList = document.getElementById('blood-tests-list');

        // File attachment inputs
        this.bloodFormFile = document.getElementById('blood-form-file');
        this.bloodFormFileName = document.getElementById('blood-form-file-name');
        this.attachedFileData = null;
        this.attachedFileName = null;

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

        // File listener
        this.bloodFormFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // If logged in, skip the local 1.5MB constraint (only apply 15MB limit)
                const isLoggedIn = this.controller.auth && this.controller.auth.user;
                const maxSize = isLoggedIn ? 15 * 1024 * 1024 : 1.5 * 1024 * 1024;
                if (file.size > maxSize) {
                    if (isLoggedIn) {
                        alert('El archivo es demasiado grande (máximo 15MB para subidas a la nube).');
                    } else {
                        alert('El archivo es demasiado grande (máximo 1.5MB en modo offline para evitar saturar el navegador). Inicia sesión para subir archivos de hasta 15MB.');
                    }
                    this.bloodFormFile.value = '';
                    this.attachedFileData = null;
                    this.attachedFileName = null;
                    this.attachedFile = null;
                    if (this.bloodFormFileName) {
                        this.bloodFormFileName.classList.add('hidden');
                        this.bloodFormFileName.innerText = '';
                    }
                    return;
                }

                this.attachedFile = file;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.attachedFileData = event.target.result;
                    this.attachedFileName = file.name;
                    if (this.bloodFormFileName) {
                        this.bloodFormFileName.classList.remove('hidden');
                        this.bloodFormFileName.innerHTML = `<i class="ph ph-file-pdf"></i> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                    }
                };
                reader.readAsDataURL(file);
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
        if (this.bloodFormPortal) this.bloodFormPortal.value = '';
        if (this.bloodFormFile) this.bloodFormFile.value = '';
        if (this.bloodFormFileName) {
            this.bloodFormFileName.classList.add('hidden');
            this.bloodFormFileName.innerText = '';
        }
        this.attachedFileData = null;
        this.attachedFileName = null;
        this.attachedFile = null;
    }

    async saveBloodTestEntry() {
        const dateVal = this.bloodFormDate?.value;
        if (!dateVal) {
            alert('Por favor selecciona la fecha del estudio.');
            return;
        }
        
        const entry = {
            id: 'blood_' + Date.now(),
            date: dateVal,
            portalUrl: this.bloodFormPortal?.value || '',
            fileName: this.attachedFileName || null,
            fileData: this.attachedFileData || null
        };

        // If authenticated and file is attached, upload to Supabase Storage
        if (this.controller.auth && this.controller.auth.user && this.attachedFile) {
            try {
                this.controller.auth.updateSyncBadge('syncing', "Subiendo archivo...");
                const publicUrl = await this.controller.auth.uploadFile(entry.id, this.attachedFile);
                entry.fileData = publicUrl;
                entry.isCloudFile = true;
            } catch (err) {
                console.error("Error uploading file to storage:", err);
                alert("Error al subir archivo a la nube. Se guardará de forma local temporalmente.");
            }
        }

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

            const badgeClass = statusText === 'Al día' ? 'green' : (statusText === 'Vencido' ? 'red' : (statusText === 'Próximo' ? 'orange' : ''));

            card.innerHTML = `
                <div class="card-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="icon-container">
                            <i class="ph ${key === 'dentista' ? 'ph-first-aid' : 'ph-eye'}"></i>
                        </div>
                        <h3 style="font-size: 1.15rem; font-weight:600; margin:0; display:flex; align-items:center; gap:8px;">
                            ${name}
                            <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 2px 6px; text-transform: uppercase;">${statusText}</span>
                        </h3>
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
                    if (test.fileData) {
                        const target = test.isCloudFile ? 'target="_blank"' : `download="${test.fileName || 'analisis.pdf'}"`;
                        linksHtml += `<a href="${test.fileData}" ${target} class="btn-text" style="color: var(--primary-color); display:flex; align-items:center; gap:0.25rem;" title="${test.fileName || 'PDF'}"><i class="ph ph-file-pdf"></i> PDF</a>`;
                    } else if (test.pdfUrl) {
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
// ==========================================================================
// MÓDULO 4: GIMNASIO (GymTracker PWA)
// ==========================================================================
class GymModule {
    constructor(appController) {
        this.app = appController;
        this.records = [];
        this.routine = [];
        this.routineFocus = {};
        this.sessions = [];
        this.meals = { fixed: [], variable: [] };
        this.supplements = { vit_d_history: [], vit_d_days_interval: 45, painkillers_history: [] };
        this.weight = [];
        this.activeSession = null;
        this.collapsedGroups = {};

        window.gym = this;
        this.loadData();
        this.setupListeners();
    }

    loadData() {
        try {
            const records = localStorage.getItem('gym_records');
            if (records) this.records = JSON.parse(records);

            const routine = localStorage.getItem('gym_routine');
            if (routine) this.routine = JSON.parse(routine);

            const routineFocus = localStorage.getItem('gym_routine_focus');
            if (routineFocus) this.routineFocus = JSON.parse(routineFocus);
            this.routineFocus = Object.assign({
                'Lunes': '', 'Martes': '', 'Miércoles': '', 'Jueves': '', 'Viernes': '', 'Sábado': '', 'Domingo': ''
            }, this.routineFocus);

            const sessions = localStorage.getItem('gym_sessions');
            if (sessions) this.sessions = JSON.parse(sessions);

            const meals = localStorage.getItem('gym_meals');
            if (meals) this.meals = JSON.parse(meals);
            if (!this.meals.fixed) this.meals.fixed = [];
            if (!this.meals.variable) this.meals.variable = [];

            const supplements = localStorage.getItem('gym_supplements');
            if (supplements) this.supplements = JSON.parse(supplements);
            if (!this.supplements.vit_d_history) this.supplements.vit_d_history = [];
            if (!this.supplements.vit_d_days_interval) this.supplements.vit_d_days_interval = 45;
            if (!this.supplements.painkillers_history) this.supplements.painkillers_history = [];

            const weight = localStorage.getItem('gym_weight');
            if (weight) this.weight = JSON.parse(weight);
        } catch (err) {
            console.error('Error loading Gym data', err);
        }
    }

    saveData(key) {
        if (key === 'gym_records') localStorage.setItem('gym_records', JSON.stringify(this.records));
        else if (key === 'gym_routine') localStorage.setItem('gym_routine', JSON.stringify(this.routine));
        else if (key === 'gym_routine_focus') localStorage.setItem('gym_routine_focus', JSON.stringify(this.routineFocus));
        else if (key === 'gym_sessions') localStorage.setItem('gym_sessions', JSON.stringify(this.sessions));
        else if (key === 'gym_meals') localStorage.setItem('gym_meals', JSON.stringify(this.meals));
        else if (key === 'gym_supplements') localStorage.setItem('gym_supplements', JSON.stringify(this.supplements));
        else if (key === 'gym_weight') localStorage.setItem('gym_weight', JSON.stringify(this.weight));
    }

    setupListeners() {
        // Sub-tabs switching
        const container = document.getElementById('gym-tabs-container');
        if (container) {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (!btn) return;
                container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const activeTab = btn.dataset.gymTab;
                document.querySelectorAll('.gym-tab-content').forEach(c => {
                    c.classList.toggle('hidden', c.id !== `gym-${activeTab}-content`);
                });
                this.render();
            });
        }

        // Form 1: Records
        const recordForm = document.getElementById('record-form');
        if (recordForm) {
            recordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('record-exercise').value.trim();
                const weight = parseFloat(document.getElementById('record-weight').value);
                const reps = parseInt(document.getElementById('record-reps').value);
                const rir = document.getElementById('record-rir').value;

                const newRecord = {
                    id: Date.now(),
                    name,
                    weight,
                    reps,
                    rir,
                    date: new Date().toLocaleDateString('es-AR')
                };

                const idx = this.records.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
                if (idx !== -1) {
                    this.records[idx] = newRecord;
                } else {
                    this.records.push(newRecord);
                }

                this.saveData('gym_records');
                this.renderRecords();
                recordForm.reset();
            });
        }

        // Form 2: Routine inline values change
        const routineContainer = document.getElementById('routine-days-container');
        if (routineContainer) {
            routineContainer.addEventListener('change', (e) => {
                const target = e.target;
                if (target.classList.contains('day-focus-input')) {
                    const day = target.getAttribute('data-day');
                    this.routineFocus[day] = target.value.trim();
                    this.saveData('gym_routine_focus');
                } else if (target.classList.contains('routine-weight-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const val = parseFloat(target.value);
                    const ex = this.routine.find(r => r.id === id);
                    if (ex) {
                        ex.weight = isNaN(val) ? null : val;
                        this.saveData('gym_routine');
                    }
                } else if (target.classList.contains('routine-reps-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const val = parseInt(target.value);
                    const ex = this.routine.find(r => r.id === id);
                    if (ex) {
                        ex.reps = isNaN(val) ? null : val;
                        this.saveData('gym_routine');
                    }
                } else if (target.classList.contains('routine-rir-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const val = parseInt(target.value);
                    const ex = this.routine.find(r => r.id === id);
                    if (ex) {
                        ex.rir = isNaN(val) ? null : val;
                        this.saveData('gym_routine');
                    }
                } else if (target.classList.contains('routine-failed-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const ex = this.routine.find(r => r.id === id);
                    if (ex) {
                        ex.failed = target.checked;
                        this.saveData('gym_routine');
                    }
                }
            });

            routineContainer.addEventListener('submit', (e) => {
                if (e.target.classList.contains('inline-add-exercise-form')) {
                    e.preventDefault();
                    const day = e.target.getAttribute('data-day');
                    const input = e.target.querySelector('input[type="text"]');
                    const name = input.value.trim();
                    if (!name) return;

                    this.routine.push({
                        id: Date.now(),
                        day,
                        name,
                        weight: null,
                        reps: null,
                        rir: null,
                        failed: false
                    });

                    this.saveData('gym_routine');
                    this.renderRoutine();

                    // Re-enfocar el input del día correspondiente
                    const newInput = document.querySelector(`.inline-add-exercise-form[data-day="${day}"] input[type="text"]`);
                    if (newInput) newInput.focus();
                }
            });
        }

        // Form 3: Sessions
        const btnStart = document.getElementById('start-session-btn');
        const btnEnd = document.getElementById('finish-session-btn');
        const activeBox = document.getElementById('current-session');
        const btnAddSet = document.getElementById('add-set-btn');

        if (btnStart) {
            btnStart.addEventListener('click', () => {
                this.activeSession = {
                    id: Date.now(),
                    date: new Date().toLocaleDateString('es-AR'),
                    exercises: {}
                };
                document.getElementById('start-session-container').classList.add('hidden');
                activeBox?.classList.remove('hidden');
                const preview = document.getElementById('current-sets-list');
                if (preview) preview.innerHTML = '<p style="color:var(--text-secondary); padding: 10px;">Entrenamiento iniciado. Registrá tu primer serie.</p>';
                this.updateRoutineExercisesList();
            });
        }

        if (btnAddSet) {
            btnAddSet.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.activeSession) return;

                const exName = document.getElementById('session-exercise').value.trim();
                const weight = parseFloat(document.getElementById('session-weight').value);
                const reps = parseInt(document.getElementById('session-reps').value);

                if (!exName || isNaN(weight) || isNaN(reps)) {
                    alert('Por favor completa ejercicio, peso y repeticiones.');
                    return;
                }

                if (!this.activeSession.exercises[exName]) {
                    this.activeSession.exercises[exName] = [];
                }

                this.activeSession.exercises[exName].push({ weight, reps });
                this.renderCurrentSessionSets();

                // Resetear peso/reps pero dejar el nombre
                document.getElementById('session-weight').value = '';
                document.getElementById('session-reps').value = '';
            });
        }

        if (btnEnd) {
            btnEnd.addEventListener('click', () => {
                if (!this.activeSession || Object.keys(this.activeSession.exercises).length === 0) {
                    if (!confirm('No registraste series. ¿Cerrar sesión igualmente?')) return;
                }

                if (this.activeSession && Object.keys(this.activeSession.exercises).length > 0) {
                    this.sessions.unshift(this.activeSession);
                    this.saveData('gym_sessions');
                }

                this.activeSession = null;
                activeBox?.classList.add('hidden');
                document.getElementById('start-session-container').classList.remove('hidden');

                // Limpiar inputs
                document.getElementById('session-exercise').value = '';
                document.getElementById('session-weight').value = '';
                document.getElementById('session-reps').value = '';

                this.renderSessionsLog();
            });
        }

        // Form 4: Nutrition
        const toggleFixedBtn = document.getElementById('toggle-fixed-form-btn');
        const fixedForm = document.getElementById('fixed-meal-form');
        if (toggleFixedBtn && fixedForm) {
            toggleFixedBtn.addEventListener('click', () => {
                fixedForm.classList.toggle('hidden');
                const isHidden = fixedForm.classList.contains('hidden');
                toggleFixedBtn.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Cargar Fija' : '<i class="ph ph-x"></i> Cancelar';
            });
        }

        if (fixedForm) {
            fixedForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('fixed-meal-name').value.trim();
                const qty = parseFloat(document.getElementById('fixed-meal-qty').value) || 1;
                const unit = document.getElementById('fixed-meal-unit').value || 'u';
                const kcal = parseFloat(document.getElementById('fixed-meal-kcal').value) || 0;
                const protein = parseFloat(document.getElementById('fixed-meal-protein').value) || 0;
                const carbs = parseFloat(document.getElementById('fixed-meal-carbs').value) || 0;
                const fat = parseFloat(document.getElementById('fixed-meal-fat').value) || 0;
                const sodium = parseFloat(document.getElementById('fixed-meal-sodium').value) || 0;
                const group = document.getElementById('fixed-meal-group').value.trim();

                this.meals.fixed.push({
                    id: Date.now(), name, qty, unit, kcal, protein, carbs, fat, sodium, group
                });
                this.saveData('gym_meals');
                this.renderNutrition();
                fixedForm.reset();
                fixedForm.classList.add('hidden');
                if (toggleFixedBtn) toggleFixedBtn.innerHTML = '<i class="ph ph-plus"></i> Cargar Fija';
            });
        }

        const toggleVarBtn = document.getElementById('toggle-var-form-btn');
        const varForm = document.getElementById('variable-meal-form');
        if (toggleVarBtn && varForm) {
            toggleVarBtn.addEventListener('click', () => {
                varForm.classList.toggle('hidden');
                const isHidden = varForm.classList.contains('hidden');
                toggleVarBtn.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Cargar Variable' : '<i class="ph ph-x"></i> Cancelar';
            });
        }

        if (varForm) {
            varForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('variable-meal-name').value.trim();
                const qty = parseFloat(document.getElementById('variable-meal-qty').value) || 1;
                const unit = document.getElementById('variable-meal-unit').value || 'u';
                const kcal = parseFloat(document.getElementById('variable-meal-kcal').value) || 0;
                const protein = parseFloat(document.getElementById('variable-meal-protein').value) || 0;
                const carbs = parseFloat(document.getElementById('variable-meal-carbs').value) || 0;
                const fat = parseFloat(document.getElementById('variable-meal-fat').value) || 0;
                const sodium = parseFloat(document.getElementById('variable-meal-sodium').value) || 0;
                const group = document.getElementById('variable-meal-group').value.trim();

                this.meals.variable.push({
                    id: Date.now(),
                    name, qty, unit, kcal, protein, carbs, fat, sodium, group,
                    date: new Date().toLocaleDateString('es-AR')
                });
                this.saveData('gym_meals');
                this.renderNutrition();
                varForm.reset();
                varForm.classList.add('hidden');
                if (toggleVarBtn) toggleVarBtn.innerHTML = '<i class="ph ph-plus"></i> Cargar Variable';
            });
        }

        // Weight corporal
        const btnWeightLogToggle = document.getElementById('btn-weight-log-toggle');
        const formWeightLog = document.getElementById('weight-log-form');
        const btnWeightHistoryToggle = document.getElementById('btn-weight-history-toggle');

        if (btnWeightLogToggle && formWeightLog) {
            btnWeightLogToggle.addEventListener('click', () => {
                formWeightLog.classList.toggle('hidden');
                const isHidden = formWeightLog.classList.contains('hidden');
                btnWeightLogToggle.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Registrar Peso' : '<i class="ph ph-x"></i> Cancelar';
                if (!isHidden) {
                    document.getElementById('weight-log-date').value = new Date().toISOString().split('T')[0];
                    document.getElementById('weight-log-val').value = '';
                }
            });
        }

        if (btnWeightHistoryToggle) {
            btnWeightHistoryToggle.addEventListener('click', () => {
                const box = document.getElementById('weight-history-list');
                box?.classList.toggle('hidden');
                const isHidden = box?.classList.contains('hidden');
                btnWeightHistoryToggle.innerHTML = isHidden ? '<i class="ph ph-eye"></i> Historial de Pesos' : '<i class="ph ph-eye-slash"></i> Ocultar Historial';
            });
        }

        if (formWeightLog) {
            formWeightLog.addEventListener('submit', (e) => {
                e.preventDefault();
                const dateVal = document.getElementById('weight-log-date').value;
                const weightVal = document.getElementById('weight-log-val').value;
                const fastingVal = document.getElementById('weight-log-fasting').value;

                if (!dateVal || !weightVal) return;

                this.weight.push({
                    id: Date.now(),
                    date: dateVal,
                    weight: parseFloat(weightVal),
                    fasting: fastingVal ? parseFloat(fastingVal) : null
                });

                this.weight.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
                this.saveData('gym_weight');
                this.renderWeight();
                formWeightLog.reset();
                formWeightLog.classList.add('hidden');
                if (btnWeightLogToggle) btnWeightLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Peso';
            });
        }

        // Vitamin D
        const btnVitdLogToggle = document.getElementById('btn-vitd-log-toggle');
        const formVitdLog = document.getElementById('vitd-log-form');
        const btnVitdSettingsToggle = document.getElementById('btn-vitd-settings-toggle');
        const formVitdSettings = document.getElementById('vitd-settings-form');
        const btnVitdHistoryToggle = document.getElementById('btn-vitd-history-toggle');

        if (btnVitdLogToggle && formVitdLog) {
            btnVitdLogToggle.addEventListener('click', () => {
                formVitdLog.classList.toggle('hidden');
                const isHidden = formVitdLog.classList.contains('hidden');
                btnVitdLogToggle.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Registrar Toma' : '<i class="ph ph-x"></i> Cancelar';
                formVitdSettings?.classList.add('hidden');
                if (btnVitdSettingsToggle) btnVitdSettingsToggle.innerHTML = '<i class="ph ph-gear"></i> Ajustar Días';
                if (!isHidden) {
                    document.getElementById('vitd-log-date').value = new Date().toISOString().split('T')[0];
                }
            });
        }

        if (btnVitdSettingsToggle && formVitdSettings) {
            btnVitdSettingsToggle.addEventListener('click', () => {
                formVitdSettings.classList.toggle('hidden');
                const isHidden = formVitdSettings.classList.contains('hidden');
                btnVitdSettingsToggle.innerHTML = isHidden ? '<i class="ph ph-gear"></i> Ajustar Días' : '<i class="ph ph-x"></i> Cancelar';
                formVitdLog?.classList.add('hidden');
                if (btnVitdLogToggle) btnVitdLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Toma';
                if (!isHidden) {
                    document.getElementById('vitd-interval-days').value = this.supplements.vit_d_days_interval;
                }
            });
        }

        if (btnVitdHistoryToggle) {
            btnVitdHistoryToggle.addEventListener('click', () => {
                const box = document.getElementById('vitd-history-list');
                box?.classList.toggle('hidden');
                const isHidden = box?.classList.contains('hidden');
                btnVitdHistoryToggle.innerHTML = isHidden ? '<i class="ph ph-eye"></i> Historial' : '<i class="ph ph-eye-slash"></i> Ocultar';
            });
        }

        if (formVitdLog) {
            formVitdLog.addEventListener('submit', (e) => {
                e.preventDefault();
                const dateVal = document.getElementById('vitd-log-date').value;
                if (!dateVal) return;

                this.supplements.vit_d_history.push({ id: Date.now(), date: dateVal });
                this.supplements.vit_d_history.sort((a, b) => new Date(b.date) - new Date(a.date));
                this.saveData('gym_supplements');
                this.renderSupplements();
                formVitdLog.reset();
                formVitdLog.classList.add('hidden');
                if (btnVitdLogToggle) btnVitdLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Toma';
            });
        }

        if (formVitdSettings) {
            formVitdSettings.addEventListener('submit', (e) => {
                e.preventDefault();
                const intervalVal = parseInt(document.getElementById('vitd-interval-days').value);
                if (isNaN(intervalVal) || intervalVal < 1) return;

                this.supplements.vit_d_days_interval = intervalVal;
                this.saveData('gym_supplements');
                this.renderSupplements();
                formVitdSettings.classList.add('hidden');
                if (btnVitdSettingsToggle) btnVitdSettingsToggle.innerHTML = '<i class="ph ph-gear"></i> Ajustar Días';
            });
        }

        // Painkillers
        const btnPainLogToggle = document.getElementById('btn-pain-log-toggle');
        const formPainLog = document.getElementById('pain-log-form');
        const btnPainHistoryToggle = document.getElementById('btn-pain-history-toggle');

        if (btnPainLogToggle && formPainLog) {
            btnPainLogToggle.addEventListener('click', () => {
                formPainLog.classList.toggle('hidden');
                const isHidden = formPainLog.classList.contains('hidden');
                btnPainLogToggle.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Registrar Toma' : '<i class="ph ph-x"></i> Cancelar';
                if (!isHidden) {
                    document.getElementById('pain-log-date').value = new Date().toISOString().split('T')[0];
                    document.getElementById('pain-log-note').value = '';
                }
            });
        }

        if (btnPainHistoryToggle) {
            btnPainHistoryToggle.addEventListener('click', () => {
                const box = document.getElementById('pain-history-list');
                box?.classList.toggle('hidden');
                const isHidden = box?.classList.contains('hidden');
                btnPainHistoryToggle.innerHTML = isHidden ? '<i class="ph ph-eye"></i> Historial' : '<i class="ph ph-eye-slash"></i> Ocultar';
            });
        }

        if (formPainLog) {
            formPainLog.addEventListener('submit', (e) => {
                e.preventDefault();
                const dateVal = document.getElementById('pain-log-date').value;
                const typeVal = document.getElementById('pain-log-type').value;
                const noteVal = document.getElementById('pain-log-note').value.trim();

                if (!dateVal) return;

                this.supplements.painkillers_history.push({
                    id: Date.now(), date: dateVal, type: typeVal, note: noteVal
                });
                this.supplements.painkillers_history.sort((a, b) => new Date(b.date) - new Date(a.date));
                this.saveData('gym_supplements');
                this.renderPainkillers();
                formPainLog.reset();
                formPainLog.classList.add('hidden');
                if (btnPainLogToggle) btnPainLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Toma';
            });
        }
    }

    render() {
        const activeBtn = document.querySelector('#gym-tabs-container .tab-btn.active');
        const tab = activeBtn ? activeBtn.dataset.gymTab : 'records';

        if (tab === 'records') this.renderRecords();
        else if (tab === 'routine') this.renderRoutine();
        else if (tab === 'sessions') {
            this.renderCurrentSessionSets();
            this.renderSessionsLog();
        } else if (tab === 'nutrition') {
            this.renderNutrition();
            this.renderSupplements();
            this.renderPainkillers();
            this.renderWeight();
        }
    }

    renderRecords() {
        const list = document.getElementById('records-list');
        if (!list) return;
        list.innerHTML = '';

        if (this.records.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 20px;">No hay récords personales guardados.</p>';
            return;
        }

        // Ordenar alfabéticamente
        const sorted = [...this.records].sort((a, b) => a.name.localeCompare(b.name));

        sorted.forEach(r => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header" style="justify-content: space-between;">
                    <h3 style="color: white; font-size: 1rem; margin: 0;">🏆 ${r.name}</h3>
                    <button class="btn-history-delete" onclick="window.gym.deleteRecord(${r.id})" title="Eliminar PR"><i class="ph ph-trash" style="font-size:1.1rem;"></i></button>
                </div>
                <div class="card-body" style="padding-top: 5px;">
                    <div style="font-size: 1.8rem; font-weight: 900; color: var(--status-green); margin: 5px 0;">
                        ${r.weight} <span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">kg</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; gap: 15px;">
                        <span><strong style="color:white;">Reps:</strong> ${r.reps}</span>
                        <span><strong style="color:white;">RIR:</strong> ${r.rir}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 10px; text-align: right;">
                        Logrado: ${r.date}
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    }

    deleteRecord(id) {
        if (confirm('¿Seguro que querés eliminar esta marca personal?')) {
            this.records = this.records.filter(r => r.id !== id);
            this.saveData('gym_records');
            this.renderRecords();
        }
    }

    renderRoutine() {
        const container = document.getElementById('routine-days-container');
        if (!container) return;
        container.innerHTML = '';

        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        days.forEach(day => {
            const dayExercises = this.routine.filter(r => r.day === day);
            const focus = this.routineFocus[day] || '';

            const card = document.createElement('div');
            card.className = 'day-card';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--surface-border); padding-bottom: 0.5rem; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: var(--primary-color); font-size: 1.1rem;">${day}</h3>
                    <input type="text" class="day-focus-input" data-day="${day}" placeholder="Ej: Pecho y Tríceps" value="${focus}" style="background:transparent; border:none; color:white; text-align:right; font-size:0.85rem; font-weight:bold; outline:none; max-width:140px;">
                </div>
                <div class="routine-exercises-list" style="display:flex; flex-direction:column; gap:8px;">
                    ${dayExercises.length === 0 ? '<p style="color:var(--text-secondary); font-size:0.8rem; font-style:italic; padding:5px 0;">Sin ejercicios programados.</p>' : ''}
                </div>
            `;

            const listContainer = card.querySelector('.routine-exercises-list');

            dayExercises.forEach(ex => {
                const item = document.createElement('div');
                item.className = 'routine-exercise-item';
                item.style.flexDirection = 'column';
                item.style.alignItems = 'stretch';
                item.style.gap = '8px';

                const w = ex.weight !== null ? ex.weight : '';
                const reps = ex.reps !== null ? ex.reps : '';
                const rir = ex.rir !== null ? ex.rir : '';
                const failed = ex.failed ? 'checked' : '';

                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span style="font-weight: 600; color: white;">${ex.name}</span>
                        <button type="button" class="btn-history-delete" onclick="window.gym.deleteRoutine(${ex.id})" style="padding:0;"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </div>
                    <div class="routine-inputs-row">
                        <div class="input-unit-wrapper">
                            <input type="number" step="0.5" class="routine-weight-input" data-id="${ex.id}" placeholder="0.0" value="${w}">
                            <span class="unit-label">kg</span>
                        </div>
                        <span class="separator">×</span>
                        <div class="input-unit-wrapper">
                            <input type="number" class="routine-reps-input" data-id="${ex.id}" placeholder="0" value="${reps}">
                            <span class="unit-label">reps</span>
                        </div>
                        <span class="separator">|</span>
                        <div class="input-unit-wrapper">
                            <span class="unit-label-prefix">RIR</span>
                            <input type="number" class="routine-rir-input" data-id="${ex.id}" placeholder="-" value="${rir}" min="0" max="5">
                        </div>
                        <label class="fail-checkbox-wrapper">
                            <input type="checkbox" class="routine-failed-input" data-id="${ex.id}" ${failed}>
                            <span>Fallo</span>
                        </label>
                    </div>
                `;
                listContainer.appendChild(item);
            });

            // Inline add form
            const form = document.createElement('form');
            form.className = 'inline-add-exercise-form';
            form.setAttribute('data-day', day);
            form.innerHTML = `
                <input type="text" class="text-input" placeholder="Añadir ejercicio..." required>
                <button type="submit" class="btn btn-primary"><i class="ph ph-plus"></i></button>
            `;
            card.appendChild(form);

            container.appendChild(card);
        });
    }

    deleteRoutine(id) {
        if (confirm('¿Seguro que querés quitar este ejercicio de la rutina?')) {
            this.routine = this.routine.filter(r => r.id !== id);
            this.saveData('gym_routine');
            this.renderRoutine();
        }
    }

    renderCurrentSessionSets() {
        const box = document.getElementById('current-sets-list');
        if (!box) return;

        if (!this.activeSession || Object.keys(this.activeSession.exercises).length === 0) {
            box.innerHTML = '<p style="color:var(--text-secondary); padding: 10px; text-align:center;">Ninguna serie cargada todavía.</p>';
            return;
        }

        let html = '<table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left;">';
        html += `<tr style="border-bottom:1px solid var(--surface-border);"><th style="padding:6px;">Ejercicio</th><th style="padding:6px;">Series</th></tr>`;

        Object.keys(this.activeSession.exercises).forEach(ex => {
            const sets = this.activeSession.exercises[ex];
            const setsStr = sets.map((s, idx) => `S${idx+1}: <strong>${s.weight}kg</strong> x ${s.reps}`).join(' | ');
            html += `<tr style="border-bottom:1px dashed rgba(255,255,255,0.05);"><td style="padding:6px; color:white; font-weight:500;">${ex}</td><td style="padding:6px;">${setsStr}</td></tr>`;
        });
        html += '</table>';
        box.innerHTML = html;
    }

    renderSessionsLog() {
        const list = document.getElementById('sessions-history');
        if (!list) return;
        list.innerHTML = '';

        if (this.sessions.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay historial de entrenamientos.</p>';
            return;
        }

        this.sessions.forEach(s => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.background = 'rgba(255,255,255,0.02)';

            let exHtml = '<div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">';
            Object.keys(s.exercises).forEach(ex => {
                const sets = s.exercises[ex];
                const setsStr = sets.map((val, idx) => `S${idx+1}: <strong>${val.weight}kg</strong> x ${val.reps}`).join(' | ');
                exHtml += `
                    <div style="font-size:0.85rem; background:rgba(0,0,0,0.15); padding:8px; border-radius:6px; border:1px solid var(--surface-border);">
                        <div style="font-weight:600; color:white; margin-bottom:3px;">${ex}</div>
                        <div style="color:var(--text-secondary);">${setsStr}</div>
                    </div>
                `;
            });
            exHtml += '</div>';

            card.innerHTML = `
                <div class="card-header" style="justify-content: space-between; border-bottom: 1px dashed var(--surface-border); padding-bottom: 0.5rem;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-calendar" style="color:var(--primary-color);"></i>
                        <h4 style="margin: 0; color: white;">Entrenamiento del ${s.date}</h4>
                    </div>
                    <button class="btn-history-delete" onclick="window.gym.deleteSession(${s.id})" title="Eliminar Sesión"><i class="ph ph-trash" style="font-size:1.15rem;"></i></button>
                </div>
                <div class="card-body" style="padding-top: 5px;">
                    ${exHtml}
                </div>
            `;
            list.appendChild(card);
        });
    }

    deleteSession(id) {
        if (confirm('¿Seguro que deseas eliminar permanentemente este entrenamiento del historial?')) {
            this.sessions = this.sessions.filter(s => s.id !== id);
            this.saveData('gym_sessions');
            this.renderSessionsLog();
        }
    }

    updateRoutineExercisesList() {
        const dl = document.getElementById('routine-exercises-list');
        if (!dl) return;

        // Ejercicios únicos en la rutina maestra + marcas anteriores
        const unique = [...new Set([
            ...this.routine.map(r => r.name),
            ...this.records.map(r => r.name)
        ])];

        dl.innerHTML = unique.map(e => `<option value="${e}">`).join('');
    }

    renderNutrition() {
        const fixedBody = document.getElementById('fixed-meals-body');
        const varBody = document.getElementById('variable-meals-body');
        if (!fixedBody || !varBody) return;

        // Render fixed meals
        const fixedTotals = this.renderMealRows(fixedBody, this.meals.fixed, 'fixed');

        // Render variable meals (solo las de hoy)
        const todayStr = new Date().toLocaleDateString('es-AR');
        const todayVarMeals = this.meals.variable.filter(m => m.date === todayStr);
        const varTotals = this.renderMealRows(varBody, todayVarMeals, 'variable');

        // Sumar todo
        const totalKcal = fixedTotals.kcal + varTotals.kcal;
        const totalProtein = fixedTotals.protein + varTotals.protein;
        const totalCarbs = fixedTotals.carbs + varTotals.carbs;
        const totalFat = fixedTotals.fat + varTotals.fat;
        const totalSodium = fixedTotals.sodium + varTotals.sodium;

        // Actualizar dashboard
        document.getElementById('total-kcal').textContent = totalKcal.toFixed(0);
        document.getElementById('total-protein').textContent = totalProtein.toFixed(1) + 'g';
        document.getElementById('total-carbs').textContent = totalCarbs.toFixed(1) + 'g';
        document.getElementById('total-fat').textContent = totalFat.toFixed(1) + 'g';
        document.getElementById('total-sodium').textContent = totalSodium.toFixed(0) + 'mg';

        // Auto-complete list
        const fixedGroups = [...new Set(this.meals.fixed.map(m => m.group).filter(Boolean))];
        const fixedDatalist = document.getElementById('fixed-groups-list');
        if (fixedDatalist) fixedDatalist.innerHTML = fixedGroups.map(g => `<option value="${g}">`).join('');

        const varGroups = [...new Set(this.meals.variable.map(m => m.group).filter(Boolean))];
        const varDatalist = document.getElementById('variable-groups-list');
        if (varDatalist) varDatalist.innerHTML = varGroups.map(g => `<option value="${g}">`).join('');
    }

    renderMealRows(body, meals, type) {
        body.innerHTML = '';
        let tKcal = 0, tProtein = 0, tCarbs = 0, tFat = 0, tSodium = 0;

        if (meals.length === 0) {
            body.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-secondary); padding: 15px 0;">No hay comidas cargadas.</td></tr>`;
            return { kcal: tKcal, protein: tProtein, carbs: tCarbs, fat: tFat, sodium: tSodium };
        }

        const order = [];
        const groupsMap = {};

        meals.forEach(meal => {
            const grp = meal.group ? meal.group.trim() : '';
            if (grp) {
                if (!groupsMap[grp]) {
                    groupsMap[grp] = [];
                    order.push({ isGroup: true, name: grp });
                }
                groupsMap[grp].push(meal);
            } else {
                order.push({ isGroup: false, meal: meal });
            }
        });

        order.forEach(item => {
            if (item.isGroup) {
                const grpName = item.name;
                const grpMeals = groupsMap[grpName];
                if (!grpMeals || grpMeals.length === 0) return;

                delete groupsMap[grpName]; // Evitar duplicar

                let grpKcal = 0, grpProtein = 0, grpCarbs = 0, grpFat = 0, grpSodium = 0;
                grpMeals.forEach(m => {
                    const q = parseFloat(m.qty) || 1;
                    const mult = (m.unit === 'g' || m.unit === 'ml') ? (q / 100) : q;
                    grpKcal += (parseFloat(m.kcal) || 0) * mult;
                    grpProtein += (parseFloat(m.protein) || 0) * mult;
                    grpCarbs += (parseFloat(m.carbs) || 0) * mult;
                    grpFat += (parseFloat(m.fat) || 0) * mult;
                    grpSodium += (parseFloat(m.sodium) || 0) * mult;
                });

                tKcal += grpKcal;
                tProtein += grpProtein;
                tCarbs += grpCarbs;
                tFat += grpFat;
                tSodium += grpSodium;

                const collapsedKey = `${type}-${grpName}`;
                const isCollapsed = !!this.collapsedGroups[collapsedKey];

                const trHeader = document.createElement('tr');
                trHeader.style.background = 'rgba(255,255,255,0.02)';
                trHeader.innerHTML = `
                    <td style="padding: 8px;">
                        <button type="button" onclick="window.gym.toggleGroupCollapse('${type}', '${grpName.replace(/'/g, "\\'")}')" style="background:transparent; border:none; color:var(--primary-color); cursor:pointer; padding: 2px 5px; font-size:0.8rem;">
                            <i class="ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'}"></i>
                        </button>
                        <strong style="color: white;">📁 ${grpName}</strong>
                    </td>
                    <td style="color:var(--text-secondary);">-</td>
                    <td style="font-weight:bold; color:var(--primary-color);">${grpKcal.toFixed(0)}</td>
                    <td style="font-weight:bold;">${grpProtein.toFixed(1)}g</td>
                    <td style="font-weight:bold;">${grpCarbs.toFixed(1)}g</td>
                    <td style="font-weight:bold;">${grpFat.toFixed(1)}g</td>
                    <td style="font-weight:bold; color:var(--status-red);">${grpSodium.toFixed(0)}mg</td>
                    <td style="text-align:right;">
                        <button class="btn-history-delete" onclick="window.gym.deleteMealGroup('${type}', '${grpName.replace(/'/g, "\\'")}')" style="padding:0;"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </td>
                `;
                body.appendChild(trHeader);

                if (!isCollapsed) {
                    grpMeals.forEach(m => {
                        const q = parseFloat(m.qty) || 1;
                        const mult = (m.unit === 'g' || m.unit === 'ml') ? (q / 100) : q;
                        const trItem = document.createElement('tr');
                        trItem.innerHTML = `
                            <td style="padding: 8px 8px 8px 24px; color: var(--text-secondary);">↳ ${m.name}</td>
                            <td style="color:var(--text-secondary);">${q}${m.unit}</td>
                            <td>${((parseFloat(m.kcal) || 0) * mult).toFixed(0)}</td>
                            <td>${((parseFloat(m.protein) || 0) * mult).toFixed(1)}g</td>
                            <td>${((parseFloat(m.carbs) || 0) * mult).toFixed(1)}g</td>
                            <td>${((parseFloat(m.fat) || 0) * mult).toFixed(1)}g</td>
                            <td>${((parseFloat(m.sodium) || 0) * mult).toFixed(0)}mg</td>
                            <td style="text-align:right;">
                                <button class="btn-history-delete" onclick="window.gym.deleteMeal('${type}', ${m.id})" style="padding:0;"><i class="ph ph-trash" style="font-size:0.95rem;"></i></button>
                            </td>
                        `;
                        body.appendChild(trItem);
                    });
                }
            } else {
                const m = item.meal;
                const q = parseFloat(m.qty) || 1;
                const mult = (m.unit === 'g' || m.unit === 'ml') ? (q / 100) : q;

                const mKcal = (parseFloat(m.kcal) || 0) * mult;
                const mProtein = (parseFloat(m.protein) || 0) * mult;
                const mCarbs = (parseFloat(m.carbs) || 0) * mult;
                const mFat = (parseFloat(m.fat) || 0) * mult;
                const mSodium = (parseFloat(m.sodium) || 0) * mult;

                tKcal += mKcal;
                tProtein += mProtein;
                tCarbs += mCarbs;
                tFat += mFat;
                tSodium += mSodium;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 8px; font-weight:600; color:white;">${m.name}</td>
                    <td>${q}${m.unit}</td>
                    <td style="color:var(--primary-color);">${mKcal.toFixed(0)}</td>
                    <td>${mProtein.toFixed(1)}g</td>
                    <td>${mCarbs.toFixed(1)}g</td>
                    <td>${mFat.toFixed(1)}g</td>
                    <td style="color:var(--status-red);">${mSodium.toFixed(0)}mg</td>
                    <td style="text-align:right;">
                        <button class="btn-history-delete" onclick="window.gym.deleteMeal('${type}', ${m.id})" style="padding:0;"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </td>
                `;
                body.appendChild(tr);
            }
        });

        return { kcal: tKcal, protein: tProtein, carbs: tCarbs, fat: tFat, sodium: tSodium };
    }

    toggleGroupCollapse(type, groupName) {
        const key = `${type}-${groupName}`;
        this.collapsedGroups[key] = !this.collapsedGroups[key];
        this.renderNutrition();
    }

    deleteMealGroup(type, groupName) {
        if (confirm(`¿Seguro que querés eliminar todo el grupo "${groupName}"?`)) {
            this.meals[type] = this.meals[type].filter(m => (m.group || '') !== groupName);
            this.saveData('gym_meals');
            this.renderNutrition();
        }
    }

    deleteMeal(type, id) {
        this.meals[type] = this.meals[type].filter(m => m.id !== id);
        this.saveData('gym_meals');
        this.renderNutrition();
    }

    renderWeight() {
        const valSpan = document.getElementById('weight-last-val');
        const dateSpan = document.getElementById('weight-last-date');
        const fastingSpan = document.getElementById('weight-last-fasting');
        const diffSpan = document.getElementById('weight-diff');
        const avgSpan = document.getElementById('weight-average');
        const timerSpan = document.getElementById('weight-timer-count');
        const historyBox = document.getElementById('weight-history-list');

        if (!valSpan || !historyBox) return;

        if (this.weight.length === 0) {
            valSpan.textContent = '-';
            dateSpan.textContent = '-';
            fastingSpan.textContent = '-';
            diffSpan.textContent = '-';
            avgSpan.textContent = '-';
            timerSpan.textContent = '-';
            historyBox.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 10px; font-size:0.85rem;">Historial vacío.</p>';
            return;
        }

        const last = this.weight[0];
        valSpan.textContent = last.weight.toFixed(2) + ' kg';
        dateSpan.textContent = last.date.split('-').reverse().join('/');
        fastingSpan.textContent = last.fasting !== null ? `${last.fasting} hs` : 'Sin registrar';

        // Timer
        const elapsedDays = Math.floor((new Date() - new Date(last.date)) / 86400000);
        timerSpan.textContent = elapsedDays;

        // Difs
        if (this.weight.length > 1) {
            const diff = last.weight - this.weight[1].weight;
            const sign = diff >= 0 ? '+' : '';
            diffSpan.textContent = `${sign}${diff.toFixed(2)} kg`;
            diffSpan.style.color = diff > 0 ? 'var(--status-red)' : 'var(--status-green)';
        } else {
            diffSpan.textContent = '-';
            diffSpan.style.color = 'var(--text-secondary)';
        }

        // Avg
        const sum = this.weight.reduce((acc, curr) => acc + curr.weight, 0);
        avgSpan.textContent = (sum / this.weight.length).toFixed(2) + ' kg';

        // History list
        historyBox.innerHTML = this.weight.map(w => `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:white; align-items:center;">
                <span>📅 ${w.date.split('-').reverse().join('/')} - ⚖️ <strong>${w.weight.toFixed(2)}kg</strong> ${w.fasting ? `(${w.fasting}h ayuno)` : ''}</span>
                <button class="btn-history-delete" onclick="window.gym.deleteWeight(${w.id})" style="padding:0;"><i class="ph ph-trash" style="font-size:0.9rem;"></i></button>
            </div>
        `).join('');
    }

    deleteWeight(id) {
        if (confirm('¿Eliminar esta marca de peso corporal del historial?')) {
            this.weight = this.weight.filter(w => w.id !== id);
            this.saveData('gym_weight');
            this.renderWeight();
        }
    }

    renderSupplements() {
        const lastSpan = document.getElementById('vitd-last-date');
        const nextSpan = document.getElementById('vitd-next-date');
        const timerSpan = document.getElementById('vitd-timer-count');
        const badge = document.getElementById('vitd-badge');
        const histBox = document.getElementById('vitd-history-list');

        if (!lastSpan || !histBox) return;

        if (this.supplements.vit_d_history.length === 0) {
            lastSpan.textContent = '-';
            nextSpan.textContent = '-';
            timerSpan.textContent = '-';
            if (badge) {
                badge.textContent = 'Sin Tomas';
                badge.className = 'badge';
                badge.style.background = 'gray';
            }
            histBox.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 10px; font-size:0.85rem;">Historial vacío.</p>';
            return;
        }

        const last = new Date(this.supplements.vit_d_history[0].date);
        const interval = this.supplements.vit_d_days_interval;
        const next = new Date(last.getTime() + interval * 24 * 60 * 60 * 1000);

        lastSpan.textContent = last.toLocaleDateString('es-AR');
        nextSpan.textContent = next.toLocaleDateString('es-AR');

        const remainingDays = Math.ceil((next - new Date()) / 86400000);
        timerSpan.textContent = remainingDays;

        if (badge) {
            badge.style.background = '';
            badge.style.color = '';
            if (remainingDays <= 0) {
                badge.textContent = 'Tomar ahora';
                badge.className = 'badge red';
                timerSpan.style.color = 'var(--status-red)';
            } else if (remainingDays <= 7) {
                badge.textContent = 'Próximo';
                badge.className = 'badge orange';
                timerSpan.style.color = 'var(--status-orange)';
            } else {
                badge.textContent = 'Al día';
                badge.className = 'badge green';
                timerSpan.style.color = 'var(--status-green)';
            }
        }

        histBox.innerHTML = this.supplements.vit_d_history.map(t => `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:white; align-items:center;">
                <span>📅 Toma: ${new Date(t.date).toLocaleDateString('es-AR')}</span>
                <button class="btn-history-delete" onclick="window.gym.deleteVitdTake(${t.id})" style="padding:0;"><i class="ph ph-trash" style="font-size:0.9rem;"></i></button>
            </div>
        `).join('');
    }

    deleteVitdTake(id) {
        if (confirm('¿Eliminar este registro de toma de Vitamina D?')) {
            this.supplements.vit_d_history = this.supplements.vit_d_history.filter(t => t.id !== id);
            this.saveData('gym_supplements');
            this.renderSupplements();
        }
    }

    renderPainkillers() {
        const lastSpan = document.getElementById('pain-last-date');
        const typeSpan = document.getElementById('pain-last-type');
        const noteSpan = document.getElementById('pain-last-note');
        const timerSpan = document.getElementById('pain-timer-count');
        const badge = document.getElementById('pain-badge');
        const histBox = document.getElementById('pain-history-list');

        if (!lastSpan || !histBox) return;

        if (this.supplements.painkillers_history.length === 0) {
            lastSpan.textContent = '-';
            typeSpan.textContent = '-';
            noteSpan.textContent = '-';
            timerSpan.textContent = '-';
            if (badge) {
                badge.textContent = 'Ninguno';
                badge.style.background = 'gray';
            }
            histBox.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 10px; font-size:0.85rem;">Historial vacío.</p>';
            return;
        }

        const last = this.supplements.painkillers_history[0];
        const lastDate = new Date(last.date);
        lastSpan.textContent = lastDate.toLocaleDateString('es-AR');
        typeSpan.textContent = last.type;
        noteSpan.textContent = last.note || 'Sin detalles';

        const elapsedDays = Math.floor((new Date() - lastDate) / 86400000);
        timerSpan.textContent = elapsedDays;

        // Contadores
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
        const startOfMonth = startOfToday - 29 * 24 * 60 * 60 * 1000;

        let dayCount = 0, weekCount = 0, monthCount = 0;

        this.supplements.painkillers_history.forEach(p => {
            const time = new Date(p.date).getTime();
            if (time >= startOfToday) dayCount++;
            if (time >= startOfWeek) weekCount++;
            if (time >= startOfMonth) monthCount++;
        });

        document.getElementById('pain-count-day').textContent = `${dayCount} / 2`;
        document.getElementById('pain-count-week').textContent = `${weekCount} / 6`;
        document.getElementById('pain-count-month').textContent = `${monthCount} / 10`;

        if (badge) {
            badge.style.background = '';
            badge.style.color = '';
            if (dayCount > 2 || weekCount > 6 || monthCount > 10) {
                badge.textContent = '¡EXCESO!';
                badge.className = 'badge red';
            } else if (dayCount === 2 || weekCount >= 5 || monthCount >= 8) {
                badge.textContent = 'Al límite';
                badge.className = 'badge orange';
            } else {
                badge.textContent = 'Uso seguro';
                badge.className = 'badge green';
            }
        }

        histBox.innerHTML = this.supplements.painkillers_history.map(p => `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:white; align-items:center;">
                <span>📅 ${new Date(p.date).toLocaleDateString('es-AR')} - 💊 <strong>${p.type}</strong> ${p.note ? `(${p.note})` : ''}</span>
                <button class="btn-history-delete" onclick="window.gym.deletePainkillerTake(${p.id})" style="padding:0;"><i class="ph ph-trash" style="font-size:0.9rem;"></i></button>
            </div>
        `).join('');
    }

    deletePainkillerTake(id) {
        if (confirm('¿Eliminar este registro de toma de analgésico?')) {
            this.supplements.painkillers_history = this.supplements.painkillers_history.filter(p => p.id !== id);
            this.saveData('gym_supplements');
            this.renderPainkillers();
        }
    }
}

// ==========================================================================
// MÓDULO 5: PROYECTOS (ProjectPulse Freelance Deadline Tracker)
// ==========================================================================
class ProjectsModule {
    constructor(appController) {
        this.app = appController;
        this.projects = [];
        this.history = [];
        this.currentProjectId = null;
        this.FIXED_FEE = 0.0732; // Costo operativo retiro PayPal/Lemon (7.32%)

        window.projects = this;
        this.loadData();
        this.setupListeners();
        this.startTimersLoop();
    }

    loadData() {
        try {
            const projects = localStorage.getItem('projectPulseData');
            if (projects) this.projects = JSON.parse(projects);

            const history = localStorage.getItem('projectPulseHistory');
            if (history) this.history = JSON.parse(history);
        } catch (err) {
            console.error('Error loading Projects data', err);
        }
    }

    saveData() {
        localStorage.setItem('projectPulseData', JSON.stringify(this.projects));
        localStorage.setItem('projectPulseHistory', JSON.stringify(this.history));
    }

    calculateNet(gross, feeType, manualPercent, isDelegated = false, isReceived = false) {
        let finalNet = 0;
        if (feeType === 'direct') {
            finalNet = gross;
        } else if (feeType === 'paypal_direct') {
            const netAfterPayPal = (gross * (1 - 0.054)) - 0.30;
            finalNet = netAfterPayPal * 0.9457;
            if (finalNet < 0) finalNet = 0;
        } else {
            let pct = (feeType === 'custom') ? (parseFloat(manualPercent) || 0) : parseFloat(feeType);
            const amountAfterWorkana = gross * (1 - (pct / 100));
            finalNet = amountAfterWorkana * (1 - this.FIXED_FEE);
        }

        if (isDelegated) {
            finalNet = finalNet * 0.30;
        } else if (isReceived) {
            finalNet = finalNet * 0.70;
        }

        return parseFloat(finalNet.toFixed(2));
    }

    formatDate(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hr = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hr}:${min}`;
    }

    setupListeners() {
        // Commission select custom percent toggle
        const feeSelect = document.getElementById('workanaFeeSelect');
        const customContainer = document.getElementById('customFeeContainer');
        if (feeSelect && customContainer) {
            feeSelect.addEventListener('change', () => {
                customContainer.classList.toggle('hidden', feeSelect.value !== 'custom');
            });
        }

        // New Project Form Submit
        const form = document.getElementById('projectForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const client = document.getElementById('clientName').value.trim();
                const project = document.getElementById('projectName').value.trim();
                const accepted = document.getElementById('acceptDate').value;
                const days = parseFloat(document.getElementById('deliveryDays').value);
                const gross = parseFloat(document.getElementById('budgetGross').value);
                const feeType = document.getElementById('workanaFeeSelect').value;
                const customPct = parseFloat(document.getElementById('customWorkanaFee').value) || 0;
                const isDel = false;
                const isRec = false;

                const timeTotal = days * 24 * 60 * 60 * 1000;
                const deadline = new Date(new Date(accepted).getTime() + timeTotal).toISOString();
                const net = this.calculateNet(gross, feeType, customPct, isDel, isRec);

                const newProj = {
                    id: Date.now(),
                    client,
                    project,
                    accepted,
                    days,
                    budgetGross: gross,
                    feeType,
                    manualPercent: customPct,
                    isDelegated: isDel,
                    isReceived: isRec,
                    budgetNet: net,
                    timeSpent: 0,
                    timerStart: null,
                    tasks: [],
                    summary: '',
                    phases: '',
                    isDelivered: false,
                    deliveredAt: null,
                    deadline
                };

                this.projects.push(newProj);
                this.saveData();
                this.render();
                form.reset();
                customContainer?.classList.add('hidden');
            });
        }

        // Projects Edit (Gestionar) Modal Cancel/Save
        const editCancel = document.getElementById('proj-edit-cancel');
        const editSave = document.getElementById('proj-edit-save');
        const editModal = document.getElementById('projects-edit-modal');

        editCancel?.addEventListener('click', () => {
            editModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        editSave?.addEventListener('click', () => {
            if (!this.currentProjectId) return;
            const p = this.projects.find(proj => proj.id === this.currentProjectId);
            if (!p) return;

            const extraDays = parseFloat(document.getElementById('proj-extraDays').value) || 0;
            const extraBudget = parseFloat(document.getElementById('proj-extraBudget').value) || 0;
            const manualHrs = parseFloat(document.getElementById('proj-manualHours').value) || 0;
            const manualMins = parseFloat(document.getElementById('proj-manualMinutes').value) || 0;

            // Ajustar plazos
            if (extraDays > 0) {
                p.days = (p.days || 0) + extraDays;
                const oldDeadline = p.deadline ? new Date(p.deadline) : new Date(p.accepted);
                p.deadline = new Date(oldDeadline.getTime() + extraDays * 24 * 60 * 60 * 1000).toISOString();
            }

            // Presupuesto extra
            if (extraBudget > 0) {
                p.budgetGross = (p.budgetGross || 0) + extraBudget;
                p.budgetNet = this.calculateNet(p.budgetGross, p.feeType, p.manualPercent, p.isDelegated, p.isReceived);
            }

            // Tiempo trabajado manual
            if (manualHrs > 0 || manualMins > 0) {
                const addedMs = (manualHrs * 60 * 60 * 1000) + (manualMins * 60 * 1000);
                p.timeSpent = (p.timeSpent || 0) + addedMs;
            }

            this.saveData();
            this.render();
            editModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        // Plan Modal Save & Close & Task addition
        const planClose = document.getElementById('proj-plan-modal-close');
        const planSave = document.getElementById('proj-plan-modal-save');
        const planModal = document.getElementById('projects-plan-modal');
        const btnAddTask = document.getElementById('proj-btn-add-task');

        planClose?.addEventListener('click', () => {
            planModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        planSave?.addEventListener('click', () => {
            if (!this.currentProjectId) return;
            const p = this.projects.find(proj => String(proj.id) === String(this.currentProjectId));
            if (!p) return;

            p.summary = document.getElementById('proj-summary-textarea').value.trim();
            p.phases = document.getElementById('proj-phases-textarea').value.trim();

            this.saveData();
            this.render();
            planModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        btnAddTask?.addEventListener('click', () => {
            if (!this.currentProjectId) return;
            const p = this.projects.find(proj => String(proj.id) === String(this.currentProjectId));
            if (!p) return;

            const taskInput = document.getElementById('proj-new-task-input');
            const text = taskInput.value.trim();
            if (!text) return;

            if (!p.tasks) p.tasks = [];
            p.tasks.push({ id: Date.now(), text, completed: false });
            this.saveData();
            this.renderTasks(p.tasks);
            taskInput.value = '';
        });

        // History Modal click controls
        const btnOpenHistory = document.getElementById('btnOpenHistory');
        const btnOpenMonthDetails = document.getElementById('btnOpenMonthDetails');
        const btnOpenYearDetails = document.getElementById('btnOpenYearDetails');
        const historyModal = document.getElementById('projects-history-modal');
        const closeHistory = document.getElementById('proj-close-history-modal');

        btnOpenHistory?.addEventListener('click', () => {
            historyModal?.classList.remove('hidden');
            this.renderMonthlyHistory('all');
        });

        btnOpenMonthDetails?.addEventListener('click', () => {
            historyModal?.classList.remove('hidden');
            this.renderMonthlyHistory('month');
        });

        btnOpenYearDetails?.addEventListener('click', () => {
            historyModal?.classList.remove('hidden');
            this.renderMonthlyHistory('year');
        });

        closeHistory?.addEventListener('click', () => {
            historyModal?.classList.add('hidden');
        });

        // Past Income toggler
        const btnTogglePast = document.getElementById('proj-btnToggleAddPastIncome');
        const pastForm = document.getElementById('proj-add-past-income-form');
        const btnCancelPast = document.getElementById('proj-btnCancelPastIncome');
        const btnSavePast = document.getElementById('proj-btnSavePastIncome');

        btnTogglePast?.addEventListener('click', () => {
            pastForm?.classList.toggle('hidden');
        });

        btnCancelPast?.addEventListener('click', () => {
            pastForm?.classList.add('hidden');
            this.resetPastForm();
        });

        btnSavePast?.addEventListener('click', () => {
            const client = document.getElementById('proj-pastClient').value.trim();
            const project = document.getElementById('proj-pastProject').value.trim();
            const date = document.getElementById('proj-pastDate').value;
            const hrs = parseFloat(document.getElementById('proj-pastHours').value) || 0;
            const gross = parseFloat(document.getElementById('proj-pastGross').value) || 0;
            const net = parseFloat(document.getElementById('proj-pastNet').value) || 0;

            if (!client || !project || !date || isNaN(gross) || isNaN(net)) {
                alert('Por favor completa todos los campos requeridos.');
                return;
            }

            const pPast = {
                id: Date.now(),
                client,
                project,
                accepted: date,
                days: 0,
                budgetGross: gross,
                budgetNet: net,
                timeSpent: hrs * 60 * 60 * 1000,
                timerStart: null,
                tasks: [],
                summary: 'Ingreso cargado manualmente del historial pasado.',
                phases: '',
                isDelivered: true,
                deliveredAt: new Date(date).toISOString(),
                deliveredDate: date,
                deadline: date
            };

            this.history.unshift(pPast);
            this.history.sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt));
            this.saveData();
            this.render();
            this.renderMonthlyHistory('all');
            pastForm?.classList.add('hidden');
            this.resetPastForm();
        });
    }

    resetPastForm() {
        document.getElementById('proj-pastClient').value = '';
        document.getElementById('proj-pastProject').value = '';
        document.getElementById('proj-pastDate').value = '';
        document.getElementById('proj-pastHours').value = '';
        document.getElementById('proj-pastGross').value = '';
        document.getElementById('proj-pastNet').value = '';
    }

    render() {
        const list = document.getElementById('projectsList');
        const activeCount = document.getElementById('activeCount');
        if (!list || !activeCount) return;

        list.innerHTML = '';
        activeCount.innerText = this.projects.length;

        // Calcular Finanzas del Dashboard
        let activeNetSum = 0;
        this.projects.forEach(p => {
            activeNetSum += (p.budgetNet || 0);
        });
        document.getElementById('activeUSD').innerText = `USD ${activeNetSum.toFixed(2)}`;

        const now = new Date();
        const currYear = now.getFullYear();
        const currMonth = now.getMonth();

        let monthNetSum = 0;
        let yearNetSum = 0;
        let totalNetSum = 0;

        this.history.forEach(p => {
            totalNetSum += (p.budgetNet || 0);
            const dateStr = p.deliveredDate || p.deliveredAt;
            if (dateStr) {
                const del = new Date(dateStr);
                if (del.getFullYear() === currYear) {
                    yearNetSum += (p.budgetNet || 0);
                    if (del.getMonth() === currMonth) {
                        monthNetSum += (p.budgetNet || 0);
                    }
                }
            }
        });

        document.getElementById('monthUSD').innerText = `USD ${monthNetSum.toFixed(2)}`;
        document.getElementById('yearUSD').innerText = `USD ${yearNetSum.toFixed(2)}`;
        document.getElementById('totalUSD').innerText = `USD ${totalNetSum.toFixed(2)}`;

        if (this.projects.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 25px;">No hay proyectos activos.</p>';
            return;
        }

        this.projects.forEach(p => {
            const deadline = new Date(p.deadline);
            let remainingMs = deadline - now;
            let totalMs = deadline - new Date(p.accepted);

            let progress = ((totalMs - remainingMs) / totalMs) * 100;
            progress = Math.max(0, Math.min(100, progress));

            let colorVar = "var(--status-green)";
            let countdownText = "";
            let leftDateLabel = "Aceptado:";
            let leftDateVal = this.formatDate(p.accepted);
            let rightDateLabel = `Límite (${p.days}d):`;
            let rightDateVal = this.formatDate(p.deadline);

            if (p.isDelivered) {
                if (!p.deliveredAt) p.deliveredAt = now.toISOString();
                const del = new Date(p.deliveredAt);
                const releaseDate = new Date(del.getTime() + 15 * 24 * 60 * 60 * 1000);
                const relRemainingMs = releaseDate - now;
                const relTotalMs = 15 * 24 * 60 * 60 * 1000;

                progress = ((relTotalMs - relRemainingMs) / relTotalMs) * 100;
                progress = Math.max(0, Math.min(100, progress));

                leftDateLabel = "Entregado:";
                leftDateVal = this.formatDate(p.deliveredAt);
                rightDateLabel = "Liberación (15d):";
                rightDateVal = this.formatDate(releaseDate);

                if (relRemainingMs <= 0) {
                    countdownText = "LISTO PARA LIBERAR";
                    colorVar = "var(--status-green)";
                    progress = 100;
                } else {
                    const d = Math.floor(relRemainingMs / 86400000);
                    const h = Math.floor((relRemainingMs % 86400000) / 3600000);
                    countdownText = `Fondos en ${d}d ${h}h`;

                    const remPct = (relRemainingMs / relTotalMs) * 100;
                    if (remPct <= 10) colorVar = "var(--status-green)";
                    else if (remPct <= 50) colorVar = "var(--status-orange)";
                    else colorVar = "var(--status-yellow)";
                }
            } else {
                if (remainingMs <= 0) {
                    countdownText = "ENTREGA DEMORADA";
                    colorVar = "var(--status-red)";
                } else {
                    const d = Math.floor(remainingMs / 86400000);
                    const h = Math.floor((remainingMs % 86400000) / 3600000);
                    countdownText = `Faltan ${d}d ${h}h`;

                    const remPct = (remainingMs / totalMs) * 100;
                    if (remPct <= 10) colorVar = "var(--status-red)";
                    else if (remPct <= 30) colorVar = "var(--status-orange)";
                    else if (remPct <= 50) colorVar = "var(--status-yellow)";
                }
            }

            let badgeSpan = '';
            if (p.isDelegated) {
                badgeSpan = '<span class="badge" style="background:var(--status-yellow); color:#000; font-size:0.7rem; margin-left:8px; vertical-align:middle; padding:3px 8px;">Delegado (30%)</span>';
            } else if (p.isReceived) {
                badgeSpan = '<span class="badge" style="background:var(--status-green); color:#fff; font-size:0.7rem; margin-left:8px; vertical-align:middle; padding:3px 8px;">Fabro (70%)</span>';
            }

            const isRunning = p.timerStart !== null;
            const btnIcon = isRunning ? '⏸️' : '▶️';
            const btnBg = isRunning ? 'var(--status-red)' : 'var(--primary-color)';
            const btnColor = 'white';

            let initialMs = p.timeSpent || 0;
            if (p.timerStart) {
                initialMs += (now - new Date(p.timerStart));
            }
            const initialSecs = Math.floor(initialMs / 1000);
            const h = Math.floor(initialSecs / 3600);
            const m = Math.floor((initialSecs % 3600) / 60);
            const s = initialSecs % 60;
            const formattedTime = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;

            let rateText = 'USD --/h';
            let rateColor = 'var(--text-secondary)';
            const totalHours = initialMs / (3600 * 1000);
            if (totalHours > 0) {
                const rate = (p.budgetNet || 0) / totalHours;
                rateText = `USD ${rate.toFixed(2)}/h`;
                if (rate >= 25) rateColor = 'var(--status-green)';
                else if (rate >= 20) rateColor = 'var(--primary-color)';
                else if (rate >= 10) rateColor = 'var(--status-yellow)';
                else rateColor = 'var(--status-red)';
            }

            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-project-id', p.id);
            card.style.background = p.isDelivered ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-color)';
            card.style.border = p.isDelivered ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--surface-border)';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <h3 class="project-client" style="color:white; font-size:1.15rem; margin:0; display:flex; align-items:center; flex-wrap:wrap;">
                            ${p.client} ${badgeSpan}
                        </h3>
                        <p class="project-name" style="color:var(--text-secondary); font-size:0.85rem; margin: 3px 0 10px 0;">${p.project}</p>
                    </div>
                    <button class="btn-history-delete" onclick="window.projects.deleteActiveProject(${p.id})" title="Eliminar proyecto"><i class="ph ph-trash" style="font-size:1.15rem;"></i></button>
                </div>

                <div class="finance-block">
                    <span class="gross-amount">Presupuesto Bruto: USD ${p.budgetGross.toFixed(2)} (${p.feeType === 'direct' ? 'Sin comisiones' : (p.feeType === 'paypal_direct' ? 'PayPal Direct' : (p.feeType === 'custom' ? `Workana ${p.manualPercent}%` : `Workana ${p.feeType || 20}%`))})</span>
                    <strong class="net-amount">Neto: USD ${p.budgetNet.toFixed(2)}</strong>
                </div>

                <div class="timer-block" style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); border:1px solid var(--surface-border); border-radius:8px; padding:8px 12px; margin-bottom:1rem; gap:10px;">
                    <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                        <span style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Tiempo dedicado</span>
                        <strong class="timer-display" style="font-size:1.05rem; color:white; font-variant-numeric: tabular-nums;">${formattedTime}</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; min-width:0;">
                            <span style="font-size:0.7rem; color:var(--text-secondary);">Valor Hora</span>
                            <strong class="rate-value" style="font-size:0.9rem; color:${rateColor};">${rateText}</strong>
                        </div>
                        <button onclick="window.projects.toggleTimer('${p.id}', event)" style="background:${btnBg}; color:${btnColor}; border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; transition: transform 0.1s; flex-shrink:0;">${btnIcon}</button>
                    </div>
                </div>

                <div class="project-dates">
                    <div class="date-block">
                        <span>${leftDateLabel}</span>
                        <strong>${leftDateVal}</strong>
                    </div>
                    <div class="date-block" style="text-align: right;">
                        <span>${rightDateLabel}</span>
                        <strong>${rightDateVal}</strong>
                    </div>
                </div>

                <div class="pulse-bar">
                    <div class="pulse-progress" style="width:${progress}%; background:${colorVar}"></div>
                </div>
                
                <div class="countdown" style="color:${colorVar}">${countdownText}</div>
                
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                    ${!p.isDelivered ? `
                        <button class="btn btn-secondary" style="margin: 0;" onclick="window.projects.openPlanModal('${p.id}')"><i class="ph ph-clipboard-text"></i> Plan de Acción</button>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary half" style="margin:0;" onclick="window.projects.openEditModal('${p.id}')"><i class="ph ph-gear"></i> Gestionar</button>
                            <button class="btn btn-primary half" style="margin:0; background: var(--status-green); color: white;" onclick="window.projects.markAsDelivered('${p.id}')"><i class="ph ph-check"></i> Entregado</button>
                        </div>
                    ` : `
                        <button class="btn btn-secondary" style="margin: 0;" onclick="window.projects.openPlanModal('${p.id}')"><i class="ph ph-clipboard-text"></i> Plan de Acción</button>
                        <button class="btn btn-primary" style="background:var(--status-green); color:white; width:100%; border:none; padding:12px; font-size:1rem; border-radius:8px; cursor:pointer; margin:0;" onclick="window.projects.confirmPayment('${p.id}')"><i class="ph ph-coins"></i> Pago Confirmado</button>
                    `}
                </div>
            `;
            list.appendChild(card);
        });
    }

    deleteActiveProject(id) {
        if (confirm('¿Seguro que deseas eliminar este proyecto de la lista de activos?')) {
            this.projects = this.projects.filter(p => p.id !== id);
            this.saveData();
            this.render();
        }
    }

    toggleTimer(id, event) {
        if (event) event.stopPropagation();

        const now = new Date();
        const p = this.projects.find(proj => proj.id == id);
        if (!p) return;

        if (p.timerStart) {
            // Pausar timer
            const elapsed = now - new Date(p.timerStart);
            p.timeSpent = (p.timeSpent || 0) + elapsed;
            p.timerStart = null;
        } else {
            // Iniciar timer (Pausar todos los demás activos)
            this.projects.forEach(other => {
                if (other.timerStart && other.id !== p.id) {
                    const elapsed = now - new Date(other.timerStart);
                    other.timeSpent = (other.timeSpent || 0) + elapsed;
                    other.timerStart = null;
                }
            });
            p.timerStart = now.toISOString();
        }

        this.saveData();
        this.render();
    }

    openPlanModal(id) {
        this.currentProjectId = id;
        const p = this.projects.find(proj => String(proj.id) === String(id));
        if (!p) return;

        document.getElementById('proj-summary-textarea').value = p.summary || '';
        document.getElementById('proj-phases-textarea').value = p.phases || '';
        this.renderTasks(p.tasks || []);

        const modal = document.getElementById('projects-plan-modal');
        modal?.classList.remove('hidden');
    }

    renderTasks(tasks) {
        const list = document.getElementById('proj-tasks-list');
        if (!list) return;
        list.innerHTML = '';

        tasks.forEach(t => {
            const row = document.createElement('div');
            row.className = 'task-item';
            row.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} onchange="window.projects.toggleTask(${t.id})">
                <span class="task-text ${t.completed ? 'completed' : ''}">${t.text}</span>
                <button class="btn-delete-task" onclick="window.projects.deleteTask(${t.id})">&times;</button>
            `;
            list.appendChild(row);
        });
    }

    toggleTask(taskId) {
        if (!this.currentProjectId) return;
        const p = this.projects.find(proj => String(proj.id) === String(this.currentProjectId));
        if (!p) return;

        const task = p.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveData();
            this.renderTasks(p.tasks);
        }
    }

    deleteTask(taskId) {
        if (!this.currentProjectId) return;
        const p = this.projects.find(proj => String(proj.id) === String(this.currentProjectId));
        if (!p) return;

        p.tasks = p.tasks.filter(t => t.id !== taskId);
        this.saveData();
        this.renderTasks(p.tasks);
    }

    openEditModal(id) {
        this.currentProjectId = id;
        const modal = document.getElementById('projects-edit-modal');
        if (modal) {
            document.getElementById('proj-extraDays').value = 0;
            document.getElementById('proj-extraBudget').value = 0;
            document.getElementById('proj-manualHours').value = '';
            document.getElementById('proj-manualMinutes').value = '';
            modal.classList.remove('hidden');
        }
    }

    markAsDelivered(id) {
        const p = this.projects.find(proj => proj.id == id);
        if (p) {
            // Pausar timer si está activo
            if (p.timerStart) {
                const elapsed = new Date() - new Date(p.timerStart);
                p.timeSpent = (p.timeSpent || 0) + elapsed;
                p.timerStart = null;
            }
            p.isDelivered = true;
            p.deliveredAt = new Date().toISOString();
            this.saveData();
            this.render();
        }
    }

    confirmPayment(id) {
        const pIndex = this.projects.findIndex(proj => proj.id == id);
        if (pIndex !== -1) {
            const p = this.projects[pIndex];
            p.deliveredDate = new Date().toISOString().split('T')[0];

            this.history.unshift(p);
            this.projects.splice(pIndex, 1);
            this.saveData();
            this.render();
        }
    }

    renderMonthlyHistory(filterType = 'all') {
        const list = document.getElementById('proj-monthlyHistoryList');
        if (!list) return;
        list.innerHTML = '';

        // Calcular Promedios
        const averages = this.calculateAverages();
        document.getElementById('proj-avgHistorical').innerText = `USD ${averages.historical.toFixed(2)}`;
        document.getElementById('proj-avg6Months').innerText = `USD ${averages.last6.toFixed(2)}`;
        document.getElementById('proj-avg3Months').innerText = `USD ${averages.last3.toFixed(2)}`;

        // Agrupar
        const monthsMap = {};
        this.history.forEach(p => {
            const dateStr = p.deliveredDate || p.deliveredAt;
            const delDate = dateStr ? new Date(dateStr) : new Date();
            const year = delDate.getFullYear();
            const month = delDate.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;

            if (!monthsMap[key]) {
                monthsMap[key] = {
                    title: delDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' }),
                    projects: [],
                    totalNet: 0
                };
            }
            monthsMap[key].projects.push(p);
            monthsMap[key].totalNet += (p.budgetNet || 0);
        });

        // Ordenar meses descendiente
        const sortedKeys = Object.keys(monthsMap).sort((a, b) => b.localeCompare(a));

        if (sortedKeys.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">Historial vacío.</p>';
            return;
        }

        sortedKeys.forEach(k => {
            const m = monthsMap[k];
            const card = document.createElement('div');
            card.className = 'history-month-card';

            let projItems = '';
            m.projects.forEach(p => {
                const dateStr = p.deliveredDate ? p.deliveredDate.split('-').reverse().join('/') : '-';
                projItems += `
                    <div class="history-project-item">
                        <div class="history-project-info">
                            <span class="history-project-title">${p.client} - ${p.project}</span>
                            <span class="history-project-date">Cobrado: ${dateStr}</span>
                        </div>
                        <div class="history-project-actions">
                            <span class="history-project-net">+ USD ${p.budgetNet.toFixed(2)}</span>
                            <button class="btn-history-delete" onclick="window.projects.deleteHistoryProject(${p.id}, '${filterType}')">&times;</button>
                        </div>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="history-month-header" onclick="this.nextElementSibling.classList.toggle('hidden');">
                    <h4>${m.title}</h4>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <strong style="color:var(--status-green);">+ USD ${m.totalNet.toFixed(2)}</strong>
                        <span class="toggle-icon"><i class="ph ph-caret-down"></i></span>
                    </div>
                </div>
                <div class="history-month-details hidden">
                    ${projItems}
                </div>
            `;
            list.appendChild(card);
        });
    }

    deleteHistoryProject(id, filterType) {
        const p = this.history.find(proj => proj.id === id);
        if (!p) return;

        if (confirm(`¿Desconfirmar el pago del proyecto "${p.project}" de ${p.client}?\n\nEl proyecto se quitará de los ingresos y volverá a la lista de activos.`)) {
            this.history = this.history.filter(proj => proj.id !== id);
            p.deliveredDate = null;
            p.isDelivered = false;
            p.deliveredAt = null;
            this.projects.push(p);
            this.saveData();
            this.render();
            this.renderMonthlyHistory(filterType);
        }
    }

    calculateAverages() {
        if (this.history.length === 0) return { historical: 0, last6: 0, last3: 0 };

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let earliestDate = now;
        this.history.forEach(p => {
            const dateStr = p.deliveredDate || p.deliveredAt;
            if (dateStr) {
                const d = new Date(dateStr);
                if (d < earliestDate) earliestDate = d;
            }
        });

        const startYear = earliestDate.getFullYear();
        const startMonth = earliestDate.getMonth();
        const totalHistoricalMonths = Math.max(1, (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1);

        let totalUSD = 0;
        this.history.forEach(p => {
            totalUSD += (p.budgetNet || 0);
        });

        const avgHistorical = totalUSD / totalHistoricalMonths;

        let sum3Months = 0;
        let sum6Months = 0;

        const dateLimit3 = new Date(currentYear, currentMonth - 2, 1);
        const dateLimit6 = new Date(currentYear, currentMonth - 5, 1);

        this.history.forEach(p => {
            const dateStr = p.deliveredDate || p.deliveredAt;
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (d >= dateLimit3) sum3Months += (p.budgetNet || 0);
            if (d >= dateLimit6) sum6Months += (p.budgetNet || 0);
        });

        return {
            historical: avgHistorical,
            last6: sum6Months / 6,
            last3: sum3Months / 3
        };
    }

    startTimersLoop() {
        setInterval(() => {
            const now = new Date();
            let changed = false;

            this.projects.forEach(p => {
                if (p.timerStart) {
                    const cardEl = document.querySelector(`.card[data-project-id="${p.id}"]`);
                    if (cardEl) {
                        let totalMs = p.timeSpent || 0;
                        totalMs += (now - new Date(p.timerStart));

                        const totalSecs = Math.floor(totalMs / 1000);
                        const hrs = Math.floor(totalSecs / 3600);
                        const mins = Math.floor((totalSecs % 3600) / 60);
                        const secs = totalSecs % 60;

                        const timerDisplay = cardEl.querySelector('.timer-display');
                        if (timerDisplay) {
                            timerDisplay.innerText = `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
                        }

                        // Recalcular valor hora
                        const rateValue = cardEl.querySelector('.rate-value');
                        if (rateValue) {
                            const totalHours = totalMs / (3600 * 1000);
                            if (totalHours > 0) {
                                const rate = (p.budgetNet || 0) / totalHours;
                                rateValue.innerText = `USD ${rate.toFixed(2)}/h`;

                                let rateColor = 'var(--text-secondary)';
                                if (rate >= 25) rateColor = 'var(--status-green)';
                                else if (rate >= 20) rateColor = 'var(--primary-color)';
                                else if (rate >= 10) rateColor = 'var(--status-yellow)';
                                else rateColor = 'var(--status-red)';
                                rateValue.style.color = rateColor;
                            }
                        }
                    }
                }
            });
        }, 1000);
    }
}

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
            vehicle_maintenance_log: localStorage.getItem('vehicle_maintenance_log'),
            gym_records: localStorage.getItem('gym_records'),
            gym_routine: localStorage.getItem('gym_routine'),
            gym_routine_focus: localStorage.getItem('gym_routine_focus'),
            gym_sessions: localStorage.getItem('gym_sessions'),
            gym_meals: localStorage.getItem('gym_meals'),
            gym_supplements: localStorage.getItem('gym_supplements'),
            gym_weight: localStorage.getItem('gym_weight'),
            projectPulseData: localStorage.getItem('projectPulseData'),
            projectPulseHistory: localStorage.getItem('projectPulseHistory')
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
                } else if (rawData.appName === undefined && !rawData.groomingData_v2 && !lensFound && !rawData.gym_routine && !rawData.projectPulseData) {
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

                // Gimnasio
                const gymKeys = [
                    'gym_records', 'gym_routine', 'gym_routine_focus', 
                    'gym_sessions', 'gym_meals', 'gym_supplements', 'gym_weight'
                ];
                let gymFound = false;
                gymKeys.forEach(key => {
                    if (rawData[key] !== undefined && rawData[key] !== null) {
                        const val = typeof rawData[key] === 'object' ? JSON.stringify(rawData[key]) : rawData[key];
                        localStorage.setItem(key, val);
                        gymFound = true;
                    }
                });
                if (gymFound) {
                    importedCategories.push("Gimnasio (GymTracker)");
                }

                // Proyectos
                let projectsFound = false;
                if (rawData.projectPulseData) {
                    const dataVal = typeof rawData.projectPulseData === 'string' 
                        ? rawData.projectPulseData 
                        : JSON.stringify(rawData.projectPulseData);
                    localStorage.setItem('projectPulseData', dataVal);
                    projectsFound = true;
                }
                if (rawData.projectPulseHistory) {
                    const dataVal = typeof rawData.projectPulseHistory === 'string' 
                        ? rawData.projectPulseHistory 
                        : JSON.stringify(rawData.projectPulseHistory);
                    localStorage.setItem('projectPulseHistory', dataVal);
                    projectsFound = true;
                }
                if (projectsFound) {
                    importedCategories.push("Proyectos (ProjectPulse)");
                }

                if (importedCategories.length > 0) {
                    alert(`Backup restaurado correctamente. Módulos importados:\n- ${importedCategories.join('\n- ')}`);
                    location.reload();
                } else {
                    alert('Archivo JSON válido pero no contiene datos compatibles de LifeCycle.');
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
// MÓDULO DE AUTENTICACIÓN Y SINCRONIZACIÓN (SUPABASE)
// ==========================================================================
class AuthSyncModule {
    constructor(appController) {
        this.app = appController;
        this.supabase = null;
        this.user = null;
        this.config = null;
        
        // Dom Elements
        this.authLoading = document.getElementById('auth-loading');
        this.authLoggedOut = document.getElementById('auth-logged-out');
        this.authLoggedIn = document.getElementById('auth-logged-in');
        
        this.authForm = document.getElementById('auth-form');
        this.authEmail = document.getElementById('auth-email');
        this.authPassword = document.getElementById('auth-password');
        this.btnLogin = document.getElementById('btn-login');
        this.btnSignup = document.getElementById('btn-signup');
        
        this.profileEmail = document.getElementById('profile-email');
        this.syncStatusBadge = document.getElementById('sync-status-badge');
        this.btnSyncNow = document.getElementById('btn-sync-now');
        this.btnLogout = document.getElementById('btn-logout');
        
        this.pushNotificationsCard = document.getElementById('push-notifications-card');
        this.btnEnablePush = document.getElementById('btn-enable-push');
        this.btnTestPush = document.getElementById('btn-test-push');
        
        this.realtimeChannel = null;
        this.init();
    }

    async init() {
        try {
            // 1. Fetch credentials from server config endpoint
            const res = await fetch('/api/config');
            this.config = await res.json();
            
            if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
                console.log("Supabase credentials not configured in backend. Running in offline/localStorage mode.");
                this.showOfflineMode();
                return;
            }
            
            // 2. Initialize Supabase client
            this.supabase = supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
            
            // 3. Bind UI listeners
            this.setupListeners();
            
            // 4. Initial session check
            const { data: { session } } = await this.supabase.auth.getSession();
            this.handleAuthStateChange(session?.user || null);
            
            // 5. Setup auth state change listener
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.handleAuthStateChange(session?.user || null);
            });
            
        } catch (err) {
            console.error("Error initializing Supabase:", err);
            this.showOfflineMode();
        }
    }

    showOfflineMode() {
        this.authLoading?.classList.add('hidden');
        this.authLoggedOut?.classList.add('hidden');
        this.authLoggedIn?.classList.add('hidden');
    }

    setupListeners() {
        // Form Submit handles Login
        this.authForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const action = e.submitter?.id; // 'btn-login'
            if (action === 'btn-login') {
                await this.login();
            }
        });

        // Signup Button Click
        this.btnSignup?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.signup();
        });

        // Logout Button Click
        this.btnLogout?.addEventListener('click', async () => {
            await this.logout();
        });

        // Manual Sync Button Click
        this.btnSyncNow?.addEventListener('click', async () => {
            await this.syncToCloud(true);
        });

        // Push Notifications Click Listeners
        this.btnEnablePush?.addEventListener('click', async () => {
            await this.enablePushNotifications();
        });

        this.btnTestPush?.addEventListener('click', async () => {
            await this.sendTestPushNotification();
        });
    }

    async login() {
        const email = this.authEmail?.value;
        const password = this.authPassword?.value;
        if (!email || !password) return;
        
        this.setLoading(true, "Iniciando sesión...");
        sessionStorage.setItem('is_explicit_login', 'true');
        
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            alert("Error al iniciar sesión: " + error.message);
            sessionStorage.removeItem('is_explicit_login');
            this.setLoading(false);
        }
    }

    async signup() {
        const email = this.authEmail?.value;
        const password = this.authPassword?.value;
        if (!email || !password) return;
        
        if (password.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        
        this.setLoading(true, "Creando cuenta...");
        sessionStorage.setItem('is_explicit_login', 'true');
        
        const { data, error } = await this.supabase.auth.signUp({ email, password });
        
        if (error) {
            alert("Error al registrarse: " + error.message);
            sessionStorage.removeItem('is_explicit_login');
            this.setLoading(false);
        } else {
            alert("¡Registro exitoso! Si se configuró confirmación por correo, revisa tu casilla. De lo contrario, ya has iniciado sesión.");
            this.setLoading(false);
        }
    }

    async logout() {
        if (confirm("¿Estás seguro de que deseas cerrar sesión? Volverás al modo local sin conexión.")) {
            this.setLoading(true, "Cerrando sesión...");
            await this.supabase.auth.signOut();
            location.reload();
        }
    }

    async handleAuthStateChange(user) {
        this.user = user;
        this.setLoading(false);
        
        if (user) {
            // Logged in
            if (this.authLoggedOut) this.authLoggedOut.classList.add('hidden');
            if (this.authLoggedIn) this.authLoggedIn.classList.remove('hidden');
            if (this.profileEmail) this.profileEmail.innerText = user.email;
            if (this.pushNotificationsCard) this.pushNotificationsCard.classList.remove('hidden');
            
            // Check push subscription status
            await this.checkPushSubscriptionStatus();
            
            // Trigger sync check
            await this.checkAndSyncData();

            // Setup realtime subscription for cross-device updates
            this.setupRealtimeSubscription();
        } else {
            // Logged out
            if (this.authLoggedIn) this.authLoggedIn.classList.add('hidden');
            if (this.authLoggedOut) this.authLoggedOut.classList.remove('hidden');
            if (this.profileEmail) this.profileEmail.innerText = '';
            if (this.pushNotificationsCard) this.pushNotificationsCard.classList.add('hidden');

            // Unsubscribe from channels
            if (this.realtimeChannel) {
                this.supabase.removeChannel(this.realtimeChannel);
                this.realtimeChannel = null;
            }
        }
    }

    setLoading(isLoading, text = "") {
        if (isLoading) {
            if (this.authLoading) {
                this.authLoading.classList.remove('hidden');
                this.authLoading.querySelector('p').innerHTML = `
                    <i class="ph ph-circle-notch" style="animation: spin 1s linear infinite; font-size: 1.25rem;"></i> ${text}
                `;
            }
            this.authLoggedOut?.classList.add('hidden');
            this.authLoggedIn?.classList.add('hidden');
        } else {
            this.authLoading?.classList.add('hidden');
        }
    }

    // Gathers all 13 keys from localStorage to create the unified JSON
    gatherLocalData() {
        return {
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
            vehicle_maintenance_log: localStorage.getItem('vehicle_maintenance_log'),
            gym_records: localStorage.getItem('gym_records'),
            gym_routine: localStorage.getItem('gym_routine'),
            gym_routine_focus: localStorage.getItem('gym_routine_focus'),
            gym_sessions: localStorage.getItem('gym_sessions'),
            gym_meals: localStorage.getItem('gym_meals'),
            gym_supplements: localStorage.getItem('gym_supplements'),
            gym_weight: localStorage.getItem('gym_weight'),
            projectPulseData: localStorage.getItem('projectPulseData'),
            projectPulseHistory: localStorage.getItem('projectPulseHistory')
        };
    }

    areValuesEqual(val1, val2) {
        if (val1 === val2) return true;
        if (!val1 && !val2) return true; // both are null/undefined/empty
        if (!val1 || !val2) return false;
        
        try {
            const obj1 = JSON.parse(val1);
            const obj2 = JSON.parse(val2);
            return JSON.stringify(obj1) === JSON.stringify(obj2);
        } catch (e) {
            return String(val1).trim() === String(val2).trim();
        }
    }

    async checkAndSyncData() {
        if (!this.user) return;
        
        try {
            // 1. Read cloud data
            const { data, error } = await this.supabase
                .from('user_data')
                .select('data')
                .eq('user_id', this.user.id)
                .single();
                
            const cloudData = data?.data;
            const hasLocalData = this.hasAnyLocalData();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 means no row found
                console.error("Error fetching cloud data:", error);
                this.updateSyncBadge('error', "Error al obtener datos");
                return;
            }
            
            if (!cloudData) {
                // No data in cloud yet.
                if (hasLocalData) {
                    console.log("No data on cloud, uploading local data...");
                    await this.syncToCloud(false);
                } else {
                    await this.supabase.from('user_data').insert({
                        user_id: this.user.id,
                        data: {}
                    });
                    this.updateSyncBadge('synced', "Sincronizado");
                }
            } else {
                // Cloud data exists! Compare normalized differences
                const local = this.gatherLocalData();
                let hasDifference = false;
                Object.keys(local).forEach(key => {
                    const cloudVal = cloudData[key] === undefined ? null : cloudData[key];
                    const localVal = local[key] === undefined ? null : local[key];
                    if (!this.areValuesEqual(cloudVal, localVal)) {
                        hasDifference = true;
                    }
                });

                if (!hasDifference) {
                    this.updateSyncBadge('synced', "Sincronizado");
                    return;
                }

                // Check if this was an explicit login action
                const isExplicitLogin = sessionStorage.getItem('is_explicit_login') === 'true';
                sessionStorage.removeItem('is_explicit_login');

                if (isExplicitLogin && hasLocalData) {
                    const confirmMerge = confirm(
                        "¡Sesión iniciada! Se encontraron diferencias entre los datos en la nube y los locales. \n\n" +
                        "¿Deseas CARGAR los datos de la nube y sobreescribir los locales?\n" +
                        "(Acepta para usar los datos de la nube. Cancela si deseas mantener los locales y sobreescribir la nube)."
                    );
                    
                    if (confirmMerge) {
                        this.restoreDataLocally(cloudData);
                        alert("Datos de la nube restaurados localmente.");
                        location.reload();
                    } else {
                        // Push local data to overwrite cloud
                        await this.syncToCloud(false);
                    }
                } else {
                    // Pull silently in the background on normal loads (no reload loop!)
                    this.restoreDataLocally(cloudData);
                }
            }
        } catch (err) {
            console.error("Sync data error:", err);
            this.updateSyncBadge('error', "Error de conexión");
        }
    }

    hasAnyLocalData() {
        const local = this.gatherLocalData();
        return Object.values(local).some(v => v !== null && v !== undefined && v !== '');
    }

    async syncToCloud(isManual = false) {
        if (!this.user || !this.supabase) return;
        
        this.updateSyncBadge('syncing', "Sincronizando...");
        
        const localData = this.gatherLocalData();
        
        const { error } = await this.supabase
            .from('user_data')
            .upsert({
                user_id: this.user.id,
                data: localData,
                updated_at: new Date().toISOString()
            });
            
        if (error) {
            console.error("Sync to cloud error:", error);
            this.updateSyncBadge('error', "Error al guardar");
            if (isManual) alert("Error al sincronizar datos con la nube: " + error.message);
        } else {
            this.updateSyncBadge('synced', "Sincronizado");
            if (isManual) alert("¡Datos sincronizados correctamente con la nube!");
        }
    }

    restoreDataLocally(cloudData) {
        const localKeys = [
            'hygiene_tracker_data', 'groomingData_v2', 'lensesStartTime', 
            'lensesHistory', 'lensStock', 'lensDate', 'solutionDate', 
            'caseDate', 'systaneDate', 'clothWashDate', 'clothChangeDate', 
            'health_medical_data', 'health_blood_tests', 'vehicle_odometer', 
            'vehicle_maintenance_log', 'gym_records', 'gym_routine', 
            'gym_routine_focus', 'gym_sessions', 'gym_meals', 
            'gym_supplements', 'gym_weight', 'projectPulseData', 'projectPulseHistory'
        ];
        localKeys.forEach(key => {
            const val = cloudData[key];
            if (val !== null && val !== undefined) {
                localStorage.setItem(key, val);
            } else {
                localStorage.removeItem(key);
            }
        });

        // Trigger UI updates for all active modules dynamically
        try {
            if (this.app.hygiene) this.app.hygiene.render();
            if (this.app.grooming) this.app.grooming.render();
            if (this.app.lenses) {
                this.app.lenses.loadDatesAndStock();
                this.app.lenses.updateUI();
                this.app.lenses.renderHistory();
            }
            if (this.app.health) this.app.health.render();
            if (this.app.vehicle) this.app.vehicle.render();
            if (this.app.gym) this.app.gym.render();
            if (this.app.projects) this.app.projects.render();
        } catch (e) {
            console.error("Error refreshing module views during silent sync:", e);
        }
    }

    updateSyncBadge(state, text) {
        if (!this.syncStatusBadge) return;
        
        this.syncStatusBadge.className = 'badge';
        if (state === 'synced') {
            this.syncStatusBadge.classList.add('green');
            this.syncStatusBadge.innerHTML = `<i class="ph ph-cloud-check" style="font-size:1rem; margin-right:4px;"></i> ${text}`;
        } else if (state === 'syncing') {
            this.syncStatusBadge.classList.add('orange');
            this.syncStatusBadge.innerHTML = `<i class="ph ph-circle-notch" style="animation: spin 1s linear infinite; font-size:1rem; margin-right:4px;"></i> ${text}`;
        } else if (state === 'error') {
            this.syncStatusBadge.classList.add('red');
            this.syncStatusBadge.innerHTML = `<i class="ph ph-cloud-warning" style="font-size:1rem; margin-right:4px;"></i> ${text}`;
        }
    }

    // Upload helper for files
    async uploadFile(fileId, file) {
        if (!this.user || !this.supabase) {
            throw new Error("Usuario no autenticado");
        }
        
        const filePath = `${this.user.id}/${fileId}_${file.name}`;
        
        const { data, error } = await this.supabase.storage
            .from('blood-tests')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });
            
        if (error) {
            throw error;
        }
        
        // Get public URL
        const { data: { publicUrl } } = this.supabase.storage
            .from('blood-tests')
            .getPublicUrl(filePath);
            
        return publicUrl;
    }

    setupRealtimeSubscription() {
        if (!this.user || !this.supabase) return;
        
        // Remove existing channel if any
        if (this.realtimeChannel) {
            this.supabase.removeChannel(this.realtimeChannel);
        }
        
        this.realtimeChannel = this.supabase
            .channel(`user-data-channel-${this.user.id}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'user_data',
                filter: `user_id=eq.${this.user.id}`
            }, payload => {
                const newCloudData = payload.new?.data;
                if (newCloudData) {
                    const local = this.gatherLocalData();
                    let changed = false;
                    Object.keys(local).forEach(key => {
                        const cloudVal = newCloudData[key] === undefined ? null : newCloudData[key];
                        const localVal = local[key] === undefined ? null : local[key];
                        if (!this.areValuesEqual(cloudVal, localVal)) {
                            changed = true;
                        }
                    });
                    
                    if (changed) {
                        console.log("Realtime sync: differences detected, updating local state silently.");
                        this.restoreDataLocally(newCloudData);
                    }
                }
            })
            .subscribe();
    }

    async enablePushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('Las notificaciones push no son compatibles con este navegador o dispositivo.');
            return;
        }

        try {
            // 1. Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('Permiso de notificaciones denegado.');
                return;
            }

            // 2. Get Service Worker registration
            const registration = await navigator.serviceWorker.ready;

            // 3. Get VAPID public key from backend config
            const vapidKey = this.config.vapidPublicKey;
            if (!vapidKey) {
                alert('No se pudo obtener la clave VAPID pública desde el backend.');
                return;
            }

            // Convert VAPID key to Uint8Array
            const convertedVapidKey = this.urlBase64ToUint8Array(vapidKey);

            // 4. Subscribe to Push Manager
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // 5. Send subscription to Supabase directly (runs in user's authenticated context)
            const subscriptionJSON = subscription.toJSON();
            
            try {
                // Clean up old subscriptions for the same endpoint to avoid duplicates
                await this.supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', this.user.id)
                    .eq('subscription->>endpoint', subscriptionJSON.endpoint);
            } catch (err) {
                console.warn("Error cleaning up old subscription:", err);
            }

            const { error: dbError } = await this.supabase
                .from('push_subscriptions')
                .insert({
                    user_id: this.user.id,
                    subscription: subscriptionJSON
                });

            if (dbError) throw dbError;

            // 6. Update UI
            alert('¡Notificaciones activadas con éxito en este dispositivo!');
            await this.checkPushSubscriptionStatus();

        } catch (e) {
            console.error('Error enabling push notifications:', e);
            alert('Error al activar notificaciones: ' + e.message);
        }
    }

    async checkPushSubscriptionStatus() {
        if (!this.user) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            if (this.btnEnablePush) {
                this.btnEnablePush.disabled = true;
                this.btnEnablePush.innerText = 'Notificaciones No Compatibles';
            }
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                const subscriptionJSON = subscription.toJSON();
                // Sincronización silenciosa en segundo plano (Auto-Heal)
                (async () => {
                    try {
                        await this.supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('user_id', this.user.id)
                            .eq('subscription->>endpoint', subscriptionJSON.endpoint);
                            
                        await this.supabase
                            .from('push_subscriptions')
                            .insert({
                                user_id: this.user.id,
                                subscription: subscriptionJSON
                            });
                    } catch (err) {
                        console.warn("Silent subscription auto-heal sync failed:", err);
                    }
                })();

                if (this.btnEnablePush) {
                    this.btnEnablePush.innerText = '🔔 Notificaciones Activas en este Dispositivo';
                    this.btnEnablePush.style.borderColor = 'var(--status-green)';
                    this.btnEnablePush.style.color = 'var(--status-green)';
                }
                this.btnTestPush?.classList.remove('hidden');
            } else {
                if (this.btnEnablePush) {
                    this.btnEnablePush.innerText = '🔔 Activar Notificaciones en este Dispositivo';
                    this.btnEnablePush.style.borderColor = '';
                    this.btnEnablePush.style.color = '';
                }
                this.btnTestPush?.classList.add('hidden');
            }
        } catch (e) {
            console.error('Error checking push subscription status:', e);
        }
    }

    async sendTestPushNotification() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                alert('No se encontró una suscripción activa en este dispositivo.');
                return;
            }

            const res = await fetch('/api/test-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });

            if (res.ok) {
                alert('Notificación de prueba programada. Bloquea tu celular o quédate en espera; llegará en 5 segundos.');
            } else {
                alert('Error al programar la notificación de prueba.');
            }
        } catch (e) {
            console.error('Error triggering test push:', e);
            alert('Error al probar: ' + e.message);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}


// ==========================================================================
// CONTROLADOR CENTRAL: APP CONTROLLER
// ==========================================================================
class AppController {
    constructor() {
        window.lifecycle_controller = this;
        this.syncDebounceTimer = null;
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
            } else if (activeSectionId === 'gym-section') {
                this.gym.render();
            } else if (activeSectionId === 'projects-section') {
                this.projects.render();
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
        this.gym = new GymModule(this);
        this.projects = new ProjectsModule(this);
        this.backups = new BackupModule(this);
        this.auth = new AuthSyncModule(this);
        
        setInterval(() => {
            const activeSection = document.querySelector('.main-section:not(.hidden)');
            if (activeSection) {
                if (activeSection.id === 'higiene-section') this.hygiene.render();
                else if (activeSection.id === 'cuidado-section') this.grooming.render();
                else if (activeSection.id === 'lenses-section') this.lenses.loadDatesAndStock();
                else if (activeSection.id === 'salud-section') this.health.render();
                else if (activeSection.id === 'vehiculo-section') this.vehicle.render();
                else if (activeSection.id === 'gym-section') this.gym.render();
                else if (activeSection.id === 'projects-section') this.projects.render();
            }
        }, 1000 * 60 * 60);
    }

    triggerDataSync(key) {
        const trackedKeys = [
            'hygiene_tracker_data', 'groomingData_v2', 'lensesStartTime', 
            'lensesHistory', 'lensStock', 'lensDate', 'solutionDate', 
            'caseDate', 'systaneDate', 'clothWashDate', 'clothChangeDate', 
            'health_medical_data', 'health_blood_tests', 'vehicle_odometer', 
            'vehicle_maintenance_log', 'gym_records', 'gym_routine', 
            'gym_routine_focus', 'gym_sessions', 'gym_meals', 
            'gym_supplements', 'gym_weight', 'projectPulseData', 'projectPulseHistory'
        ];
        
        if (trackedKeys.includes(key) && this.auth && this.auth.user) {
            clearTimeout(this.syncDebounceTimer);
            this.syncDebounceTimer = setTimeout(() => {
                this.auth.syncToCloud();
            }, 1000);
        }
    }
}

// Intercept localStorage.setItem to trigger automatic background sync
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (window.lifecycle_controller) {
        window.lifecycle_controller.triggerDataSync(key);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const controller = new AppController();
    controller.start();
});
