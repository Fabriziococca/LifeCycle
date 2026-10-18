// Presentation only: no timers that poll the cloud, business state or animation
// gates. System reduced motion always wins over the local preference.
export const MOTION_STORAGE_KEY = 'lifecycle_motion_preference';

export class VisualFeedback {
    constructor(app, { documentRef = document, storage = localStorage,
        media = window.matchMedia('(prefers-reduced-motion: reduce)') } = {}) {
        this.app = app;
        this.document = documentRef;
        this.storage = storage;
        this.media = media;
        this.confirmations = new Map();
        try { this.preference = storage.getItem(MOTION_STORAGE_KEY) === 'reduced' ? 'reduced' : 'system'; }
        catch { this.preference = 'system'; }
        this.apply();
        media.addEventListener?.('change', () => this.apply());
        this.document.getElementById('motion-preference')?.addEventListener('change', event => {
            this.preference = event.target.value === 'reduced' ? 'reduced' : 'system';
            try { storage.setItem(MOTION_STORAGE_KEY, this.preference); } catch { /* Session only. */ }
            this.apply();
        });
    }

    get reduced() { return this.media.matches || this.preference === 'reduced'; }

    apply() {
        this.document.documentElement.dataset.motion = this.reduced ? 'reduced' : 'normal';
        const select = this.document.getElementById('motion-preference');
        if (select) select.value = this.preference;
        if (this.reduced) this.document.getAnimations?.().forEach(animation => {
            try { animation.effect?.getTiming().iterations === Infinity ? animation.cancel() : animation.finish(); }
            catch { animation.cancel(); }
        });
    }

    connect(selector) {
        const element = this.document.querySelector(selector);
        if (this.reduced || this.document.hidden || !element?.getClientRects().length) return;
        element.animate?.([{ transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: 240, easing: 'ease-out' });
    }

    saved(selector) {
        const until = Date.now() + 1400;
        this.confirmations.set(selector, { until, owner: this.app.auth?.readyUserId });
        const painted = this.paintSaved(selector, true);
        setTimeout(() => {
            if (this.confirmations.get(selector)?.until !== until) return;
            this.confirmations.delete(selector);
            this.document.querySelector(selector)?.querySelector('.save-confirmation')?.remove();
        }, 1400);
        return painted;
    }

    restore() {
        for (const [selector, entry] of this.confirmations) {
            if (Date.now() >= entry.until || entry.owner !== this.app.auth?.readyUserId) {
                this.confirmations.delete(selector);
            } else if (!this.document.querySelector(selector)?.querySelector('.save-confirmation')) {
                this.paintSaved(selector, false);
            }
        }
    }

    paintSaved(selector, animate) {
        const element = this.document.querySelector(selector);
        if (!element || this.document.hidden || !element.getClientRects().length) return false;
        element.querySelector('.save-confirmation')?.remove();
        const badge = this.document.createElement('span');
        badge.className = 'save-confirmation';
        badge.setAttribute('aria-hidden', 'true'); // The existing toast announces the result.
        badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4 10-10"/></svg>Guardado';
        (element.querySelector('[data-save-feedback]') || element).append(badge);
        if (animate && !this.reduced) {
            badge.animate?.([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180 });
            const path = badge.querySelector('path');
            path.style.strokeDasharray = '28';
            path.animate?.([{ strokeDashoffset: 28 }, { strokeDashoffset: 0 }], { duration: 260, easing: 'ease-out' });
        }
        return true;
    }

    async afterSync(selectors) {
        const auth = this.app.auth, owner = auth?.readyUserId, generation = auth?.syncGeneration;
        if (!owner || !auth?.flushPendingKeySync) return false;
        try {
            if (!await auth.flushPendingKeySync()) return false;
            if (owner !== auth.readyUserId || generation !== auth.syncGeneration) return false;
            selectors.forEach(selector => this.saved(selector));
            return true;
        } catch { return false; } // Sync already owns errors/retry. Never paint an unconfirmed success.
    }
}
