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
import { CustomTrackersModule } from './modules/CustomTrackersModule.js';
import { CLOUD_SYNC_KEYS } from './sync-config.mjs?v=20260727-cloud-first';
import {
    readUiState,
    writeUiState
} from './ui-state.mjs?v=20260728-ui-state';
import {
    combineLocalDateWithTime,
    getLocalISODate,
    parseDateLocal
} from './utils.js';
import { TooltipController } from './tooltip-controller.mjs?v=20260729-tooltips';

class AppController {
    constructor() {
        window.lifecycle_controller = this;
        this.currentEditType = null;
        this.currentEditId = null;
        this.toastTimer = null;
        this.navigationHintRefreshers = [];
        this.navigationHintObservers = [];
        this.tooltips = new TooltipController(document);
        this.tooltips.init();

        this.modal = document.getElementById('edit-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalDesc = document.getElementById('modal-desc');
        this.modalDate = document.getElementById('modal-date');
        this.modalCancel = document.getElementById('modal-cancel');
        this.modalSave = document.getElementById('modal-save');
        
        this.uiState = readUiState(localStorage);
        this.lastActiveSectionId = this.uiState.section;
        
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
        const cachedRate = this.getValidCachedLemonRate();

        // Una cotización reciente evita llamadas innecesarias sin inventar valores.
        if (cachedRate !== null) {
            if (rateInfo) {
                rateInfo.style.display = 'block';
                rateInfo.innerHTML = `Cotización Lemon Cash USDT (Venta): <strong>$${cachedRate.toLocaleString('es-AR')} ARS</strong>`;
            }
            return cachedRate;
        }

        try {
            const res = await fetch('https://criptoya.com/api/lemoncash/usdt/ars/1');
            if (!res.ok) {
                throw new Error(`CriptoYa respondió HTTP ${res.status}`);
            }

            const data = await res.json();
            const rate = Number(data.bid);
            if (!Number.isFinite(rate) || rate <= 0) {
                throw new Error('CriptoYa devolvió una cotización inválida');
            }

            localStorage.setItem('lemon_usdt_ars_rate', rate.toString());
            localStorage.setItem('lemon_usdt_ars_time', Date.now().toString());
            if (rateInfo) {
                rateInfo.style.display = 'block';
                rateInfo.innerHTML = `Cotización Lemon Cash USDT (Venta): <strong>$${rate.toLocaleString('es-AR')} ARS</strong>`;
            }
            return rate;
        } catch (e) {
            console.error("Error fetching Lemon rate from CriptoYa:", e);
        }

        if (rateInfo) {
            rateInfo.style.display = 'block';
            rateInfo.textContent = 'Cotización no disponible. No se realizará una conversión estimada.';
        }
        return null;
    }

    getValidCachedLemonRate() {
        const rate = Number(localStorage.getItem('lemon_usdt_ars_rate'));
        const timestamp = Number(localStorage.getItem('lemon_usdt_ars_time'));
        const age = Date.now() - timestamp;
        const maxAge = 1000 * 60 * 30;

        if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(timestamp) || timestamp <= 0) {
            return null;
        }

        if (age < 0 || age >= maxAge) {
            return null;
        }

        return rate;
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
            return this.getValidCachedLemonRate();
        }
        return 1;
    }

    formatCurrency(amountUsd) {
        const curr = localStorage.getItem('preferred_currency') || 'USD';
        const num = Number(amountUsd || 0);
        if (curr === 'ARS') {
            const rate = this.getCurrencyMultiplier();
            if (rate === null) {
                return `USD ${num.toFixed(2)} (ARS sin cotización)`;
            }
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
            this.activateSection(btn.dataset.section);
        });
        this.initScrollableNavigationHint(
            mainNav,
            document.getElementById('main-nav-scroll-hint'),
            'lifecycle_main_nav_hint_seen'
        );
    }

    saveUiState(patch) {
        this.uiState = writeUiState(localStorage, this.uiState, patch);
        return this.uiState;
    }

    showToast(message, { tone = 'success', duration = 3200 } = {}) {
        let toast = document.getElementById('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.className = 'app-toast hidden';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.innerHTML = '<i aria-hidden="true"></i><span></span>';
            document.body.appendChild(toast);
        }

        const toneConfig = {
            success: { icon: 'ph-check-circle', label: 'Correcto' },
            warning: { icon: 'ph-warning-circle', label: 'Atención' },
            error: { icon: 'ph-x-circle', label: 'Error' }
        };
        const config = toneConfig[tone] || toneConfig.success;
        const icon = toast.querySelector('i');
        const text = toast.querySelector('span');
        if (icon) icon.className = `ph ${config.icon}`;
        if (text) text.textContent = String(message ?? '');
        toast.setAttribute('aria-label', `${config.label}: ${String(message ?? '')}`);
        toast.dataset.tone = toneConfig[tone] ? tone : 'success';

        clearTimeout(this.toastTimer);
        toast.classList.remove('hidden');
        this.toastTimer = setTimeout(() => {
            toast.classList.add('hidden');
        }, Math.max(1200, Number(duration) || 3200));
    }

    initScrollableNavigationHint(container, hint, storageKey) {
        if (!container || !hint) return;

        const update = () => {
            const isMobile = window.matchMedia('(max-width: 767px)').matches;
            const hasOverflow = container.scrollWidth > container.clientWidth + 4;
            const wasSeen = localStorage.getItem(storageKey) === '1';
            container.classList.toggle('has-horizontal-overflow', isMobile && hasOverflow);
            hint.classList.toggle('hidden', !isMobile || !hasOverflow || wasSeen);
        };
        const acknowledge = () => {
            if (Math.abs(container.scrollLeft) < 6) return;
            localStorage.setItem(storageKey, '1');
            hint.classList.add('hidden');
        };

        container.addEventListener('scroll', acknowledge, { passive: true });
        window.addEventListener('resize', update, { passive: true });
        if ('ResizeObserver' in window) {
            const observer = new ResizeObserver(update);
            observer.observe(container);
            this.navigationHintObservers.push(observer);
        }
        this.navigationHintRefreshers.push(update);
        requestAnimationFrame(update);
    }

    refreshNavigationHints() {
        this.navigationHintRefreshers.forEach(refresh => refresh());
    }

    scrollControlIntoView(container, control, smooth = false) {
        if (!container || !control || container.scrollWidth <= container.clientWidth) return;

        const targetLeft = control.offsetLeft
            - ((container.clientWidth - control.offsetWidth) / 2);
        const left = Math.max(0, targetLeft);
        if (typeof container.scrollTo === 'function') {
            container.scrollTo({
                left,
                behavior: smooth ? 'smooth' : 'auto'
            });
        } else {
            container.scrollLeft = left;
        }
    }

    renderSection(sectionId) {
        if (sectionId === 'cuidado-section') {
            this.grooming?.render();
        } else if (sectionId === 'lenses-section') {
            this.lenses?.updateUI();
            this.lenses?.loadDatesAndStock();
            this.lenses?.renderHistory();
        } else if (sectionId === 'higiene-section') {
            this.hygiene?.render();
        } else if (sectionId === 'salud-section') {
            this.health?.render();
        } else if (sectionId === 'vehiculo-section') {
            this.vehicle?.render();
        } else if (sectionId === 'gym-section') {
            this.gym?.render();
        } else if (sectionId === 'projects-section') {
            this.projects?.render();
        } else if (sectionId === 'finanzas-section') {
            this.finanzas?.render();
        } else if (sectionId === 'tareas-section') {
            this.tareas?.render();
        }
    }

    activateSection(sectionId, { persist = true, render = true, smooth = false } = {}) {
        const mainNav = document.getElementById('main-nav');
        const reorderContext = this.customTrackers?.reorderContext;
        const activeReorderSection = document.querySelector(
            '.main-section.is-custom-reordering'
        );
        if (
            reorderContext?.scope === 'runtime'
            && activeReorderSection
            && activeReorderSection.id !== sectionId
        ) {
            this.customTrackers.cancelReorderMode({ silent: true });
        }
        if (
            this.customTrackers
            && !this.customTrackers.isModuleVisible(sectionId)
        ) {
            return false;
        }
        const targetButton = mainNav?.querySelector(`.nav-btn[data-section="${sectionId}"]`);
        const targetSection = document.getElementById(sectionId);
        if (!targetButton || !targetSection) return false;

        mainNav.querySelectorAll('.nav-btn').forEach(button => {
            button.classList.toggle('active', button === targetButton);
        });
        document.querySelectorAll('.main-section').forEach(section => {
            section.classList.toggle('hidden', section.id !== sectionId);
        });

        this.lastActiveSectionId = sectionId;
        if (persist) this.saveUiState({ section: sectionId });
        this.scrollControlIntoView(mainNav, targetButton, smooth);
        if (render) this.renderSection(sectionId);
        return true;
    }

    initProfileTabs() {
        const sidebar = document.querySelector('.profile-sidebar');
        if (!sidebar) return;
        
        sidebar.addEventListener('click', (e) => {
            const btn = e.target.closest('.profile-menu-item');
            if (!btn) return;
            this.activateProfileTab(btn.dataset.tab, { smooth: true });
        });
        this.initScrollableNavigationHint(
            sidebar,
            document.getElementById('profile-nav-scroll-hint'),
            'lifecycle_profile_nav_hint_seen'
        );
    }

    activateProfileTab(tabId, { persist = true, render = true, smooth = false } = {}) {
        const sidebar = document.querySelector('.profile-sidebar');
        if (
            this.customTrackers?.reorderContext?.scope === 'manager'
            && tabId !== 'seguimientos'
        ) {
            this.customTrackers.cancelReorderMode({ silent: true });
        }
        const targetButton = sidebar?.querySelector(`.profile-menu-item[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(`tab-${tabId}`);
        if (!targetButton || !targetContent) return false;

        sidebar.querySelectorAll('.profile-menu-item').forEach(button => {
            button.classList.toggle('active', button === targetButton);
        });
        document.querySelectorAll('.profile-tab-content').forEach(content => {
            content.classList.toggle('hidden', content !== targetContent);
        });

        if (persist) this.saveUiState({ profileTab: tabId });
        this.scrollControlIntoView(sidebar, targetButton, smooth);
        if (render && tabId === 'alertas') this.alerts?.render();
        if (render && tabId === 'seguimientos') this.customTrackers?.renderManager();
        if (render && tabId === 'modulos') this.customTrackers?.renderModulesManager();
        return true;
    }

    restoreUiState() {
        const targetSection = this.customTrackers?.isModuleVisible(this.uiState.section)
            ? this.uiState.section
            : this.customTrackers?.getFirstVisibleModuleId();
        this.activateSection(targetSection, {
            persist: false,
            render: true
        });
        this.activateProfileTab(this.uiState.profileTab, {
            persist: false,
            render: false
        });
    }

    initProfileOverlay() {
        const profileBtn = document.getElementById('profile-btn');
        const backBtn = document.getElementById('btn-back-to-modules');
        const mainNav = document.getElementById('main-nav');

        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                if (this.customTrackers?.reorderContext?.scope === 'runtime') {
                    this.customTrackers.cancelReorderMode({ silent: true });
                }
                if (mainNav) mainNav.classList.add('hidden');
                document.querySelectorAll('.main-section').forEach(sec => {
                    sec.classList.add('hidden');
                });
                const profileSec = document.getElementById('perfil-section');
                if (profileSec) {
                    profileSec.classList.remove('hidden');
                    this.activateProfileTab(this.uiState.profileTab, {
                        persist: false,
                        render: true
                    });
                    requestAnimationFrame(() => this.refreshNavigationHints());
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.customTrackers?.reorderContext?.scope === 'manager') {
                    this.customTrackers.cancelReorderMode({ silent: true });
                }
                if (mainNav) mainNav.classList.remove('hidden');
                const profileSec = document.getElementById('perfil-section');
                if (profileSec) profileSec.classList.add('hidden');
                
                const targetSecId = (
                    this.lastActiveSectionId
                    && this.customTrackers?.isModuleVisible(this.lastActiveSectionId)
                )
                    ? this.lastActiveSectionId
                    : this.customTrackers?.getFirstVisibleModuleId();
                this.activateSection(targetSecId, {
                    persist: false,
                    render: true
                });
                requestAnimationFrame(() => this.refreshNavigationHints());
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
            if (type === 'hygiene') {
                this.modalDesc.innerText = '¿Cuándo realizaste la última acción de lavado o limpieza?';
            } else if (type === 'customTracker') {
                this.modalDesc.innerText = '¿Cuándo realizaste esta acción por última vez?';
            } else {
                this.modalDesc.innerText = '¿Cuándo registraste este hábito corporal por última vez?';
            }
        }

        if (this.modalDate) {
            const dateToSet = parseDateLocal(currentDateVal) || new Date();
            this.modalDate.value = getLocalISODate(dateToSet);
            this.modalDate.max = getLocalISODate();
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

        const now = new Date();
        const selectedDateText = this.modalDate.value;
        if (selectedDateText > getLocalISODate(now)) {
            alert('La fecha de la última acción no puede estar en el futuro.');
            return;
        }

        const selectedDate = combineLocalDateWithTime(selectedDateText, now);
        if (!selectedDate) {
            alert('La fecha seleccionada no es válida.');
            return;
        }

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
            const dateStr = selectedDateText;
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
            const dateStr = selectedDateText;
            localStorage.setItem(key, dateStr);
            this.lenses.loadDatesAndStock();
            this.lenses.updateUI();
            this.auth?.syncToCloud(false).catch(() => {});
        } else if (this.currentEditType === 'customTracker') {
            this.customTrackers?.updateLatestDate(this.currentEditId, selectedDate);
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
        this.customTrackers = new CustomTrackersModule(this);
        this.backups = new BackupModule(this);
        this.auth = new AuthSyncModule(this);
        this.alerts = new AlertsModule(this);
        this.notificationsCenter = new NotificationsCenterModule(this);
        this.restoreUiState();
        requestAnimationFrame(() => this.refreshNavigationHints());
        
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
        if (CLOUD_SYNC_KEYS.includes(key) && this.auth?.user) {
            this.auth.queueKeySync(key);
        }
    }
}

// Intercept localStorage.setItem to trigger automatic background sync
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;
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

localStorage.removeItem = function(key) {
    const existed = localStorage.getItem(key) !== null;
    originalRemoveItem.apply(this, arguments);
    if (window.lifecycle_controller?.auth?.isRestoring) {
        return;
    }
    if (existed && window.lifecycle_controller) {
        window.lifecycle_controller.triggerDataSync(key);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const controller = new AppController();
    controller.start();
});
