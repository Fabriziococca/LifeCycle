export const THEME_STORAGE_KEY = 'lifecycle_theme_preference';
export const SUPPORTED_THEMES = Object.freeze(['dark', 'light']);

export function normalizeTheme(value) {
    return SUPPORTED_THEMES.includes(value) ? value : 'dark';
}

export class ThemeModule {
    constructor(app, {
        documentRef = document,
        storage = localStorage
    } = {}) {
        this.app = app;
        this.document = documentRef;
        this.storage = storage;
        this.theme = this.readPreference();
        this.apply(this.theme, { persist: false, announce: false });
        this.bindEvents();
    }

    readPreference() {
        try {
            return normalizeTheme(this.storage.getItem(THEME_STORAGE_KEY));
        } catch (_error) {
            return 'dark';
        }
    }

    bindEvents() {
        this.document.querySelectorAll('[data-theme-choice]').forEach((button) => {
            button.addEventListener('click', () => {
                this.apply(button.dataset.themeChoice, { persist: true, announce: true });
            });
        });
    }

    apply(nextTheme, { persist = true, announce = false } = {}) {
        const theme = normalizeTheme(nextTheme);
        this.theme = theme;
        this.document.documentElement.dataset.theme = theme;
        this.document.documentElement.style.colorScheme = theme;
        this.document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content',
            theme === 'light' ? '#f1f5f9' : '#0f172a'
        );

        if (persist) {
            try {
                this.storage.setItem(THEME_STORAGE_KEY, theme);
            } catch (_error) {
                // El tema igual se aplica durante la sesión aunque el navegador bloquee storage.
            }
        }

        this.document.querySelectorAll('[data-theme-choice]').forEach((button) => {
            const active = button.dataset.themeChoice === theme;
            button.setAttribute('aria-pressed', String(active));
            button.classList.toggle('is-active', active);
        });

        this.document.dispatchEvent(new CustomEvent('lifecycle:themechange', {
            detail: { theme }
        }));

        if (announce) {
            this.app?.showToast?.(`Tema ${theme === 'light' ? 'claro' : 'oscuro'} activado.`);
        }
    }
}
