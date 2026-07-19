import { HygieneModule } from './modules/HygieneModule.js';
import { GroomingModule } from './modules/GroomingModule.js';
import { LensModule } from './modules/LensModule.js';
import { HealthModule } from './modules/HealthModule.js';
import { VehicleModule } from './modules/VehicleModule.js';
import { GymModule } from './modules/GymModule.js';
import { ProjectsModule } from './modules/ProjectsModule.js';
import { BackupModule } from './modules/BackupModule.js';
import { AuthSyncModule } from './modules/AuthSyncModule.js';
import { FinanzasModule } from './modules/FinanzasModule.js';
import { TareasModule } from './modules/TareasModule.js';
import { AlertsModule } from './modules/AlertsModule.js';
import { NotificationsCenterModule } from './modules/NotificationsCenterModule.js';

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
        
        this.lastActiveSectionId = 'higiene-section';
        
        this.initNavigation();
        this.initModalListeners();
        this.deferredPrompt = null;
        this.initPWAInstall();
        this.initProfileTabs();
        this.initProfileOverlay();
        this.initCurrencyPreference();
    }

    initCurrencyPreference() {
        const btnUsd = document.getElementById('btn-currency-usd');
        const btnArs = document.getElementById('btn-currency-ars');
        const rateInfo = document.getElementById('currency-rate-info');

        const activeCurrency = localStorage.getItem('preferred_currency') || 'USD';
        this.updateCurrencyUI(activeCurrency);

        btnUsd?.addEventListener('click', () => {
            localStorage.setItem('preferred_currency', 'USD');
            this.updateCurrencyUI('USD');
            this.refreshFinancialViews();
        });

        btnArs?.addEventListener('click', async () => {
            localStorage.setItem('preferred_currency', 'ARS');
            this.updateCurrencyUI('ARS');
            await this.fetchLemonRate();
            this.refreshFinancialViews();
        });

        if (activeCurrency === 'ARS') {
            this.fetchLemonRate().then(() => this.refreshFinancialViews());
        }
    }

    async fetchLemonRate() {
        const rateInfo = document.getElementById('currency-rate-info');
        const cachedRate = localStorage.getItem('lemon_usdt_ars_rate');
        const cachedTime = localStorage.getItem('lemon_usdt_ars_time');
        const now = Date.now();

        // Si tenemos caché de menos de 30 min, usamos esa
        if (cachedRate && cachedTime && (now - parseInt(cachedTime)) < 1000 * 60 * 30) {
            if (rateInfo) {
                rateInfo.style.display = 'block';
                rateInfo.innerHTML = `Cotización Lemon Cash USDT (Venta): <strong>$${parseFloat(cachedRate).toLocaleString('es-AR')} ARS</strong>`;
            }
            return parseFloat(cachedRate);
        }

        try {
            const res = await fetch('https://criptoya.com/api/lemoncash/usdt/ars/1');
            if (res.ok) {
                const data = await res.json();
                const rate = data.bid || 1530; // bid es el precio de venta recibido al vender USDT
                localStorage.setItem('lemon_usdt_ars_rate', rate.toString());
                localStorage.setItem('lemon_usdt_ars_time', now.toString());
                if (rateInfo) {
                    rateInfo.style.display = 'block';
                    rateInfo.innerHTML = `Cotización Lemon Cash USDT (Venta): <strong>$${rate.toLocaleString('es-AR')} ARS</strong>`;
                }
                return rate;
            }
        } catch (e) {
            console.error("Error fetching Lemon rate from CriptoYa:", e);
        }

        const fallback = parseFloat(cachedRate) || 1530;
        if (rateInfo) {
            rateInfo.style.display = 'block';
            rateInfo.innerHTML = `Cotización Estimada Lemon Cash: <strong>$${fallback.toLocaleString('es-AR')} ARS</strong>`;
        }
        return fallback;
    }

    updateCurrencyUI(curr) {
        const btnUsd = document.getElementById('btn-currency-usd');
        const btnArs = document.getElementById('btn-currency-ars');
        const rateInfo = document.getElementById('currency-rate-info');

        if (curr === 'ARS') {
            btnUsd?.classList.replace('btn-primary', 'btn-secondary');
            btnArs?.classList.replace('btn-secondary', 'btn-primary');
            if (rateInfo) rateInfo.style.display = 'block';
        } else {
            btnArs?.classList.replace('btn-primary', 'btn-secondary');
            btnUsd?.classList.replace('btn-secondary', 'btn-primary');
            if (rateInfo) rateInfo.style.display = 'none';
        }
    }

    getCurrencyMultiplier() {
        const curr = localStorage.getItem('preferred_currency') || 'USD';
        if (curr === 'ARS') {
            return parseFloat(localStorage.getItem('lemon_usdt_ars_rate')) || 1530;
        }
        return 1;
    }

    formatCurrency(amountUsd) {
        const curr = localStorage.getItem('preferred_currency') || 'USD';
        const num = Number(amountUsd || 0);
        if (curr === 'ARS') {
            const rate = this.getCurrencyMultiplier();
            const totalArs = num * rate;
            return `ARS $${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        return `USD ${num.toFixed(2)}`;
    }

    refreshFinancialViews() {
        if (this.finanzas) this.finanzas.render();
        if (this.projects) this.projects.render();
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
            this.lastActiveSectionId = activeSectionId;
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
            } else if (activeSectionId === 'finanzas-section') {
                this.finanzas.render();
            } else if (activeSectionId === 'tareas-section') {
                this.tareas.render();
            }
        });
    }

    initProfileTabs() {
        const sidebar = document.querySelector('.profile-sidebar');
        if (!sidebar) return;
        
        sidebar.addEventListener('click', (e) => {
            const btn = e.target.closest('.profile-menu-item');
            if (!btn) return;
            
            sidebar.querySelectorAll('.profile-menu-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetTab = btn.dataset.tab;
            document.querySelectorAll('.profile-tab-content').forEach(content => {
                content.classList.toggle('hidden', content.id !== `tab-${targetTab}`);
            });
            if (targetTab === 'alertas') {
                this.alerts.render();
            }
        });
    }

    initProfileOverlay() {
        const profileBtn = document.getElementById('profile-btn');
        const backBtn = document.getElementById('btn-back-to-modules');
        const mainNav = document.getElementById('main-nav');

        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                if (mainNav) mainNav.classList.add('hidden');
                document.querySelectorAll('.main-section').forEach(sec => {
                    sec.classList.add('hidden');
                });
                const profileSec = document.getElementById('perfil-section');
                if (profileSec) {
                    profileSec.classList.remove('hidden');
                    const activeMenu = document.querySelector('.profile-sidebar .profile-menu-item.active');
                    const targetTab = activeMenu ? activeMenu.dataset.tab : 'cuenta';
                    if (targetTab === 'alertas') {
                        this.alerts.render();
                    }
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (mainNav) mainNav.classList.remove('hidden');
                const profileSec = document.getElementById('perfil-section');
                if (profileSec) profileSec.classList.add('hidden');
                
                const targetSecId = this.lastActiveSectionId || 'higiene-section';
                const targetSec = document.getElementById(targetSecId);
                if (targetSec) targetSec.classList.remove('hidden');
                
                if (targetSecId === 'cuidado-section') this.grooming.render();
                else if (targetSecId === 'lenses-section') {
                    this.lenses.updateUI();
                    this.lenses.loadDatesAndStock();
                    this.lenses.renderHistory();
                } else if (targetSecId === 'higiene-section') this.hygiene.render();
                else if (targetSecId === 'salud-section') this.health.render();
                else if (targetSecId === 'vehiculo-section') this.vehicle.render();
                else if (targetSecId === 'gym-section') this.gym.render();
                else if (targetSecId === 'projects-section') this.projects.render();
                else if (targetSecId === 'finanzas-section') this.finanzas.render();
            });
        }
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
        } else if (this.currentEditType === 'lenses') {
            const key = this.currentEditId;
            const dateStr = isoString.split('T')[0];
            localStorage.setItem(key, dateStr);
            this.lenses.loadDatesAndStock();
            this.lenses.updateUI();
            this.auth?.syncToCloud(false).catch(() => {});
        }

        this.notificationsCenter?.updateBadge();
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
        this.finanzas = new FinanzasModule(this);
        this.tareas = new TareasModule(this);
        this.backups = new BackupModule(this);
        this.auth = new AuthSyncModule(this);
        this.alerts = new AlertsModule(this);
        this.notificationsCenter = new NotificationsCenterModule(this);
        
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
                else if (activeSection.id === 'finanzas-section') this.finanzas.render();
                else if (activeSection.id === 'tareas-section') this.tareas.render();
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
            'gym_routine_focus', 'gym_sessions', 'gym_meals', 'gym_general_meals', 
            'gym_supplements', 'gym_weight', 'projectPulseData', 'projectPulseHistory',
            'projectPulseSubscription', 'alerts_config', 'alerts_sent_log', 'finanzasData',
            'vehicle_tracker_data', 'vehicle_issues', 'tareas_list', 'tareas_categories'
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
    const oldValue = localStorage.getItem(key);
    originalSetItem.apply(this, arguments);
    if (window.lifecycle_controller && window.lifecycle_controller.auth && window.lifecycle_controller.auth.isRestoring) {
        return;
    }
    if (oldValue !== value && window.lifecycle_controller) {
        window.lifecycle_controller.triggerDataSync(key);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const controller = new AppController();
    controller.start();
});
