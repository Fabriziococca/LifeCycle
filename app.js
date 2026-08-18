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
import { TradingModule } from './modules/TradingModule.js';
import { TareasModule } from './modules/TareasModule.js';
import { AlertsModule } from './modules/AlertsModule.js';
import { NotificationsCenterModule } from './modules/NotificationsCenterModule.js';
import { CustomTrackersModule } from './modules/CustomTrackersModule.js';
import { TodayModule } from './modules/TodayModule.js';
import { GlobalSearchModule } from './modules/GlobalSearchModule.js';
import { KeyboardShortcutsModule } from './modules/KeyboardShortcutsModule.js';
import { AdaptiveNavigationModule } from './modules/AdaptiveNavigationModule.js';
import { ThemeModule } from './modules/ThemeModule.js';
import { CLOUD_SYNC_KEYS } from './sync-config.mjs?v=20260729-project-templates';
import {
    readUiState,
    writeUiState
} from './ui-state.mjs?v=20260730-deep-context';
import {
    combineLocalDateWithTime,
    getLocalISODate,
    parseDateLocal
} from './utils.js';
import { TooltipController } from './tooltip-controller.mjs?v=20260729-tooltips';
import { FeedbackController } from './feedback-controller.mjs?v=20260730-feedback';
import {
    EXCHANGE_RATE_PROVIDERS,
    getExchangeRateRetryDelay,
    parseExchangeRate,
    readCachedExchangeRate,
    writeCachedExchangeRate
} from './exchange-rate-utils.mjs?v=20260811-resilient-rates';

const FINANCIAL_AMOUNTS_HIDDEN_KEY = 'lifecycle_financial_amounts_hidden';

class AppController {
    constructor() {
        window.lifecycle_controller = this;
        this.currentEditType = null;
        this.currentEditId = null;
        this.toastTimer = null;
        this.navigationHintRefreshers = [];
        this.navigationHintObservers = [];
        this.financialAmountsHidden = localStorage.getItem(FINANCIAL_AMOUNTS_HIDDEN_KEY) === '1';
        this.tooltips = new TooltipController(document);
        this.tooltips.init();
        this.feedback = new FeedbackController(document);
        this.feedback.init();
        this.currencyRateRequest = null;
        this.currencyRateRetryTimer = null;
        this.currencyRateRetryAttempt = 0;

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
        this.initFinancialPrivacyControls();
    }

    initCurrencyPreference() {
        const btnUsd = document.getElementById('btn-currency-usd');
        const btnArs = document.getElementById('btn-currency-ars');

        const activeCurrency = localStorage.getItem('preferred_currency') || 'USD';
        this.updateCurrencyUI(activeCurrency);

        btnUsd?.addEventListener('click', () => {
            localStorage.setItem('preferred_currency', 'USD');
            this.clearCurrencyRateRetry();
            this.updateCurrencyUI('USD');
            this.refreshFinancialViews();
        });

        btnArs?.addEventListener('click', () => {
            localStorage.setItem('preferred_currency', 'ARS');
            this.updateCurrencyUI('ARS');
            this.refreshFinancialViews();
            void this.fetchLemonRate({ force: true });
        });

        if (activeCurrency === 'ARS') {
            const cached = this.getCachedExchangeRate();
            this.renderCurrencyRateInfo(cached, {
                status: cached?.isFresh ? 'ready' : 'refreshing'
            });
            void this.fetchLemonRate();
        }

        window.addEventListener('online', () => {
            if ((localStorage.getItem('preferred_currency') || 'USD') === 'ARS') {
                void this.fetchLemonRate({ force: true });
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (
                document.visibilityState === 'visible'
                && (localStorage.getItem('preferred_currency') || 'USD') === 'ARS'
                && !this.getCachedExchangeRate()?.isFresh
            ) {
                void this.fetchLemonRate({ force: true });
            }
        });
    }

    getCachedExchangeRate() {
        return readCachedExchangeRate(localStorage);
    }

    getValidCachedLemonRate() {
        return this.getCachedExchangeRate()?.rate ?? null;
    }

    async fetchExchangeRateProvider(provider) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8_000);
        try {
            const response = await fetch(provider.url, {
                signal: controller.signal,
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`${provider.label} respondió HTTP ${response.status}`);
            }
            return parseExchangeRate(provider.key, await response.json());
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async fetchLemonRate({ force = false } = {}) {
        const cached = this.getCachedExchangeRate();
        if (cached?.isFresh && !force) {
            this.renderCurrencyRateInfo(cached, { status: 'ready' });
            return cached.rate;
        }
        if (this.currencyRateRequest) return this.currencyRateRequest;
        if (cached) this.renderCurrencyRateInfo(cached, { status: 'refreshing' });

        this.currencyRateRequest = (async () => {
            const failures = [];
            for (const provider of EXCHANGE_RATE_PROVIDERS) {
                try {
                    const rate = await this.fetchExchangeRateProvider(provider);
                    const timestamp = Date.now();
                    writeCachedExchangeRate(localStorage, {
                        rate,
                        source: provider.key,
                        timestamp
                    });
                    this.clearCurrencyRateRetry();
                    const fresh = this.getCachedExchangeRate();
                    this.renderCurrencyRateInfo(fresh, { status: 'ready' });
                    if ((localStorage.getItem('preferred_currency') || 'USD') === 'ARS') {
                        this.refreshFinancialViews();
                    }
                    return rate;
                } catch (error) {
                    failures.push(`${provider.key}: ${error.message}`);
                }
            }

            console.warn('No se pudo actualizar la cotización USD/ARS.', failures.join(' | '));
            const stale = this.getCachedExchangeRate();
            this.renderCurrencyRateInfo(stale, { status: 'retrying' });
            this.scheduleCurrencyRateRetry();
            return stale?.rate ?? null;
        })();

        try {
            return await this.currencyRateRequest;
        } finally {
            this.currencyRateRequest = null;
        }
    }

    scheduleCurrencyRateRetry() {
        if (
            this.currencyRateRetryTimer
            || (localStorage.getItem('preferred_currency') || 'USD') !== 'ARS'
        ) return;
        const delay = getExchangeRateRetryDelay(this.currencyRateRetryAttempt);
        this.currencyRateRetryAttempt += 1;
        this.currencyRateRetryTimer = setTimeout(() => {
            this.currencyRateRetryTimer = null;
            void this.fetchLemonRate({ force: true });
        }, delay);
    }

    clearCurrencyRateRetry() {
        if (this.currencyRateRetryTimer) clearTimeout(this.currencyRateRetryTimer);
        this.currencyRateRetryTimer = null;
        this.currencyRateRetryAttempt = 0;
    }

    renderCurrencyRateInfo(cache, { status = 'ready' } = {}) {
        const rateInfo = document.getElementById('currency-rate-info');
        if (!rateInfo) return;
        const isArsSelected = (localStorage.getItem('preferred_currency') || 'USD') === 'ARS';
        rateInfo.style.display = isArsSelected ? 'block' : 'none';
        rateInfo.replaceChildren();

        if (!cache) {
            rateInfo.textContent = 'Cotización temporalmente no disponible. Reintentando en segundo plano; mientras tanto se muestran USD.';
            return;
        }

        const provider = EXCHANGE_RATE_PROVIDERS.find(item => item.key === cache.source);
        const prefix = status === 'ready'
            ? 'Cotización de referencia'
            : 'Última cotización disponible';
        rateInfo.append(`${prefix} (${provider?.label || 'guardada'}): `);
        const strong = document.createElement('strong');
        strong.textContent = `$${cache.rate.toLocaleString('es-AR')} ARS`;
        rateInfo.appendChild(strong);
        if (status === 'refreshing') rateInfo.append(' · Actualizando…');
        if (status === 'retrying') rateInfo.append(' · Reintentando en segundo plano');
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
                return `USD ${num.toFixed(2)}`;
            }
            const totalArs = num * rate;
            return `ARS $${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        return `USD ${num.toFixed(2)}`;
    }

    isFinancialAmountsHidden() {
        return this.financialAmountsHidden === true;
    }

    formatFinancialAmount(amountUsd) {
        return this.isFinancialAmountsHidden()
            ? '••••••'
            : this.formatCurrency(amountUsd);
    }

    initFinancialPrivacyControls() {
        document.querySelectorAll('[data-financial-privacy-toggle]').forEach(button => {
            if (button.dataset.financialPrivacyBound === 'true') return;
            button.dataset.financialPrivacyBound = 'true';
            button.addEventListener('click', () => {
                this.setFinancialAmountsHidden(!this.isFinancialAmountsHidden());
            });
        });
        this.updateFinancialPrivacyControls();
    }

    setFinancialAmountsHidden(hidden) {
        this.financialAmountsHidden = Boolean(hidden);
        localStorage.setItem(
            FINANCIAL_AMOUNTS_HIDDEN_KEY,
            this.financialAmountsHidden ? '1' : '0'
        );
        this.updateFinancialPrivacyControls();
        this.refreshFinancialViews();
    }

    updateFinancialPrivacyControls() {
        const hidden = this.isFinancialAmountsHidden();
        const actionLabel = hidden ? 'Mostrar montos' : 'Ocultar montos';
        document.querySelectorAll('[data-financial-privacy-toggle]').forEach(button => {
            button.setAttribute('aria-pressed', String(hidden));
            button.setAttribute('aria-label', `${actionLabel} de Proyectos y Finanzas`);
            button.dataset.tooltip = actionLabel;
            const icon = button.querySelector('i');
            const label = button.querySelector('[data-financial-privacy-label]');
            if (icon) icon.className = `ph ${hidden ? 'ph-eye' : 'ph-eye-slash'}`;
            if (label) label.textContent = actionLabel;
        });
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
            if (!btn?.dataset.section) return;
            this.activateSection(btn.dataset.section);
        });
        this.initScrollableNavigationHint(
            mainNav,
            document.getElementById('main-nav-scroll-hint'),
            'lifecycle_main_nav_hint_seen'
        );
    }

    updateAppHeaderFromButton(button, { fallbackTitle = 'LifeCycle' } = {}) {
        const title = button?.querySelector('.nav-label, span')?.textContent?.trim()
            || fallbackTitle;
        const sourceIcon = button?.querySelector('i');
        const titleElement = document.getElementById('app-context-title');
        const iconElement = document.getElementById('app-context-icon');

        if (titleElement) titleElement.textContent = title;
        if (iconElement) {
            iconElement.className = sourceIcon?.className || 'ph ph-squares-four';
        }
    }

    saveUiState(patch) {
        this.uiState = writeUiState(localStorage, this.uiState, patch);
        return this.uiState;
    }

    showToast(message, {
        tone = 'success',
        duration = 3200,
        actionLabel = '',
        onAction = null
    } = {}) {
        let toast = document.getElementById('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.className = 'app-toast hidden';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.innerHTML = `
                <i aria-hidden="true"></i>
                <span></span>
                <button type="button" class="app-toast-action hidden"></button>
            `;
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
        const actionButton = toast.querySelector('.app-toast-action');
        if (icon) icon.className = `ph ${config.icon}`;
        if (text) text.textContent = String(message ?? '');
        toast.setAttribute('aria-label', `${config.label}: ${String(message ?? '')}`);
        toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
        toast.dataset.tone = toneConfig[tone] ? tone : 'success';

        clearTimeout(this.toastTimer);
        if (actionButton) {
            actionButton.onclick = null;
            const hasAction = typeof onAction === 'function' && String(actionLabel || '').trim();
            actionButton.classList.toggle('hidden', !hasAction);
            actionButton.textContent = hasAction ? String(actionLabel).trim() : '';
            if (hasAction) {
                let handled = false;
                actionButton.onclick = () => {
                    if (handled) return;
                    handled = true;
                    clearTimeout(this.toastTimer);
                    toast.classList.add('hidden');
                    Promise.resolve(onAction()).catch(error => {
                        console.error('No se pudo deshacer la acción:', error);
                        this.showToast(
                            'No se pudo deshacer la acción.',
                            { tone: 'error' }
                        );
                    });
                };
            }
        }
        toast.classList.remove('hidden');
        this.toastTimer = setTimeout(() => {
            toast.classList.add('hidden');
            if (actionButton) actionButton.onclick = null;
        }, Math.max(1200, Number(duration) || 3200));
    }

    showMessage(message, options = {}) {
        const source = typeof message === 'object'
            ? message
            : { ...options, message };
        return this.feedback.message(source);
    }

    confirmAction(message, options = {}) {
        const source = typeof message === 'object'
            ? message
            : { ...options, message };
        return this.feedback.confirm(source);
    }

    showUndo(message, onUndo, { duration = 7000, tone = 'warning' } = {}) {
        this.showToast(message, {
            tone,
            duration,
            actionLabel: 'Deshacer',
            onAction: onUndo
        });
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
        if (sectionId === 'hoy-section') {
            this.today?.render();
        } else if (sectionId === 'cuidado-section') {
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
        } else if (sectionId === 'trading-section') {
            this.trading?.activate();
        } else if (sectionId === 'tareas-section') {
            this.tareas?.render();
        } else {
            const customModule = this.customTrackers?.getCustomModuleBySectionId?.(sectionId);
            if (customModule && !customModule.archived) {
                this.customTrackers.renderSection(customModule.id);
            }
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
            this.customTrackers?.bulkContext
            && document.querySelector('.main-section.is-custom-bulk')?.id !== sectionId
        ) {
            this.customTrackers.cancelBulkMode({ silent: true });
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

        mainNav.classList.remove('hidden');
        document.body.classList.remove('profile-view-active');
        mainNav.querySelectorAll('.nav-btn').forEach(button => {
            button.classList.toggle('active', button === targetButton);
        });
        document.querySelectorAll('.main-section').forEach(section => {
            section.classList.toggle('hidden', section.id !== sectionId);
        });

        this.lastActiveSectionId = sectionId;
        if (persist) this.saveUiState({ section: sectionId });
        this.updateAppHeaderFromButton(targetButton, { fallbackTitle: 'Inicio' });
        this.adaptiveNavigation?.updateActiveState?.(sectionId);
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
        document.querySelector('.profile-main-content')?.addEventListener('click', event => {
            const link = event.target.closest('[data-profile-tab-link]');
            if (!link) return;
            this.activateProfileTab(link.dataset.profileTabLink, { smooth: true });
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
        this.updateAppHeaderFromButton(targetButton, { fallbackTitle: 'Perfil' });
        this.scrollControlIntoView(sidebar, targetButton, smooth);
        if (render && tabId === 'alertas') this.alerts?.render();
        if (render && tabId === 'seguimientos') this.customTrackers?.renderManager();
        if (render && tabId === 'modulos') this.customTrackers?.renderModulesManager();
        if (render && tabId === 'notificaciones') {
            this.auth?.refreshPushManagement?.().catch(error => {
                console.error('[Push] No se pudo actualizar el panel:', error);
            });
        }
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
                this.openProfileTab(this.uiState.profileTab, { persist: false });
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

    openProfileTab(tabId = this.uiState.profileTab, { persist = true } = {}) {
        this.adaptiveNavigation?.closeMore?.({ restoreFocus: false });
        if (this.customTrackers?.reorderContext?.scope === 'runtime') {
            this.customTrackers.cancelReorderMode({ silent: true });
        }
        if (this.customTrackers?.bulkContext) {
            this.customTrackers.cancelBulkMode({ silent: true });
        }
        document.getElementById('main-nav')?.classList.add('hidden');
        document.body.classList.add('profile-view-active');
        document.querySelectorAll('.main-section').forEach(section => {
            section.classList.add('hidden');
        });
        const profileSection = document.getElementById('perfil-section');
        if (!profileSection) return false;

        profileSection.classList.remove('hidden');
        this.activateProfileTab(tabId, {
            persist,
            render: true
        });
        requestAnimationFrame(() => this.refreshNavigationHints());
        return true;
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
            void this.showMessage({
                title: 'Fecha futura',
                message: 'La fecha de la última acción no puede estar en el futuro.',
                tone: 'warning'
            });
            return;
        }

        const selectedDate = combineLocalDateWithTime(selectedDateText, now);
        if (!selectedDate) {
            void this.showMessage({
                title: 'Fecha inválida',
                message: 'Revisá la fecha seleccionada e intentá nuevamente.',
                tone: 'danger'
            });
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
        this.theme = new ThemeModule(this);
        this.hygiene = new HygieneModule(this);
        this.grooming = new GroomingModule(this);
        this.lenses = new LensModule(this);
        this.health = new HealthModule(this);
        this.vehicle = new VehicleModule(this);
        this.gym = new GymModule(this);
        this.projects = new ProjectsModule(this);
        this.finanzas = new FinanzasModule(this);
        this.trading = new TradingModule(this);
        this.tareas = new TareasModule(this);
        this.customTrackers = new CustomTrackersModule(this);
        this.backups = new BackupModule(this);
        this.auth = new AuthSyncModule(this);
        this.alerts = new AlertsModule(this);
        this.notificationsCenter = new NotificationsCenterModule(this);
        this.today = new TodayModule(this);
        this.globalSearch = new GlobalSearchModule(this);
        this.keyboardShortcuts = new KeyboardShortcutsModule(this);
        this.adaptiveNavigation = new AdaptiveNavigationModule(this);
        this.restoreUiState();
        requestAnimationFrame(() => this.refreshNavigationHints());
        
        setInterval(() => {
            const activeSection = document.querySelector('.main-section:not(.hidden)');
            if (activeSection) {
                if (activeSection.id === 'hoy-section') this.today.render();
                else if (activeSection.id === 'higiene-section') this.hygiene.render();
                else if (activeSection.id === 'cuidado-section') this.grooming.render();
                else if (activeSection.id === 'lenses-section') this.lenses.loadDatesAndStock();
                else if (activeSection.id === 'salud-section') this.health.render();
                else if (activeSection.id === 'vehiculo-section') this.vehicle.render();
                else if (activeSection.id === 'gym-section') this.gym.render();
                else if (activeSection.id === 'projects-section') this.projects.render();
                else if (activeSection.id === 'finanzas-section') this.finanzas.render();
                else if (activeSection.id === 'trading-section') this.trading.render();
                else if (activeSection.id === 'tareas-section') this.tareas.render();
                else {
                    const customModule = this.customTrackers?.getCustomModuleBySectionId?.(
                        activeSection.id
                    );
                    if (customModule && !customModule.archived) {
                        this.customTrackers.renderSection(customModule.id);
                    }
                }
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
