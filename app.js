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

const STORAGE_KEY = 'hygiene_tracker_data';

class HygieneTracker {
    constructor() {
        this.currentCategory = 'todos';
        this.data = this.loadData();
        this.container = document.getElementById('tracker-container');
        this.template = document.getElementById('card-template');
        this.init();
    }

    loadData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        let parsedData = {};
        if (stored) {
            try {
                parsedData = JSON.parse(stored);
            } catch (e) {
                parsedData = {};
            }
        }
        // Initialize or merge missing config keys (handles newly added items like cepillo_dientes)
        itemsConfig.forEach(item => {
            if (parsedData[item.id] === undefined) {
                parsedData[item.id] = null; // null means never washed / just started
            }
        });
        return parsedData;
    }

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    getDaysElapsed(dateString) {
        if (!dateString) return null;
        const lastWashed = new Date(dateString);
        lastWashed.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(today - lastWashed);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays;
    }

    getStatusClass(daysElapsed, limits) {
        if (daysElapsed === null) return 'status-green'; // New item
        
        if (daysElapsed >= limits.red) return 'status-red';
        if (daysElapsed >= limits.orange) return 'status-orange';
        if (daysElapsed >= limits.yellow) return 'status-yellow';
        
        return 'status-green';
    }

    getStatusText(statusClass, type = 'wash') {
        if (type === 'change') {
            switch (statusClass) {
                case 'status-green': return 'OK';
                case 'status-yellow': return 'Atención';
                case 'status-orange': return 'Cambiar Pronto';
                case 'status-red': return '¡Cámbialo ya!';
                default: return 'OK';
            }
        } else if (type === 'clean') {
            switch (statusClass) {
                case 'status-green': return 'OK';
                case 'status-yellow': return 'Atención';
                case 'status-orange': return 'Limpiar Pronto';
                case 'status-red': return 'Limpieza Urgente';
                default: return 'OK';
            }
        } else if (type === 'brush') {
            switch (statusClass) {
                case 'status-green': return 'OK';
                case 'status-yellow': return 'Atención';
                case 'status-orange': return 'Cepillar Pronto';
                case 'status-red': return 'Cepillado Urgente';
                default: return 'OK';
            }
        } else {
            switch (statusClass) {
                case 'status-green': return 'OK';
                case 'status-yellow': return 'Atención';
                case 'status-orange': return 'Lavar Pronto';
                case 'status-red': return 'Lavado Urgente';
                default: return 'OK';
            }
        }
    }

    formatDate(dateInput) {
        if (!dateInput) return 'Nunca (Nuevo)';
        
        const date = new Date(dateInput);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dateCompare = new Date(date);
        dateCompare.setHours(0, 0, 0, 0);
        
        if (dateCompare.getTime() === today.getTime()) {
            return 'Hoy';
        }
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateCompare.getTime() === yesterday.getTime()) {
            return 'Ayer';
        }

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (dateCompare.getTime() === tomorrow.getTime()) {
            return 'Mañana';
        }

        const currentYear = today.getFullYear();
        const targetYear = dateCompare.getFullYear();
        const displayOptions = targetYear !== currentYear 
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
        const percentage = (daysElapsed / maxLimit) * 100;
        return `${percentage}%`;
    }

    washItem(id) {
        this.data[id] = new Date().toISOString();
        this.saveData();
        this.render(); // Re-render to update UI
    }

    render() {
        this.container.innerHTML = ''; // Clear container

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
            
            // Set basic info
            cardEl.className = `card ${statusClass}`;
            clone.querySelector('.card-icon').className = `ph ${item.icon}`;
            clone.querySelector('.card-title').textContent = item.name;
            clone.querySelector('.status-text').textContent = statusText;
            
            // Set time info
            clone.querySelector('.days-count').textContent = daysElapsed === null ? '0' : daysElapsed;
            
            // Set dynamic labels depending on type
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
            
            // Next Date calculation
            if (lastDateVal) {
                const nextDateVal = this.getNextDate(lastDateVal, item.limits.red);
                clone.querySelector('.next-date').textContent = this.formatDate(nextDateVal);
            } else {
                clone.querySelector('.next-date').textContent = 'N/A';
            }
            
            // Progress bar
            const progressBar = clone.querySelector('.progress-bar');
            progressBar.style.width = this.getProgressWidth(daysElapsed, item.limits.red);

            // Setup instructions collapsible
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
                    if (isOpen) {
                        instructionsCollapse.classList.remove('open');
                        infoBtn.classList.remove('active');
                    } else {
                        instructionsCollapse.classList.add('open');
                        infoBtn.classList.add('active');
                    }
                });
            } else {
                infoBtn.style.display = 'none';
                instructionsCollapse.style.display = 'none';
            }

            // Button Action and Wording
            const actionBtn = clone.querySelector('.btn-wash');
            let btnText = 'Registrar Lavado';
            let btnIcon = 'ph-waves';
            if (type === 'change') {
                btnText = 'Registrar Cambio';
                btnIcon = 'ph-arrows-clockwise';
            } else if (type === 'clean') {
                btnText = 'Registrar Limpieza';
                btnIcon = 'ph-sparkle';
            } else if (type === 'brush') {
                btnText = 'Registrar Cepillado';
                btnIcon = 'ph-paint-brush';
            }
            
            actionBtn.querySelector('span').textContent = btnText;
            actionBtn.querySelector('i').className = `ph-bold ${btnIcon}`;
            
            actionBtn.addEventListener('click', () => {
                this.washItem(item.id);
            });

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
        // Check for midnight updates
        setInterval(() => this.render(), 1000 * 60 * 60); // Check every hour
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new HygieneTracker();
});
