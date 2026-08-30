import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import '../trading-event-utils.js?v=20260829-trading-capacity';
import {
    RESOURCE_KEYS,
    getFinanceResourceUsage
} from '../resource-policy.mjs?v=20260829-all-limits';
import {
    appendResourceCapacityNotice,
    checkResourceCreationCapacity
} from '../resource-limit-ui.mjs?v=20260829-all-limits';

const {
    DEFAULT_TRADING_NOTICE_DAYS,
    createTradingEventId,
    normalizeTradingEvent,
    normalizeTradingEvents,
    normalizeTradingSourceUrl,
    parseTradingEventAlertKey,
    parseTradingNoticeDays
} = globalThis.LifeCycleTradingEvents;

export class TradingModule {
    constructor(appController) {
        this.app = appController;
        this.editingEventId = null;
        this.modalReturnFocus = null;
        this.historyByEvent = new Map();
        this.historyState = 'idle';
        this.init();
    }

    get financeData() {
        return this.app.finanzas?.data || { tradingEvents: [] };
    }

    get events() {
        return normalizeTradingEvents(this.financeData.tradingEvents);
    }

    set events(value) {
        if (!this.app.finanzas?.data) return;
        this.app.finanzas.data.tradingEvents = normalizeTradingEvents(value);
    }

    persist() {
        this.app.finanzas?.saveData?.();
        this.app.triggerDataSync?.('finanzasData');
    }

    toInputParts(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return { date: '', time: '' };
        const pad = number => String(number).padStart(2, '0');
        return {
            date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
            time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
        };
    }

    formatDateTime(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return 'Fecha no disponible';
        return date.toLocaleString('es-AR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStatus(event, now = Date.now()) {
        if (event.status === 'paused') return { tone: 'paused', label: 'Pausado' };
        const scheduledAt = new Date(event.scheduledAt).getTime();
        const remainingMs = scheduledAt - now;
        if (!Number.isFinite(scheduledAt) || remainingMs <= 0) {
            return { tone: 'past', label: 'Finalizado' };
        }
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        if (remainingHours <= 24) {
            return {
                tone: 'urgent',
                label: remainingHours === 1 ? 'En 1 hora' : `En ${remainingHours} horas`
            };
        }
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        return {
            tone: remainingDays <= 7 ? 'soon' : 'upcoming',
            label: remainingDays === 1 ? 'En 1 día' : `En ${remainingDays} días`
        };
    }

    showFormError(message = '') {
        const error = document.getElementById('trading-event-form-error');
        if (!error) return;
        error.textContent = message;
        error.classList.toggle('hidden', !message);
    }

    openEventModal(eventId = null, returnFocusElement = null) {
        const event = eventId ? this.events.find(item => item.id === eventId) : null;
        this.editingEventId = event?.id || null;
        this.modalReturnFocus = returnFocusElement || document.activeElement;

        const form = document.getElementById('trading-event-form');
        form?.reset();
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
        defaultDate.setHours(10, 0, 0, 0);
        const parts = this.toInputParts(event?.scheduledAt || defaultDate);

        document.getElementById('trading-event-modal-title').textContent = event
            ? 'Editar evento financiero'
            : 'Nuevo evento financiero';
        document.getElementById('trading-event-company').value = event?.company || '';
        document.getElementById('trading-event-ticker').value = event?.ticker || '';
        document.getElementById('trading-event-name').value = event?.name || '';
        document.getElementById('trading-event-date').value = parts.date;
        document.getElementById('trading-event-time').value = parts.time;
        document.getElementById('trading-event-notice-days').value = (
            event?.noticeDays || DEFAULT_TRADING_NOTICE_DAYS
        ).join(', ');
        document.getElementById('trading-event-notes').value = event?.notes || '';
        document.getElementById('trading-event-source').value = event?.sourceUrl || '';
        document.getElementById('trading-event-enabled').checked = event?.status !== 'paused';

        this.showFormError('');
        document.getElementById('trading-event-modal')?.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => document.getElementById('trading-event-company')?.focus());
    }

    closeEventModal({ restoreFocus = true } = {}) {
        document.getElementById('trading-event-modal')?.classList.add('hidden');
        if (!document.querySelector('.modal:not(.hidden), .custom-tracker-dialog:not(.hidden)')) {
            document.body.classList.remove('modal-open');
        }
        this.showFormError('');
        const returnFocus = this.modalReturnFocus;
        this.modalReturnFocus = null;
        this.editingEventId = null;
        if (restoreFocus && returnFocus?.focus) requestAnimationFrame(() => returnFocus.focus());
    }

    saveEvent() {
        const company = document.getElementById('trading-event-company')?.value.trim() || '';
        const ticker = document.getElementById('trading-event-ticker')?.value.trim() || '';
        const name = document.getElementById('trading-event-name')?.value.trim() || '';
        const dateValue = document.getElementById('trading-event-date')?.value || '';
        const timeValue = document.getElementById('trading-event-time')?.value || '';
        const noticeValue = document.getElementById('trading-event-notice-days')?.value || '';
        const notes = document.getElementById('trading-event-notes')?.value.trim() || '';
        const sourceValue = document.getElementById('trading-event-source')?.value.trim() || '';
        const enabled = document.getElementById('trading-event-enabled')?.checked !== false;
        const noticeDays = parseTradingNoticeDays(noticeValue);
        const scheduledAt = new Date(`${dateValue}T${timeValue}`);
        const sourceUrl = normalizeTradingSourceUrl(sourceValue);

        if (!company || !name) {
            this.showFormError('Completá la empresa y el nombre del evento.');
            return;
        }
        if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
            this.showFormError('Elegí una fecha y hora futuras.');
            return;
        }
        if (!noticeDays) {
            this.showFormError('Ingresá entre 1 y 12 avisos, usando días enteros de 1 a 365.');
            return;
        }
        if (sourceValue && !sourceUrl) {
            this.showFormError('La fuente debe ser una dirección web http o https válida.');
            return;
        }

        const existing = this.editingEventId
            ? this.events.find(item => item.id === this.editingEventId)
            : null;
        const now = new Date().toISOString();
        const normalized = normalizeTradingEvent({
            id: existing?.id || createTradingEventId(),
            company,
            ticker,
            name,
            scheduledAt: scheduledAt.toISOString(),
            noticeDays,
            notes,
            sourceUrl,
            status: enabled ? 'active' : 'paused',
            createdAt: existing?.createdAt || now,
            updatedAt: now
        });
        if (!normalized) {
            this.showFormError('No se pudo validar el evento. Revisá los datos ingresados.');
            return;
        }

        const capacity = existing
            ? { allowed: true, limit: null, remaining: null }
            : checkResourceCreationCapacity({
                app: this.app,
                resourceKey: RESOURCE_KEYS.TRADING_EVENTS,
                currentCount: getFinanceResourceUsage(this.financeData)[
                    RESOURCE_KEYS.TRADING_EVENTS
                ],
                errorElement: document.getElementById('trading-event-form-error')
            });
        if (!capacity) return;

        this.events = existing
            ? this.events.map(item => item.id === existing.id ? normalized : item)
            : [...this.events, normalized];
        this.persist();
        this.closeEventModal({ restoreFocus: false });
        this.render();
        this.app.showToast?.(existing
            ? 'Evento actualizado.'
            : appendResourceCapacityNotice(
                'Evento de Trading creado.',
                RESOURCE_KEYS.TRADING_EVENTS,
                capacity
            ));
    }

    toggleEventStatus(eventId) {
        const events = this.events;
        const event = events.find(item => item.id === eventId);
        if (!event) return;
        event.status = event.status === 'paused' ? 'active' : 'paused';
        event.updatedAt = new Date().toISOString();
        this.events = events;
        this.persist();
        this.render();
        this.app.showToast?.(event.status === 'active' ? 'Avisos reactivados.' : 'Avisos pausados.');
    }

    async deleteEvent(eventId) {
        const events = this.events;
        const index = events.findIndex(item => item.id === eventId);
        if (index < 0) return;
        const event = events[index];
        const confirmed = await this.app.confirmAction({
            title: 'Eliminar evento financiero',
            message: 'El evento dejará de generar avisos y ya no aparecerá en Trading.',
            tone: 'danger',
            details: [
                { label: 'Empresa', value: event.ticker ? `${event.company} · ${event.ticker}` : event.company },
                { label: 'Evento', value: event.name },
                { label: 'Fecha', value: this.formatDateTime(event.scheduledAt) }
            ],
            cancelLabel: 'Conservar evento',
            confirmLabel: 'Eliminar evento',
            closeOnBackdrop: false
        });
        if (!confirmed) return;

        events.splice(index, 1);
        this.events = events;
        this.persist();
        this.render();
        this.app.showUndo('Evento eliminado.', () => {
            const restored = this.events;
            restored.splice(index, 0, event);
            this.events = restored;
            this.persist();
            this.render();
        });
    }

    async handleEventAction(event) {
        const button = event.target.closest('[data-trading-action]');
        if (!button) return;
        const eventId = button.dataset.eventId;
        if (!eventId) return;
        if (button.dataset.tradingAction === 'edit') {
            this.openEventModal(eventId, button);
        } else if (button.dataset.tradingAction === 'toggle') {
            this.toggleEventStatus(eventId);
        } else if (button.dataset.tradingAction === 'delete') {
            await this.deleteEvent(eventId);
        }
    }

    async getHistoryAccessToken() {
        const auth = this.app.auth;
        if (!auth?.user || !auth.supabase) return '';
        const { data: { session }, error } = await auth.supabase.auth.getSession();
        return error ? '' : (session?.access_token || '');
    }

    async loadHistory() {
        const token = await this.getHistoryAccessToken();
        if (!token) {
            this.historyState = 'signed-out';
            this.historyByEvent = new Map();
            this.render();
            return;
        }

        this.historyState = 'loading';
        this.render();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch('/api/push/history?scope=trading&limit=100', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
                signal: controller.signal
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
            if (result.available === false) {
                this.historyState = 'unavailable';
                this.historyByEvent = new Map();
                return;
            }

            const grouped = new Map();
            (result.entries || []).forEach(entry => {
                const parsed = parseTradingEventAlertKey(entry.alert_key);
                if (!parsed) return;
                if (!grouped.has(parsed.eventId)) grouped.set(parsed.eventId, new Map());
                const eventEntries = grouped.get(parsed.eventId);
                const current = eventEntries.get(entry.alert_key);
                const attemptedAt = new Date(entry.attempted_at).getTime();
                const currentAttemptedAt = new Date(current?.attemptedAt || 0).getTime();
                const statusPriority = entry.status === 'accepted' ? 2 : 1;
                const currentPriority = current?.status === 'accepted' ? 2 : 1;
                if (
                    !current
                    || statusPriority > currentPriority
                    || (statusPriority === currentPriority && attemptedAt > currentAttemptedAt)
                ) {
                    eventEntries.set(entry.alert_key, {
                        noticeDays: parsed.noticeDays,
                        status: entry.status,
                        attemptedAt: entry.attempted_at
                    });
                }
            });
            this.historyByEvent = new Map(
                [...grouped.entries()].map(([eventId, entries]) => [
                    eventId,
                    [...entries.values()]
                        .sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt))
                        .slice(0, 5)
                ])
            );
            this.historyState = 'ready';
        } catch (error) {
            this.historyState = 'failed';
            this.historyByEvent = new Map();
            if (error?.name !== 'AbortError') {
                console.warn('No se pudo consultar el historial de Trading:', error);
            }
        } finally {
            clearTimeout(timeoutId);
            this.render();
        }
    }

    renderHistory(eventId) {
        const entries = this.historyByEvent.get(eventId) || [];
        let content = '';
        if (this.historyState === 'loading') {
            content = '<p class="trading-history-empty">Cargando avisos...</p>';
        } else if (this.historyState === 'signed-out') {
            content = '<p class="trading-history-empty">Iniciá sesión para consultar los avisos enviados.</p>';
        } else if (this.historyState === 'unavailable') {
            content = '<p class="trading-history-empty">El historial técnico no está disponible.</p>';
        } else if (this.historyState === 'failed') {
            content = '<p class="trading-history-empty">No se pudo cargar el historial en este momento.</p>';
        } else if (entries.length === 0) {
            content = '<p class="trading-history-empty">Todavía no se enviaron avisos para este evento.</p>';
        } else {
            const statusLabels = {
                accepted: 'Aceptado por Push',
                failed: 'Falló',
                expired: 'Dispositivo vencido',
                no_devices: 'Sin dispositivos'
            };
            content = `
                <ul class="trading-history-list">
                    ${entries.map(entry => `
                        <li>
                            <span>Aviso ${escapeHtml(String(entry.noticeDays))} ${entry.noticeDays === 1 ? 'día' : 'días'} antes</span>
                            <small>${escapeHtml(statusLabels[entry.status] || 'Intento registrado')} · ${escapeHtml(this.formatDateTime(entry.attemptedAt))}</small>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
        return `
            <details class="trading-event-history">
                <summary>Historial de avisos${entries.length ? ` (${entries.length})` : ''}</summary>
                ${content}
            </details>
        `;
    }

    render() {
        const list = document.getElementById('trading-events-list');
        if (!list) return;
        const events = this.events;
        this.events = events;
        const now = Date.now();
        const activeUpcoming = events
            .filter(event => event.status === 'active' && new Date(event.scheduledAt).getTime() > now)
            .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

        document.getElementById('trading-active-count').textContent = String(activeUpcoming.length);
        document.getElementById('trading-paused-count').textContent = String(
            events.filter(event => event.status === 'paused').length
        );
        document.getElementById('trading-next-event').textContent = activeUpcoming[0]
            ? this.formatDateTime(activeUpcoming[0].scheduledAt)
            : 'Sin eventos próximos';

        if (events.length === 0) {
            list.innerHTML = `
                <div class="trading-empty-state">
                    <i class="ph ph-calendar-plus"></i>
                    <h3>Tu calendario de Trading está vacío</h3>
                    <p>Agregá balances, presentaciones de resultados u otros eventos financieros para recibir avisos progresivos.</p>
                    <button type="button" class="btn btn-primary" data-trading-empty-add>
                        <i class="ph ph-plus-circle"></i> Agregar primer evento
                    </button>
                </div>
            `;
            return;
        }

        const sorted = [...events].sort((a, b) => {
            const aTime = new Date(a.scheduledAt).getTime();
            const bTime = new Date(b.scheduledAt).getTime();
            const aPast = aTime <= now;
            const bPast = bTime <= now;
            if (aPast !== bPast) return aPast ? 1 : -1;
            return aPast ? bTime - aTime : aTime - bTime;
        });

        list.innerHTML = sorted.map(event => {
            const status = this.getStatus(event, now);
            const ticker = event.ticker
                ? `<span class="trading-event-ticker">${escapeHtml(event.ticker)}</span>`
                : '';
            const source = event.sourceUrl
                ? `<a class="trading-event-source" href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noopener noreferrer"><i class="ph ph-arrow-square-out"></i> Abrir fuente</a>`
                : '';
            return `
                <article class="trading-event-card ${escapeHtml(status.tone)}">
                    <div class="trading-event-card-header">
                        <div class="trading-event-identity">
                            <div class="trading-event-company-row">
                                <strong>${escapeHtml(event.company)}</strong>
                                ${ticker}
                            </div>
                            <h3>${escapeHtml(event.name)}</h3>
                            <p><i class="ph ph-calendar-blank"></i> ${escapeHtml(this.formatDateTime(event.scheduledAt))}</p>
                        </div>
                        <span class="trading-event-status ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
                    </div>
                    <div class="trading-event-notices" aria-label="Avisos configurados">
                        <span>Avisos</span>
                        ${event.noticeDays.map(days => `<span class="trading-notice-chip">${days}d</span>`).join('')}
                    </div>
                    ${event.notes ? `<p class="trading-event-notes">${escapeHtml(event.notes)}</p>` : ''}
                    ${source}
                    ${this.renderHistory(event.id)}
                    <div class="trading-event-actions">
                        <button type="button" class="btn btn-secondary" data-trading-action="edit" data-event-id="${escapeHtml(event.id)}">
                            <i class="ph ph-pencil-simple"></i> Editar
                        </button>
                        <button type="button" class="btn btn-secondary" data-trading-action="toggle" data-event-id="${escapeHtml(event.id)}">
                            <i class="ph ${event.status === 'paused' ? 'ph-play' : 'ph-pause'}"></i>
                            ${event.status === 'paused' ? 'Activar avisos' : 'Pausar avisos'}
                        </button>
                        <button type="button" class="btn btn-danger trading-event-delete" data-trading-action="delete" data-event-id="${escapeHtml(event.id)}" aria-label="Eliminar ${escapeHtml(event.name)}">
                            <i class="ph ph-trash"></i> Eliminar
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    }

    handleModalKeydown(event) {
        const modal = document.getElementById('trading-event-modal');
        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeEventModal();
            return;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.saveEvent();
            return;
        }
        if (event.key !== 'Tab' || !modal) return;
        const focusable = [...modal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
        )].filter(element => element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    init() {
        const addButton = document.getElementById('btnAddTradingEvent');
        const refreshButton = document.getElementById('btnRefreshTradingHistory');
        const list = document.getElementById('trading-events-list');
        const modal = document.getElementById('trading-event-modal');
        const form = document.getElementById('trading-event-form');

        addButton?.addEventListener('click', () => this.openEventModal(null, addButton));
        refreshButton?.addEventListener('click', () => {
            this.loadHistory().catch(error => {
                console.warn('No se pudo actualizar el historial de Trading:', error);
            });
        });
        list?.addEventListener('click', event => {
            const emptyButton = event.target.closest('[data-trading-empty-add]');
            if (emptyButton) {
                this.openEventModal(null, emptyButton);
                return;
            }
            this.handleEventAction(event).catch(error => {
                console.error('No se pudo completar la acción de Trading:', error);
                this.app.showToast?.('No se pudo completar la acción.', { tone: 'error' });
            });
        });
        modal?.querySelectorAll('[data-trading-event-close]').forEach(button => {
            button.addEventListener('click', () => this.closeEventModal());
        });
        modal?.addEventListener('click', event => {
            if (event.target === modal) this.closeEventModal();
        });
        modal?.addEventListener('keydown', event => this.handleModalKeydown(event));
        form?.addEventListener('submit', event => {
            event.preventDefault();
            this.saveEvent();
        });
    }

    activate() {
        this.render();
        if (
            this.historyState === 'idle'
            || (this.historyState === 'signed-out' && this.app.auth?.user)
        ) {
            this.loadHistory().catch(error => {
                console.warn('No se pudo cargar el historial de Trading:', error);
            });
        }
    }
}
