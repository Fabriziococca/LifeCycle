const itemsConfig = [
    {
        id: 'esponja_africana',
        name: 'Esponja Africana',
        icon: 'ph-sparkle',
        limits: { yellow: 11, orange: 15, red: 30 },
        type: 'wash'
    },
    {
        id: 'toalla_mano',
        name: 'Toalla de Mano',
        icon: 'ph-hand-palm',
        limits: { yellow: 2, orange: 3, red: 4 },
        type: 'wash'
    },
    {
        id: 'toalla_cuerpo',
        name: 'Toalla de Cuerpo',
        icon: 'ph-drop',
        limits: { yellow: 5, orange: 7, red: 8 },
        type: 'wash'
    },
    {
        id: 'sabanas',
        name: 'Sábanas (Completas)',
        icon: 'ph-bed',
        limits: { yellow: 5, orange: 7, red: 8 },
        type: 'wash'
    },
    {
        id: 'funda_almohada',
        name: 'Funda de Almohada',
        icon: 'ph-moon',
        limits: { yellow: 2, orange: 3, red: 4 },
        type: 'wash'
    },
    {
        id: 'cepillo_dientes',
        name: 'Cepillo de Dientes',
        icon: 'ph-tooth',
        limits: { yellow: 75, orange: 85, red: 90 },
        type: 'change'
    }
];

const STORAGE_KEY = 'hygiene_tracker_data';

class HygieneTracker {
    constructor() {
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

        itemsConfig.forEach(item => {
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
            const lastDateLabel = type === 'change' ? 'Último cambio' : 'Último lavado';
            const nextDateLabel = type === 'change' ? 'Próximo cambio' : 'Próximo lavado';
            
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

            // Button Action and Wording
            const actionBtn = clone.querySelector('.btn-wash');
            const btnText = type === 'change' ? 'Registrar Cambio' : 'Registrar Lavado';
            const btnIcon = type === 'change' ? 'ph-arrows-clockwise' : 'ph-waves';
            
            actionBtn.querySelector('span').textContent = btnText;
            actionBtn.querySelector('i').className = `ph-bold ${btnIcon}`;
            
            actionBtn.addEventListener('click', () => {
                this.washItem(item.id);
            });

            this.container.appendChild(clone);
        });
    }

    init() {
        this.render();
        // Check for midnight updates
        setInterval(() => this.render(), 1000 * 60 * 60); // Check every hour
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new HygieneTracker();
});
