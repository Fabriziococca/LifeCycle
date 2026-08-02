import { APP_MODULES } from '../custom-tracker-utils.mjs?v=20260801-adaptive-navigation';

const COLLAPSE_STORAGE_KEY = 'lifecycle_desktop_nav_collapsed';

export class AdaptiveNavigationModule {
    constructor(appController) {
        this.app = appController;
        this.nav = document.getElementById('main-nav');
        this.moduleButtons = new Map();
        this.moreButton = null;
        this.moreLayer = null;
        this.moreList = null;
        this.resizeFrame = null;
        if (!this.nav) return;

        this.enhanceNavigation();
        this.createMoreLayer();
        this.bindEvents();
        this.applyStoredCollapsePreference();
        this.refresh();
    }

    enhanceNavigation() {
        this.nav.querySelectorAll('.nav-btn[data-section]').forEach(button => {
            const moduleId = button.dataset.section;
            const module = APP_MODULES[moduleId];
            if (!module) return;
            const textNodes = [...button.childNodes]
                .filter(node => node.nodeType === Node.TEXT_NODE);
            const fallbackLabel = textNodes.map(node => node.textContent).join(' ').trim();
            textNodes.forEach(node => node.remove());
            let label = button.querySelector('.nav-label');
            if (!label) {
                label = document.createElement('span');
                label.className = 'nav-label';
                label.textContent = fallbackLabel || module.label;
                button.appendChild(label);
            }
            button.setAttribute('data-tooltip', module.label);
            this.moduleButtons.set(moduleId, button);
        });

        const shellHeader = document.createElement('div');
        shellHeader.className = 'adaptive-nav-header';
        shellHeader.innerHTML = `
            <span class="adaptive-nav-brand" aria-label="LifeCycle">
                <i class="ph-fill ph-activity" aria-hidden="true"></i>
                <span>LifeCycle</span>
            </span>
            <button
                type="button"
                class="adaptive-nav-collapse"
                aria-label="Contraer navegación"
                data-tooltip="Contraer navegación"
            ><i class="ph ph-sidebar-simple"></i></button>
        `;
        this.nav.prepend(shellHeader);
        this.collapseButton = shellHeader.querySelector('.adaptive-nav-collapse');

        this.moreButton = document.createElement('button');
        this.moreButton.type = 'button';
        this.moreButton.className = 'nav-btn adaptive-nav-more';
        this.moreButton.setAttribute('aria-haspopup', 'dialog');
        this.moreButton.setAttribute('aria-expanded', 'false');
        this.moreButton.setAttribute('data-tooltip', 'Más módulos y ajustes');
        this.moreButton.innerHTML = `
            <i class="ph ph-dots-three-circle" aria-hidden="true"></i>
            <span class="nav-label">Más</span>
        `;
        this.nav.appendChild(this.moreButton);
    }

    createMoreLayer() {
        this.moreLayer = document.createElement('div');
        this.moreLayer.id = 'adaptive-navigation-more';
        this.moreLayer.className = 'adaptive-navigation-layer hidden';
        this.moreLayer.setAttribute('role', 'dialog');
        this.moreLayer.setAttribute('aria-modal', 'true');
        this.moreLayer.setAttribute('aria-labelledby', 'adaptive-navigation-title');
        this.moreLayer.innerHTML = `
            <div class="adaptive-navigation-sheet">
                <header>
                    <div>
                        <span>MÓDULOS Y AJUSTES</span>
                        <h2 id="adaptive-navigation-title">Más en LifeCycle</h2>
                    </div>
                    <button type="button" class="icon-btn" data-adaptive-nav-action="close" aria-label="Cerrar menú" data-tooltip="Cerrar">
                        <i class="ph ph-x"></i>
                    </button>
                </header>
                <div class="adaptive-navigation-list" data-adaptive-navigation-list></div>
                <div class="adaptive-navigation-system-actions">
                    <button type="button" data-adaptive-nav-profile="cuenta">
                        <i class="ph ph-user"></i><span><strong>Mi cuenta</strong><small>Sesión y moneda</small></span>
                    </button>
                    <button type="button" data-adaptive-nav-profile="preferencias">
                        <i class="ph ph-sliders"></i><span><strong>Preferencias</strong><small>Atajos y comportamiento</small></span>
                    </button>
                </div>
            </div>
        `;
        this.moreList = this.moreLayer.querySelector('[data-adaptive-navigation-list]');
        document.body.appendChild(this.moreLayer);
    }

    bindEvents() {
        this.moreButton?.addEventListener('click', event => {
            event.stopPropagation();
            this.openMore();
        });
        this.collapseButton?.addEventListener('click', event => {
            event.stopPropagation();
            this.toggleCollapsed();
        });
        this.moreLayer?.addEventListener('click', event => {
            if (event.target === this.moreLayer || event.target.closest('[data-adaptive-nav-action="close"]')) {
                this.closeMore();
                return;
            }
            const moduleButton = event.target.closest('[data-adaptive-nav-module]');
            if (moduleButton) {
                this.closeMore({ restoreFocus: false });
                this.app.activateSection?.(moduleButton.dataset.adaptiveNavModule, {
                    render: true,
                    smooth: true
                });
                return;
            }
            const profileButton = event.target.closest('[data-adaptive-nav-profile]');
            if (profileButton) {
                this.closeMore({ restoreFocus: false });
                this.app.openProfileTab?.(profileButton.dataset.adaptiveNavProfile);
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !this.moreLayer?.classList.contains('hidden')) {
                event.preventDefault();
                this.closeMore();
            }
        });
        window.addEventListener('resize', () => {
            if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
            this.resizeFrame = requestAnimationFrame(() => {
                this.resizeFrame = null;
                this.refresh();
            });
        }, { passive: true });
    }

    getVisibleModuleIds() {
        return Object.keys(APP_MODULES).filter(moduleId => (
            this.app.customTrackers?.isModuleVisible?.(moduleId) !== false
        ));
    }

    getMobileFavoriteIds(visibleModuleIds) {
        const requested = this.app.customTrackers?.getFavoriteModuleIds?.() || [];
        const visible = new Set(visibleModuleIds);
        const favorites = requested.filter(moduleId => visible.has(moduleId));
        for (const moduleId of visibleModuleIds) {
            if (favorites.length >= 4) break;
            if (!favorites.includes(moduleId)) favorites.push(moduleId);
        }
        return favorites.slice(0, 4);
    }

    refresh() {
        const visibleModuleIds = this.getVisibleModuleIds();
        const favorites = this.getMobileFavoriteIds(visibleModuleIds);
        const favoriteSet = new Set(favorites);
        this.moduleButtons.forEach((button, moduleId) => {
            button.classList.toggle('is-mobile-favorite', favoriteSet.has(moduleId));
        });
        this.renderMoreList(visibleModuleIds.filter(moduleId => !favoriteSet.has(moduleId)));
        document.body.dataset.navigationMode = window.innerWidth < 768
            ? 'mobile'
            : (window.innerWidth < 1100 ? 'tablet' : 'desktop');
        this.updateActiveState(this.app.lastActiveSectionId);
        if (window.innerWidth >= 768) this.closeMore({ restoreFocus: false });
    }

    renderMoreList(moduleIds) {
        if (!this.moreList) return;
        this.moreList.innerHTML = '';
        moduleIds.forEach(moduleId => {
            const module = APP_MODULES[moduleId];
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.adaptiveNavModule = moduleId;
            button.innerHTML = `
                <i class="ph ${module.icon}" aria-hidden="true"></i>
                <span>${module.label}</span>
                <i class="ph ph-arrow-right" aria-hidden="true"></i>
            `;
            this.moreList.appendChild(button);
        });
        if (moduleIds.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'adaptive-navigation-empty';
            empty.textContent = 'Todos los módulos visibles ya están en tu barra.';
            this.moreList.appendChild(empty);
        }
    }

    updateActiveState(sectionId) {
        if (!this.moreButton) return;
        const activeButton = this.moduleButtons.get(sectionId);
        const activeIsFavorite = activeButton?.classList.contains('is-mobile-favorite');
        this.moreButton.classList.toggle('active', Boolean(sectionId && !activeIsFavorite));
    }

    openMore() {
        if (!this.moreLayer) return;
        this.app.tooltips?.hide?.();
        this.moreLayer.classList.remove('hidden');
        document.body.classList.add('adaptive-navigation-open');
        this.moreButton?.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => {
            this.moreLayer.querySelector('button')?.focus();
        });
    }

    closeMore({ restoreFocus = true } = {}) {
        if (!this.moreLayer || this.moreLayer.classList.contains('hidden')) return;
        this.moreLayer.classList.add('hidden');
        document.body.classList.remove('adaptive-navigation-open');
        this.moreButton?.setAttribute('aria-expanded', 'false');
        if (restoreFocus) requestAnimationFrame(() => this.moreButton?.focus());
    }

    applyStoredCollapsePreference() {
        const collapsed = localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
        document.body.classList.toggle('adaptive-nav-collapsed', collapsed);
        this.updateCollapseButton(collapsed);
    }

    toggleCollapsed() {
        const collapsed = !document.body.classList.contains('adaptive-nav-collapsed');
        document.body.classList.toggle('adaptive-nav-collapsed', collapsed);
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
        this.updateCollapseButton(collapsed);
    }

    updateCollapseButton(collapsed) {
        if (!this.collapseButton) return;
        const label = collapsed ? 'Expandir navegación' : 'Contraer navegación';
        this.collapseButton.setAttribute('aria-label', label);
        this.collapseButton.setAttribute('data-tooltip', label);
        this.collapseButton.setAttribute('aria-pressed', String(collapsed));
    }
}
