const VALID_TONES = new Set(['info', 'success', 'warning', 'danger']);

const TONE_DEFAULTS = Object.freeze({
    info: Object.freeze({
        title: 'Información',
        icon: 'ph-info'
    }),
    success: Object.freeze({
        title: 'Listo',
        icon: 'ph-check-circle'
    }),
    warning: Object.freeze({
        title: 'Atención',
        icon: 'ph-warning-circle'
    }),
    danger: Object.freeze({
        title: 'No se pudo completar',
        icon: 'ph-warning-octagon'
    })
});

function normalizeText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function normalizeDetails(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => ({
            label: normalizeText(item?.label),
            value: normalizeText(item?.value)
        }))
        .filter(item => item.label && item.value);
}

export function normalizeFeedbackOptions(value, {
    mode = 'message'
} = {}) {
    const source = typeof value === 'string'
        ? { message: value }
        : (value && typeof value === 'object' ? value : {});
    const tone = VALID_TONES.has(source.tone)
        ? source.tone
        : (mode === 'confirm' ? 'warning' : 'info');
    const defaults = TONE_DEFAULTS[tone];

    return {
        mode,
        tone,
        title: normalizeText(source.title, defaults.title),
        message: normalizeText(source.message),
        details: normalizeDetails(source.details),
        confirmLabel: normalizeText(
            source.confirmLabel,
            mode === 'confirm' ? 'Confirmar' : 'Entendido'
        ),
        cancelLabel: normalizeText(source.cancelLabel, 'Cancelar'),
        showCancel: mode === 'confirm',
        icon: normalizeText(source.icon, defaults.icon),
        closeOnBackdrop: source.closeOnBackdrop !== false
    };
}

export class FeedbackController {
    constructor(rootDocument = document) {
        this.document = rootDocument;
        this.dialog = null;
        this.title = null;
        this.message = null;
        this.details = null;
        this.icon = null;
        this.confirmButton = null;
        this.cancelButton = null;
        this.pendingResolver = null;
        this.returnFocus = null;
        this.queue = Promise.resolve();
        this.boundKeydown = event => this.handleKeydown(event);
    }

    init() {
        if (this.dialog) return;

        const dialog = this.document.createElement('div');
        dialog.id = 'app-feedback-dialog';
        dialog.className = 'app-feedback-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'app-feedback-dialog-title');
        dialog.setAttribute('aria-describedby', 'app-feedback-dialog-message');
        dialog.innerHTML = `
            <div class="app-feedback-panel" data-feedback-panel>
                <div class="app-feedback-icon" data-feedback-icon aria-hidden="true">
                    <i class="ph ph-info"></i>
                </div>
                <div class="app-feedback-copy">
                    <h2 id="app-feedback-dialog-title"></h2>
                    <p id="app-feedback-dialog-message"></p>
                    <dl class="app-feedback-details hidden" data-feedback-details></dl>
                </div>
                <div class="app-feedback-actions">
                    <button type="button" class="btn btn-secondary" data-feedback-cancel>
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-primary" data-feedback-confirm>
                        Entendido
                    </button>
                </div>
            </div>
        `;
        this.document.body.appendChild(dialog);

        this.dialog = dialog;
        this.title = dialog.querySelector('#app-feedback-dialog-title');
        this.message = dialog.querySelector('#app-feedback-dialog-message');
        this.details = dialog.querySelector('[data-feedback-details]');
        this.icon = dialog.querySelector('[data-feedback-icon] i');
        this.confirmButton = dialog.querySelector('[data-feedback-confirm]');
        this.cancelButton = dialog.querySelector('[data-feedback-cancel]');

        this.confirmButton.addEventListener('click', () => this.resolve(true));
        this.cancelButton.addEventListener('click', () => this.resolve(false));
        dialog.addEventListener('click', event => {
            if (
                event.target === dialog
                && dialog.dataset.closeOnBackdrop === 'true'
            ) {
                this.resolve(false);
            }
        });
        dialog.addEventListener('keydown', this.boundKeydown);
    }

    message(options) {
        return this.enqueue(normalizeFeedbackOptions(options, { mode: 'message' }));
    }

    confirm(options) {
        return this.enqueue(normalizeFeedbackOptions(options, { mode: 'confirm' }));
    }

    enqueue(config) {
        const run = () => this.present(config);
        const result = this.queue.then(run, run);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    present(config) {
        this.init();
        this.returnFocus = this.document.activeElement;
        this.dialog.dataset.tone = config.tone;
        this.dialog.dataset.mode = config.mode;
        this.dialog.dataset.closeOnBackdrop = String(config.closeOnBackdrop);
        this.title.textContent = config.title;
        this.message.textContent = config.message;
        this.details.replaceChildren(...config.details.map(detail => {
            const row = this.document.createElement('div');
            const term = this.document.createElement('dt');
            const description = this.document.createElement('dd');
            term.textContent = detail.label;
            description.textContent = detail.value;
            row.append(term, description);
            return row;
        }));
        this.details.classList.toggle('hidden', config.details.length === 0);
        this.icon.className = `ph ${config.icon}`;
        this.confirmButton.textContent = config.confirmLabel;
        this.cancelButton.textContent = config.cancelLabel;
        this.cancelButton.classList.toggle('hidden', !config.showCancel);
        this.confirmButton.classList.toggle(
            'app-feedback-danger-button',
            config.tone === 'danger'
        );
        this.dialog.classList.remove('hidden');
        this.document.body.classList.add('feedback-dialog-open');

        return new Promise(resolve => {
            this.pendingResolver = resolve;
            requestAnimationFrame(() => {
                const initialFocus = config.tone === 'danger' && config.showCancel
                    ? this.cancelButton
                    : this.confirmButton;
                initialFocus?.focus();
            });
        });
    }

    resolve(value) {
        if (!this.pendingResolver) return;
        const resolver = this.pendingResolver;
        const returnFocus = this.returnFocus;
        this.pendingResolver = null;
        this.returnFocus = null;
        this.dialog.classList.add('hidden');
        this.document.body.classList.remove('feedback-dialog-open');
        resolver(Boolean(value));
        setTimeout(() => returnFocus?.focus?.(), 0);
    }

    handleKeydown(event) {
        if (!this.dialog || this.dialog.classList.contains('hidden')) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            this.resolve(false);
            return;
        }

        if (event.key !== 'Tab') return;
        const focusable = [this.cancelButton, this.confirmButton]
            .filter(button => button && !button.classList.contains('hidden'));
        if (focusable.length < 2) {
            event.preventDefault();
            focusable[0]?.focus();
            return;
        }

        const currentIndex = focusable.indexOf(this.document.activeElement);
        if (event.shiftKey && currentIndex <= 0) {
            event.preventDefault();
            focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
            event.preventDefault();
            focusable[0].focus();
        }
    }
}
