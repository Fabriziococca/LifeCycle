import {
    applyStarterPack,
    getStarterPresets,
    planStarterPackApplication
} from '../starter-pack-utils.mjs';
import { RESOURCE_KEYS } from '../resource-policy.mjs?v=20260829-feature-limits';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

export class StarterPackModule {
    constructor(appController) {
        this.app = appController;
        this.trigger = document.getElementById('btn-open-starter-pack');
        this.status = document.getElementById('starter-pack-status');
        this.dialog = null;
        this.returnFocus = null;
        this.busy = false;
        this.ensureDialog();
        this.bindEvents();
        this.renderStatus();
    }

    ensureDialog() {
        document.getElementById('starter-pack-dialog')?.remove();
        const dialog = document.createElement('div');
        dialog.id = 'starter-pack-dialog';
        dialog.className = 'starter-pack-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'starter-pack-dialog-title');
        dialog.innerHTML = `
            <div class="starter-pack-dialog-card">
                <header class="starter-pack-dialog-header">
                    <div>
                        <span class="starter-pack-eyebrow">CONFIGURACIÓN OPCIONAL</span>
                        <h2 id="starter-pack-dialog-title">Elegí tus tarjetas iniciales</h2>
                        <p>Vas a incorporar solamente las opciones marcadas. Los historiales quedan vacíos y las notificaciones empiezan desactivadas.</p>
                    </div>
                    <button type="button" class="custom-dialog-close" data-starter-action="close" aria-label="Cerrar configuración inicial" data-tooltip="Cerrar">
                        <i class="ph ph-x"></i>
                    </button>
                </header>
                <div class="starter-pack-toolbar">
                    <button type="button" class="btn btn-secondary" data-starter-action="select-all">Seleccionar todo</button>
                    <button type="button" class="btn btn-secondary" data-starter-action="clear">Limpiar</button>
                    <span id="starter-pack-selection-count" aria-live="polite"></span>
                </div>
                <div id="starter-pack-options" class="starter-pack-options"></div>
                <p id="starter-pack-dialog-error" class="starter-pack-error hidden" role="alert"></p>
                <footer class="starter-pack-dialog-actions">
                    <button type="button" class="btn btn-secondary" data-starter-action="close">Cancelar</button>
                    <button type="button" id="btn-apply-starter-pack" class="btn btn-primary">
                        <i class="ph ph-download-simple"></i>
                        Incorporar selección
                    </button>
                </footer>
            </div>
        `;
        document.body.appendChild(dialog);
        this.dialog = dialog;
    }

    bindEvents() {
        this.trigger?.addEventListener('click', event => this.open(event.currentTarget));
        this.dialog?.addEventListener('click', event => {
            if (event.target === this.dialog) {
                this.close();
                return;
            }
            const action = event.target.closest('[data-starter-action]')?.dataset.starterAction;
            if (action === 'close') this.close();
            if (action === 'select-all') this.setAllChecked(true);
            if (action === 'clear') this.setAllChecked(false);
            if (event.target.closest('#btn-apply-starter-pack')) void this.applySelection();
        });
        this.dialog?.addEventListener('change', event => {
            if (event.target.matches('[data-starter-preset]')) this.updateSelectionCount();
        });
        this.dialog?.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.close();
        });
        window.addEventListener('lifecycle:auth-ready', () => this.renderStatus());
    }

    renderStatus(message = '') {
        if (!this.status) return;
        if (message) {
            this.status.textContent = message;
            return;
        }
        const count = this.app.customTrackers?.registry?.trackers?.filter(tracker => (
            !tracker.archived && !tracker.deleted
        )).length || 0;
        this.status.textContent = count === 0
            ? 'Tu cuenta no tiene tarjetas activas. Podés empezar con una selección sugerida.'
            : `Tenés ${count} ${count === 1 ? 'tarjeta activa' : 'tarjetas activas'}. Solo se agregarán sugerencias que todavía no existan.`;
    }

    open(trigger = null) {
        if (!this.dialog) return;
        this.returnFocus = trigger || document.activeElement;
        const options = this.dialog.querySelector('#starter-pack-options');
        options.innerHTML = getStarterPresets().map(preset => {
            const duplicate = planStarterPackApplication({
                selectedPresetIds: [preset.id],
                registry: this.app.customTrackers?.registry
            }).planned.length === 0;
            return `
                <label class="starter-pack-option${duplicate ? ' is-existing' : ''}">
                    <input type="checkbox" data-starter-preset value="${escapeHtml(preset.id)}" ${duplicate ? 'disabled' : 'checked'}>
                    <span class="starter-pack-option-icon"><i class="ph ${escapeHtml(preset.tracker.icon)}"></i></span>
                    <span class="starter-pack-option-copy">
                        <strong>${escapeHtml(preset.title)}</strong>
                        <small>${escapeHtml(preset.category)} · ${escapeHtml(preset.description)}</small>
                    </span>
                    ${duplicate ? '<span class="starter-pack-existing-badge">Ya existe</span>' : ''}
                </label>
            `;
        }).join('');
        this.setError('');
        this.dialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        this.updateSelectionCount();
        requestAnimationFrame(() => (
            this.dialog.querySelector('[data-starter-preset]:not(:disabled)')
            || this.dialog.querySelector('[data-starter-action="close"]')
        )?.focus());
    }

    close() {
        if (!this.dialog || this.busy) return;
        this.dialog.classList.add('hidden');
        document.body.classList.remove('modal-open');
        const focus = this.returnFocus;
        this.returnFocus = null;
        requestAnimationFrame(() => focus?.focus?.());
    }

    setAllChecked(checked) {
        this.dialog?.querySelectorAll('[data-starter-preset]:not(:disabled)')
            .forEach(input => { input.checked = checked; });
        this.updateSelectionCount();
    }

    getSelectedIds() {
        return [...(this.dialog?.querySelectorAll('[data-starter-preset]:checked') || [])]
            .map(input => input.value);
    }

    updateSelectionCount() {
        const count = this.getSelectedIds().length;
        const label = this.dialog?.querySelector('#starter-pack-selection-count');
        const button = this.dialog?.querySelector('#btn-apply-starter-pack');
        if (label) label.textContent = `${count} ${count === 1 ? 'tarjeta seleccionada' : 'tarjetas seleccionadas'}`;
        if (button) button.disabled = count === 0 || this.busy;
    }

    setError(message) {
        const error = this.dialog?.querySelector('#starter-pack-dialog-error');
        if (!error) return;
        error.textContent = message;
        error.classList.toggle('hidden', !message);
    }

    async applySelection() {
        if (this.busy) return;
        const selectedPresetIds = this.getSelectedIds();
        if (selectedPresetIds.length === 0) {
            this.setError('Elegí al menos una tarjeta para continuar.');
            return;
        }

        const manager = this.app.customTrackers;
        const plan = planStarterPackApplication({
            selectedPresetIds,
            registry: manager?.registry
        });
        if (!manager || plan.planned.length === 0) {
            this.setError('Las tarjetas elegidas ya existen en tu cuenta.');
            return;
        }

        const capacity = manager.getCreationCapacity(
            RESOURCE_KEYS.TRACKER_CARDS,
            plan.planned.length
        );
        if (!capacity.allowed) {
            this.setError(manager.getCreationLimitMessage(RESOURCE_KEYS.TRACKER_CARDS, capacity));
            return;
        }

        this.busy = true;
        this.updateSelectionCount();
        this.setError('');
        try {
            const result = applyStarterPack({
                selectedPresetIds,
                registry: manager.registry,
                now: new Date(),
                idFactory: () => manager.generateTrackerId(),
                availableSlots: capacity.remaining ?? Number.POSITIVE_INFINITY
            });
            manager.registry = result.registry;
            result.created.forEach(({ tracker }) => manager.syncAlertConfig(tracker, tracker.alert));
            manager.persistRegistry();
            this.renderStatus(`${result.created.length} ${result.created.length === 1 ? 'tarjeta incorporada' : 'tarjetas incorporadas'} sin historiales ni alertas activas.`);
            this.busy = false;
            this.close();
            await this.app.showMessage({
                title: 'Configuración aplicada',
                message: `Se incorporaron ${result.created.length} tarjetas. Podés editarlas, archivarlas o eliminarlas desde Tarjetas.`,
                tone: 'success'
            });
        } catch (error) {
            console.error('No se pudo aplicar la configuración inicial:', error);
            this.setError(error?.message || 'No se pudo aplicar la selección.');
            this.busy = false;
            this.updateSelectionCount();
        }
    }
}
