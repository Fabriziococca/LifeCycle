import {
    SUBSCRIPTION_CATEGORY_LABELS,
    SUBSCRIPTION_SCHEMA_VERSION,
    SUBSCRIPTION_STORAGE_KEY,
    appendSubscriptionHistoryEvent,
    calculateMonthlyEquivalent,
    calculateNextRenewalDate,
    createSubscriptionId,
    advanceSubscriptionRenewal,
    extractLegacySubscriptionRegistry,
    getDaysUntilRenewal,
    getSubscriptionExpenseOccurrenceKey,
    isPaidSubscription,
    isClientSubscription,
    isExpenseSubscription,
    migrateWorkanaToSubscriptions,
    normalizeSubscription,
    normalizeSubscriptionRegistry,
    parseSubscriptionDate
} from '../subscription-utils.mjs';
import { CLIENT_SUBSCRIPTION_NOTICE_DAYS, subscriptionClientActive, subscriptionAlertTimes } from '../subscription-utils.mjs';
import {
    getSuggestedAlertTime,
    MAX_ALERT_TIMES_PER_DAY,
    normalizeAlertTimes
} from '../alert-schedule-utils.mjs';
import {
    RESOURCE_KEYS,
    createFallbackResourcePolicy,
    evaluateResourceCapacity,
    getResourceCapacityNotice,
    getResourceLimitMessage
} from '../resource-policy.mjs?v=20260904-subscriptions';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import { areStoredValuesEqual } from '../sync-utils.mjs';

const STATUS_LABELS = Object.freeze({
    active: 'Activa',
    paused: 'Pausada',
    canceled: 'Cancelada'
});

function todayKey(now = new Date()) {
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');
}

function eventLabel(type) {
    return ({
        created: 'Creada',
        updated: 'Actualizada',
        renewed: 'Renovada',
        'expense-recorded': 'Gasto registrado',
        paused: 'Pausada',
        canceled: 'Cancelada',
        reactivated: 'Reactivada'
    })[type] || 'Actualizada';
}

export class SubscriptionsModule {
    constructor(app) {
        this.app = app;
        this.subscriptions = [];
        this.activeFilter = 'all';
        this.clientScope = 'own';
        this.editingSubscriptionId = null;
        this.loadData({ persistMigration: true });
        this.bindEvents();
    }

    loadData({ persistMigration = false, syncAlerts = true } = {}) {
        try {
            const directValue = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
            const legacyValue = localStorage.getItem('projectPulseSubscription');
            const embeddedRegistry = !directValue
                ? extractLegacySubscriptionRegistry(legacyValue)
                : null;
            const registry = normalizeSubscriptionRegistry(directValue || embeddedRegistry || []);
            const workana = migrateWorkanaToSubscriptions(legacyValue, registry);
            this.subscriptions = workana.subscriptions;
            if (persistMigration && (workana.migrated || (!directValue && embeddedRegistry))) {
                this.saveData();
            } else if (syncAlerts) {
                this.syncAlerts();
            }
            return workana.migrated || Boolean(!directValue && embeddedRegistry);
        } catch (error) {
            console.error('[Subscriptions] No se pudieron cargar los datos:', error);
            this.subscriptions = [];
            return false;
        }
    }

    getCreationCapacity(requestedCount = 1) {
        if (typeof this.app.auth?.canCreateResource === 'function') {
            return this.app.auth.canCreateResource(
                RESOURCE_KEYS.SUBSCRIPTIONS,
                this.subscriptions.length,
                requestedCount
            );
        }
        return evaluateResourceCapacity(
            createFallbackResourcePolicy(),
            RESOURCE_KEYS.SUBSCRIPTIONS,
            this.subscriptions.length,
            requestedCount
        );
    }

    saveData({ sync = true } = {}) {
        const registry = normalizeSubscriptionRegistry({
            version: SUBSCRIPTION_SCHEMA_VERSION,
            subscriptions: this.subscriptions
        });
        this.subscriptions = registry.subscriptions;
        localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(registry));
        this.syncAlerts();
        if (sync) this.app.triggerDataSync?.(SUBSCRIPTION_STORAGE_KEY);
    }

    syncAlerts() {
        if (!this.app.alerts?.configs) return false;
        const activeKeys = new Set();
        let changed = false;
        const hasMigratedWorkana = this.subscriptions.some(subscription => (
            subscription.id === 'sub_workana_plan'
            || subscription.name.toLowerCase().includes('workana')
        ));
        if (hasMigratedWorkana && this.app.alerts.configs.workana) {
            delete this.app.alerts.configs.workana;
            changed = true;
        }
        this.subscriptions.forEach(subscription => {
            const key = `sub_${subscription.id}`;
            activeKeys.add(key);
            const values = subscriptionAlertTimes(subscription, getDaysUntilRenewal(subscription.nextRenewalDate));
            const times = normalizeAlertTimes(values, '09:00');
            const next = {
                enabled: subscription.status === 'active' && subscription.alert.enabled && subscriptionClientActive(subscription, this.app.work?.store?.state?.clients),
                time: times.time,
                times: times.times,
                days: [],
                subscriptionId: subscription.id,
                name: subscription.name
            };
            if (!areStoredValuesEqual(this.app.alerts.configs[key], next)) {
                this.app.alerts.configs[key] = next;
                changed = true;
            }
        });
        Object.keys(this.app.alerts.configs).forEach(key => {
            if (!key.startsWith('sub_sub_') || activeKeys.has(key)) return;
            delete this.app.alerts.configs[key];
            changed = true;
        });
        if (changed) {
            this.app.alerts.saveData?.();
            this.app.triggerDataSync?.('alerts_config');
        }
        return changed;
    }

    bindEvents() {
        document.getElementById('btn-new-subscription')?.addEventListener('click', event => {
            this.openModal(null, event.currentTarget);
        });
        document.querySelectorAll('[data-subscription-filter]').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('[data-subscription-filter]')
                    .forEach(item => item.classList.toggle('active', item === button));
                this.activeFilter = button.dataset.subscriptionFilter;
                this.renderList();
            });
        });

        document.getElementById('sub-client-scope')?.addEventListener('change', event => {
            this.clientScope = event.target.value;this.render();
        });
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-subscription-action]');
            if (!button) return;
            const id = button.closest('[data-subscription-id]')?.dataset.subscriptionId;
            const action = button.dataset.subscriptionAction;
            if (action === 'new') this.openModal(null, button);
            else if (action === 'edit') this.openModal(id, button);
            else if (action === 'expense') void this.recordExpense(id);
            else if (action === 'convert-paid') this.openModal(id, button, { convertToPaid: true });
            else if (action === 'decline') void this.setStatus(id, 'canceled');
            else if (action === 'pause') void this.setStatus(id, 'paused');
            else if (action === 'cancel') void this.setStatus(id, 'canceled');
            else if (action === 'reactivate') void this.setStatus(id, 'active');
            else if (action === 'delete') void this.deleteSubscription(id);
        });

        const modal = document.getElementById('subscription-modal');
        modal?.addEventListener('click', event => {
            if (event.target === modal || event.target.closest('[data-subscription-modal-close]')) {
                this.closeModal();
                return;
            }
            if (event.target.closest('#btn-add-subscription-alert-time')) {
                const times = this.readAlertTimes();
                const next = getSuggestedAlertTime(times);
                if (next) this.renderExtraAlertTimes([...times.slice(1), next]);
                return;
            }
            const remove = event.target.closest('[data-remove-subscription-alert-time]');
            if (remove) {
                remove.closest('.subscription-extra-alert-time')?.remove();
                this.updateAddTimeState();
            }
        });
        modal?.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.closeModal();
        });
        document.getElementById('subscription-form')?.addEventListener('submit', event => {
            event.preventDefault();
            this.saveSubscriptionFromModal();
        });
        document.getElementById('sub-alert-enabled')?.addEventListener('change', event => {
            document.getElementById('sub-alert-settings')
                ?.classList.toggle('hidden', !event.currentTarget.checked);
        });
        document.getElementById('sub-billing-mode')?.addEventListener('change', () => this.updateBillingFields());
        document.getElementById('sub-client')?.addEventListener('change', () => this.updateBillingFields());
        document.getElementById('sub-period')?.addEventListener('change', () => this.updateBillingFields());
        document.getElementById('sub-alert-mode')?.addEventListener('change', () => this.updateBillingFields());
    }

    render() {
        this.renderSummary();
        this.renderList();
        this.app.work?.render();
    }

    renderSummary() {
        const scoped = this.subscriptions.filter(item => this.matchesClientScope(item));
        const active = scoped.filter(item => item.status === 'active');
        let usd = 0;
        let ars = 0;
        const rate = Number(this.app.getValidCachedLemonRate?.()) || 0;
        const addCost = (items) => {
            const totals = { usd: 0, ars: 0 };
            items.forEach(item => {
                const monthly = item.periodDays ? item.cost * 30 / item.periodDays : calculateMonthlyEquivalent(item.cost, item.periodMonths);
                if (item.currency === 'ARS') {
                    totals.ars += monthly;
                    if (rate > 0) totals.usd += monthly / rate;
                } else {
                    totals.usd += monthly;
                    if (rate > 0) totals.ars += monthly * rate;
                }
            });
            return totals;
        };
        const clients = active.filter(isClientSubscription);
        const clientTotals = addCost(clients);
        ({ usd, ars } = this.clientScope === 'clients' ? clientTotals : addCost(active.filter(isExpenseSubscription)));
        const upcoming = active.filter(item => {
            const days = getDaysUntilRenewal(item.nextRenewalDate);
            return Number.isFinite(days) && days >= 0 && days <= 7;
        }).length;
        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        setText('subs-summary-total', String(scoped.length));
        const clientsOnly = this.clientScope === 'clients';
        setText('subs-summary-usd-label', clientsOnly ? 'Costo mensual de clientes (USD)' : 'Tu gasto mensual (USD)');
        setText('subs-summary-ars-label', clientsOnly ? 'Costo mensual de clientes (ARS est.)' : 'Tu gasto mensual (ARS est.)');
        setText('subs-summary-monthly-usd', `$${usd.toFixed(2)} USD`);
        setText('subs-summary-monthly-ars', ars > 0 ? `$${Math.round(ars).toLocaleString('es-AR')} ARS` : '—');
        setText('subs-summary-upcoming', String(upcoming));
        const note = document.getElementById('subs-summary-scope-note');
        if (note) {
            note.textContent = clientsOnly
                ? `Las paga cada cliente. Importes informativos; no se suman a tus gastos.${clients.some(item => !item.cost) ? ' Hay servicios sin importe indicado.' : ''}`
                : this.clientScope === 'all'
                    ? `Tu gasto mensual incluye sólo suscripciones propias. Costo de clientes, por separado: USD ${clientTotals.usd.toFixed(2)}${clientTotals.ars > 0 ? ` · ARS ${Math.round(clientTotals.ars).toLocaleString('es-AR')}` : ''}. No se suma a tus gastos.`
                    : 'Sólo tus suscripciones propias se pueden registrar como gastos en Finanzas.';
        }
    }

    getFilteredSubscriptions() {
        return this.subscriptions.filter(item => {
            if (!this.matchesClientScope(item)) return false;
            if (this.activeFilter === 'active') return item.status === 'active' && (isPaidSubscription(item) || item.billingMode === 'tracking');
            if (this.activeFilter === 'free') return !isPaidSubscription(item) && item.billingMode !== 'tracking';
            if (this.activeFilter === 'expiring') {
                const days = getDaysUntilRenewal(item.nextRenewalDate);
                return item.status === 'active' && Number.isFinite(days) && days >= 0 && days <= 7;
            }
            if (this.activeFilter === 'canceled') return item.status !== 'active';
            return true;
        });
    }

    matchesClientScope(item) { return this.clientScope === 'all' || (this.clientScope === 'clients' ? Boolean(item.clientId) : !item.clientId); }

    clientItems(clientId) { return this.subscriptions.filter(item => item.clientId === clientId); }

    renderList() {
        const container = document.getElementById('subscriptions-list');
        if (!container) return;
        const items = this.getFilteredSubscriptions();
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state subscription-card" data-subscription-id="">
                    <i class="ph ph-receipt" aria-hidden="true"></i>
                    <p>No hay suscripciones en esta vista.</p>
                    <button type="button" class="btn btn-primary" data-subscription-action="new">
                        <i class="ph ph-plus"></i> Nueva suscripción
                    </button>
                </div>`;
            return;
        }
        container.innerHTML = items.map(item => this.renderCard(item)).join('');
    }

    renderCard(subscription, {clientContext = false} = {}) {
        const clientOwned = isClientSubscription(subscription);
        const paid = isPaidSubscription(subscription);
        const tracking = subscription.billingMode === 'tracking';
        const client = subscription.clientId ? this.app.work?.store?.state?.clients?.find(c => c.id === subscription.clientId) : null;
        const trial = subscription.billingMode === 'trial';
        const days = getDaysUntilRenewal(subscription.nextRenewalDate);
        const category = SUBSCRIPTION_CATEGORY_LABELS[subscription.category] || 'Otros';
        const period = subscription.periodDays ? `${subscription.periodDays} días` : subscription.periodMonths === 1
            ? 'mes'
            : (subscription.periodMonths === 12 ? 'año' : `${subscription.periodMonths} meses`);
        const statusClass = subscription.status === 'active'
            ? (days !== null && days <= 2 ? 'red' : (days !== null && days <= 7 ? 'yellow' : 'green'))
            : (subscription.status === 'paused' ? 'yellow' : 'red');
        let statusText = subscription.status === 'active'
            ? (days === null ? 'Fecha inválida' : (days < 0 ? `Venció hace ${Math.abs(days)} d` : (days === 0 ? 'Renueva hoy' : `Renueva en ${days} d`)))
            : STATUS_LABELS[subscription.status];
        if (trial && subscription.status === 'active') {
            statusText = days === null ? 'Fecha inválida' : days < 0 ? 'Prueba vencida: decidir' : days === 0 ? 'Prueba termina hoy' : `Prueba: quedan ${days} d`;
        } else if (!clientOwned && !paid && !tracking && subscription.status === 'active') {
            statusText = 'Gratuita';
        }
        const alerts = subscription.alert.enabled
            ? subscription.alert.times.join(', ')
            : 'Desactivados';
        const history = [...subscription.history].reverse().slice(0, 8);
        const inactiveActions = subscription.status === 'active'
            ? `<button type="button" class="btn btn-secondary" data-subscription-action="pause">Pausar</button>
               <button type="button" class="btn btn-secondary" data-subscription-action="cancel">Cancelar</button>`
            : '<button type="button" class="btn btn-secondary" data-subscription-action="reactivate">Reactivar</button>';

        return `
            <article id="${clientContext ? 'client-subscription-' : 'subscription-'}${escapeHtml(subscription.id)}" class="subscription-card card" data-subscription-id="${escapeHtml(subscription.id)}">
                <div class="subscription-card-heading">
                    <div>
                        <span class="subscription-category">${escapeHtml(client ? client.name + ' · ' + category : category)}</span>
                        <h3>${escapeHtml(subscription.name)}</h3>
                        ${clientOwned ? '<span class="subscription-free-label">La paga el cliente · Importe informativo · No suma a tus gastos</span>' : !paid ? `<span class="subscription-free-label">${tracking ? 'Sólo seguimiento · importe no indicado' : trial ? 'Prueba gratuita' : 'Gratuita permanente'} · No suma gasto</span>` : ''}
                    </div>
                    <span class="badge ${statusClass}">${escapeHtml(statusText)}</span>
                </div>
                <div class="subscription-price">
                    <strong>${clientOwned ? subscription.cost > 0 ? `${subscription.currency} ${subscription.cost.toFixed(2)}` : 'Sin importe indicado' : tracking ? 'Sólo avisos' : !paid ? 'Gratis ahora' : `${subscription.currency === 'USD' ? '$' : 'ARS$'}${subscription.cost.toFixed(2)}`}</strong>
                    <span>/ ${escapeHtml(period)}</span>
                    ${clientOwned || tracking ? '' : `<small>${paid ? '≈' : 'Precio si pagás:'} ${subscription.currency === 'USD' ? '$' : 'ARS$'}${paid ? (subscription.periodDays ? subscription.cost * 30 / subscription.periodDays : calculateMonthlyEquivalent(subscription.cost, subscription.periodMonths)).toFixed(2) : subscription.cost.toFixed(2)}${paid ? '/mes' : ` / ${period}`}</small>`}
                </div>
                <dl class="subscription-meta">
                    <div><dt>${trial ? 'Fin de prueba / decisión' : 'Próxima renovación'}</dt><dd>${escapeHtml(subscription.nextRenewalDate)}${subscription.renewalTime ? ' · '+escapeHtml(subscription.renewalTime)+' · Argentina' : ''}</dd></div>
                    <div><dt>Avisos</dt><dd>${escapeHtml(alerts)}</dd></div>
                    ${clientOwned ? `<div><dt>La paga</dt><dd>${escapeHtml(client?.name || 'El cliente')}</dd></div>` : `<div><dt>Gasto</dt><dd>${!paid ? 'Sin cargos registrados' : subscription.autoRecordExpense ? 'Automático' : 'Confirmación manual'}</dd></div>`}
                </dl>
                ${subscription.alert.enabled ? `<p class="fw-note">${subscription.alert.noticeDays ? 'Avisos cuando falten '+subscription.alert.noticeDays.join(', ')+' días.' : 'Avisos diarios desde '+subscription.alert.daysBefore+' días antes.'}${subscription.renewalTime ? ' El día de renovación, los avisos posteriores se adelantan a las '+escapeHtml(subscription.renewalTime)+'.' : ''}${client?.archived ? ' Cliente archivado: avisos y ciclos pausados.' : ''}</p>` : ''}
                ${history.length > 0 ? `
                    <details class="subscription-history">
                        <summary>Historial (${subscription.history.length})</summary>
                        <ul>${history.map(event => `<li><strong>${escapeHtml(eventLabel(event.type))}</strong> · ${escapeHtml(event.effectiveDate)}${event.note ? ` — ${escapeHtml(event.note)}` : ''}</li>`).join('')}</ul>
                    </details>` : ''}
                <div class="subscription-actions">
                    ${clientOwned ? '' : paid ? '<button type="button" class="btn btn-secondary" data-subscription-action="expense"><i class="ph ph-receipt"></i> Registrar gasto</button>' : '<button type="button" class="btn btn-primary" data-subscription-action="convert-paid">Pasar a paga</button>'}
                    ${!clientOwned && trial && subscription.status === 'active' ? '<button type="button" class="btn btn-secondary" data-subscription-action="decline">No continuar</button>' : ''}
                    <button type="button" class="btn btn-secondary" data-subscription-action="edit"><i class="ph ph-pencil"></i> Editar</button>
                    ${inactiveActions}
                    <button type="button" class="icon-btn is-danger" data-subscription-action="delete" aria-label="Eliminar ${escapeHtml(subscription.name)}"><i class="ph ph-trash"></i></button>
                </div>
            </article>`;
    }

    renderExtraAlertTimes(times = []) {
        const list = document.getElementById('sub-alert-extra-times');
        if (!list) return;
        list.innerHTML = '';
        const primary = document.getElementById('sub-alert-time')?.value || '09:00';
        const normalized = normalizeAlertTimes([primary, ...times], primary).times;
        normalized.filter(time => time !== primary).slice(0, MAX_ALERT_TIMES_PER_DAY - 1)
            .forEach((time, index) => {
                const row = document.createElement('div');
                row.className = 'subscription-extra-alert-time';
                const input = document.createElement('input');
                input.type = 'time';
                input.className = 'text-input sub-alert-extra-time';
                input.value = time;
                input.setAttribute('aria-label', `Horario adicional ${index + 1}`);
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'icon-btn';
                remove.dataset.removeSubscriptionAlertTime = '';
                remove.setAttribute('aria-label', 'Eliminar horario adicional');
                remove.innerHTML = '<i class="ph ph-trash"></i>';
                row.append(input, remove);
                list.appendChild(row);
            });
        this.updateAddTimeState();
    }

    readAlertTimes() {
        const primary = document.getElementById('sub-alert-time')?.value || '09:00';
        const extras = [...document.querySelectorAll('#sub-alert-extra-times .sub-alert-extra-time')]
            .map(input => input.value);
        return normalizeAlertTimes([primary, ...extras], primary).times;
    }

    updateAddTimeState() {
        const button = document.getElementById('btn-add-subscription-alert-time');
        if (button) button.disabled = this.readAlertTimes().length >= MAX_ALERT_TIMES_PER_DAY;
    }

    updateBillingFields() {
        const clientOwned = Boolean(document.getElementById('sub-client')?.value);
        const billing = document.getElementById('sub-billing-mode');
        if (clientOwned) billing.value = 'tracking';
        billing.disabled = clientOwned;
        billing.closest('.input-group')?.classList.toggle('hidden', clientOwned);
        const mode = document.getElementById('sub-billing-mode')?.value;
        const expense = document.getElementById('sub-auto-record-expense');
        if (expense) {
            expense.disabled = clientOwned || mode !== 'paid';
            if (clientOwned) expense.checked = false;
        }
        const tracking = mode === 'tracking';
        document.getElementById('sub-payment-method')?.closest('.input-group')?.classList.toggle('hidden', clientOwned || tracking);
        expense?.closest('.input-group')?.classList.toggle('hidden', clientOwned || tracking);
        const price = document.getElementById('sub-cost');
        price.required = !clientOwned && !tracking;
        document.querySelector('label[for="sub-cost"]').textContent = clientOwned ? 'Importe del ciclo (opcional)' : 'Precio real del ciclo';
        document.querySelector('.subscription-form-row--money')?.classList.toggle('hidden', !clientOwned && tracking);
        document.getElementById('sub-client-cost-help')?.classList.toggle('hidden', !clientOwned);
        document.getElementById('sub-owner-help')?.classList.toggle('hidden', !clientOwned);
        document.getElementById('sub-period-days-group')?.classList.toggle('hidden', document.getElementById('sub-period')?.value !== 'days');
        document.getElementById('sub-alert-days-group')?.classList.toggle('hidden', document.getElementById('sub-alert-mode')?.value !== 'daily');
        const renewal = document.getElementById('sub-renewal-date');
        if (renewal) renewal.required = mode === 'trial' || this.reactivatingSubscription || this.convertingSubscription;
        const label = document.querySelector('label[for="sub-renewal-date"]');
        if (label) label.textContent = mode === 'trial' ? 'Fin de prueba gratuita' : 'Próxima renovación';
    }

    openModal(subscriptionId = null, trigger = null, { reactivate = false, convertToPaid = false, clientId = '' } = {}) {
        if (!subscriptionId) {
            const capacity = this.getCreationCapacity();
            if (!capacity.allowed) {
                void this.app.showMessage?.({
                    title: 'Límite alcanzado',
                    message: getResourceLimitMessage(RESOURCE_KEYS.SUBSCRIPTIONS, capacity.limit),
                    tone: 'warning'
                });
                return;
            }
        }
        const modal = document.getElementById('subscription-modal');
        if (!modal) return;
        this.editingSubscriptionId = subscriptionId;
        this.reactivatingSubscription = reactivate;
        this.convertingSubscription = convertToPaid;
        this.modalReturnFocus = trigger instanceof HTMLElement ? trigger : null;
        const subscription = subscriptionId
            ? this.subscriptions.find(item => item.id === subscriptionId)
            : null;
        if (subscription?.clientId || clientId) {
            convertToPaid = false;
            this.convertingSubscription = false;
        }
        this.reactivationFingerprint = reactivate || convertToPaid ? JSON.stringify(subscription) : null;
        document.getElementById('subscription-modal-title').textContent = reactivate ? 'Reactivar suscripción' : subscription ? 'Editar suscripción' : 'Nueva suscripción';
        document.getElementById('sub-name').value = subscription?.name || '';
        document.getElementById('sub-billing-mode').value = convertToPaid ? 'paid' : subscription?.billingMode || (clientId ? 'tracking' : 'paid');
        const clients = this.app.work?.store?.state?.clients || [];
        document.getElementById('sub-client').innerHTML = '<option value="">Propia · la pago yo</option>' + clients.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${c.archived?' · archivado':''}</option>`).join('');
        document.getElementById('sub-client').value = subscription?.clientId || clientId;
        if (convertToPaid) document.getElementById('subscription-modal-title').textContent = 'Pasar a suscripción paga';
        document.getElementById('sub-category').value = subscription?.category || 'software';
        document.getElementById('sub-cost').value = subscription?.cost ?? '';
        document.getElementById('sub-currency').value = subscription?.currency || 'USD';
        const period = document.getElementById('sub-period');
        const months = String(subscription?.periodMonths || 1);
        if (!subscription?.periodDays && ![...period.options].some(o => o.value === months)) period.add(new Option(`${months} meses`, months));
        period.value = subscription?.periodDays || clientId ? 'days' : months;
        document.getElementById('sub-period-days').value = subscription?.periodDays || 30;
        document.getElementById('sub-renewal-time').value = subscription?.renewalTime || '';
        document.getElementById('sub-start-date').value = subscription?.startDate || todayKey();
        const renewalInput = document.getElementById('sub-renewal-date');
        renewalInput.value = reactivate || convertToPaid ? '' : subscription?.nextRenewalDate || '';
        renewalInput.min = reactivate || convertToPaid ? todayKey() : '';
        renewalInput.required = reactivate;
        document.getElementById('sub-payment-method').value = subscription?.paymentMethod || (clientId || subscription?.billingMode === 'tracking' ? '' : 'Tarjeta');
        document.getElementById('sub-autorenew').checked = subscription?.autoRenew !== false;
        document.getElementById('sub-auto-record-expense').checked = subscription?.autoRecordExpense === true;
        document.getElementById('sub-notes').value = subscription?.notes || '';
        document.getElementById('sub-alert-enabled').checked = subscription?.alert?.enabled !== false;
        document.getElementById('sub-alert-days').value = String(subscription?.alert?.daysBefore ?? 3);
        document.getElementById('sub-alert-mode').value = subscription?.alert?.noticeDays ? 'progressive' : clientId ? 'progressive' : 'daily';
        this.editingNoticeDays = subscription?.alert?.noticeDays || [...CLIENT_SUBSCRIPTION_NOTICE_DAYS];
        const times = normalizeAlertTimes(subscription?.alert?.times || (clientId ? '22:00' : '09:00'), '09:00').times;
        document.getElementById('sub-alert-time').value = times[0];
        this.renderExtraAlertTimes(times.slice(1));
        document.getElementById('sub-alert-settings')?.classList.toggle('hidden', subscription?.alert?.enabled === false);
        document.getElementById('subscription-form-error')?.classList.add('hidden');
        this.updateBillingFields();
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        document.getElementById('sub-name')?.focus();
        if (reactivate || convertToPaid) {
            this.showFormError('Elegí la próxima renovación real (hoy o posterior). No se registrarán gastos de los períodos de pausa o cancelación.');
            renewalInput.focus();
        }
    }

    closeModal() {
        document.getElementById('subscription-modal')?.classList.add('hidden');
        document.body.classList.remove('modal-open');
        this.editingSubscriptionId = null;
        this.reactivatingSubscription = false;
        this.convertingSubscription = false;
        this.reactivationFingerprint = null;
        this.modalReturnFocus?.focus?.();
        this.modalReturnFocus = null;
    }

    showFormError(message) {
        const element = document.getElementById('subscription-form-error');
        if (!element) return;
        element.textContent = message;
        element.classList.remove('hidden');
    }

    saveSubscriptionFromModal() {
        const existing = this.editingSubscriptionId
            ? this.subscriptions.find(item => item.id === this.editingSubscriptionId)
            : null;
        if ((this.reactivatingSubscription || this.convertingSubscription) && this.reactivationFingerprint !== JSON.stringify(existing)) {
            return this.showFormError('La suscripción cambió durante la edición. Cerrá y volvé a abrir el editor.');
        }
        const capacity = existing ? null : this.getCreationCapacity();
        if (capacity && !capacity.allowed) {
            return this.showFormError(
                getResourceLimitMessage(RESOURCE_KEYS.SUBSCRIPTIONS, capacity.limit)
            );
        }
        const name = document.getElementById('sub-name')?.value.replace(/\s+/g, ' ').trim();
        const startDate = document.getElementById('sub-start-date')?.value;
        const periodMonths = Number(document.getElementById('sub-period')?.value);
        const periodDays = document.getElementById('sub-period').value === 'days' ? Number(document.getElementById('sub-period-days').value) : undefined;
        if (periodDays !== undefined && (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 3650)) return this.showFormError('Elegí un ciclo entre 1 y 3650 días.');
        const clientId = document.getElementById('sub-client').value || undefined;
        if (clientId && !this.app.work?.store?.state?.clients?.some(c => c.id === clientId && (!c.archived || existing?.clientId === clientId))) return this.showFormError('Elegí un cliente activo.');
        let nextRenewalDate = document.getElementById('sub-renewal-date')?.value;
        const reactivating = this.reactivatingSubscription && existing && existing.status !== 'active';
        if ((reactivating || this.convertingSubscription) && (!parseSubscriptionDate(nextRenewalDate) || nextRenewalDate < todayKey())) {
            return this.showFormError('Para reactivar, indicá la próxima renovación real desde hoy. No uses una fecha vencida.');
        }
        if (!name) return this.showFormError('Ingresá el nombre del servicio o plataforma.');
        if (!parseSubscriptionDate(startDate)) return this.showFormError('Elegí una fecha de inicio válida.');
        const billingMode = clientId ? 'tracking' : document.getElementById('sub-billing-mode').value;
        if (existing && !isPaidSubscription(existing) && billingMode === 'paid' && (!parseSubscriptionDate(nextRenewalDate) || nextRenewalDate < todayKey())) {
            return this.showFormError('Indicá la primera renovación paga desde hoy; no se cobrarán períodos gratuitos anteriores.');
        }
        if (billingMode === 'trial' && !nextRenewalDate) return this.showFormError('Indicá la fecha exacta de fin de la prueba gratuita.');
        if (!nextRenewalDate && periodDays) return this.showFormError('Indicá la próxima renovación para iniciar el ciclo de días exactos.');
        if (!nextRenewalDate) nextRenewalDate = calculateNextRenewalDate(startDate, periodMonths);
        if (!parseSubscriptionDate(nextRenewalDate)) return this.showFormError('Elegí una fecha de renovación válida.');

        const now = new Date().toISOString();
        const id = existing?.id || createSubscriptionId(this.subscriptions.map(item => item.id));
        const renewalAnchorChanged = Boolean(existing) && (
            existing.nextRenewalDate !== nextRenewalDate
            || existing.startDate !== startDate
        );
        let candidate = normalizeSubscription({
            ...existing,
            id,
            name,
            clientId,
            periodDays,
            renewalTime: document.getElementById('sub-renewal-time').value || undefined,
            category: document.getElementById('sub-category')?.value,
            cost: document.getElementById('sub-cost')?.value,
            billingMode,
            currency: document.getElementById('sub-currency')?.value,
            periodMonths,
            startDate,
            nextRenewalDate,
            billingAnchorDay: renewalAnchorChanged ? undefined : existing?.billingAnchorDay,
            billingAnchorIsMonthEnd: renewalAnchorChanged
                ? undefined
                : existing?.billingAnchorIsMonthEnd,
            paymentMethod: document.getElementById('sub-payment-method')?.value,
            autoRenew: document.getElementById('sub-autorenew')?.checked,
            autoRecordExpense: !clientId && billingMode === 'paid' && document.getElementById('sub-auto-record-expense')?.checked,
            notes: document.getElementById('sub-notes')?.value,
            status: reactivating || this.convertingSubscription ? 'active' : existing?.status || 'active',
            ...(reactivating ? { statusChangedAt: now } : {}),
            alert: {
                enabled: document.getElementById('sub-alert-enabled')?.checked,
                times: this.readAlertTimes(),
                daysBefore: document.getElementById('sub-alert-days')?.value
                ,...(document.getElementById('sub-alert-mode').value === 'progressive' ? {noticeDays:this.editingNoticeDays} : {})
            },
            createdAt: existing?.createdAt || now,
            updatedAt: now
        }, new Date(now));
        candidate = appendSubscriptionHistoryEvent(candidate, {
            type: reactivating ? 'reactivated' : existing ? 'updated' : 'created',
            occurredAt: now,
            effectiveDate: todayKey(),
            note: reactivating ? `Reactivada con próxima renovación ${nextRenewalDate}; sin recuperar períodos inactivos` : existing ? 'Configuración actualizada' : 'Suscripción creada'
        });
        if (existing) {
            this.subscriptions[this.subscriptions.findIndex(item => item.id === id)] = candidate;
        } else {
            this.subscriptions.unshift(candidate);
        }
        const wasEditing = Boolean(existing);
        this.saveData();
        this.closeModal();
        this.render();
        const notice = capacity ? getResourceCapacityNotice(RESOURCE_KEYS.SUBSCRIPTIONS, capacity) : '';
        this.app.showToast?.(`${wasEditing ? 'Suscripción actualizada.' : 'Suscripción creada.'}${notice ? ` ${notice}` : ''}`);
    }

    async setStatus(subscriptionId, status) {
        const index = this.subscriptions.findIndex(item => item.id === subscriptionId);
        if (index < 0 || !['active', 'paused', 'canceled'].includes(status)) return;
        const current = this.subscriptions[index];
        if (current.status === status) return;
        if (status === 'active') {
            this.openModal(subscriptionId, null, { reactivate: true });
            return;
        }
        if (status === 'canceled') {
            const confirmed = await this.app.confirmAction?.({
                title: 'Cancelar seguimiento',
                message: `LifeCycle dejará de avisar y registrar renovaciones de “${current.name}”. Esto no cancela el servicio en el proveedor.`,
                confirmLabel: 'Marcar cancelada',
                tone: 'warning'
            });
            if (!confirmed) return;
        }
        const now = new Date().toISOString();
        const type = status === 'active' ? 'reactivated' : status;
        this.subscriptions[index] = appendSubscriptionHistoryEvent({
            ...current,
            status,
            statusChangedAt: now,
            updatedAt: now
        }, { type, occurredAt: now, effectiveDate: todayKey() });
        this.saveData();
        this.render();
        this.app.showToast?.(status === 'active' ? 'Suscripción reactivada.' : `Suscripción ${status === 'paused' ? 'pausada' : 'cancelada'}.`);
    }

    async deleteSubscription(subscriptionId) {
        const subscription = this.subscriptions.find(item => item.id === subscriptionId);
        if (!subscription) return;
        const confirmed = await this.app.confirmAction?.({
            title: 'Eliminar suscripción',
            message: `Se eliminarán “${subscription.name}” y su historial. Los gastos de Finanzas se conservarán.`,
            confirmLabel: 'Eliminar definitivamente',
            tone: 'danger'
        });
        if (!confirmed) return;
        this.subscriptions = this.subscriptions.filter(item => item.id !== subscriptionId);
        this.saveData();
        this.render();
        this.app.showToast?.('Suscripción eliminada.');
    }

    async recordExpense(subscriptionId, { automatic = false, silent = false } = {}) {
        const index = this.subscriptions.findIndex(item => item.id === subscriptionId);
        if (index < 0 || !this.app.finanzas) return false;
        const subscription = this.subscriptions[index];
        if (!isExpenseSubscription(subscription) || subscription.status !== 'active') return false;
        const renewalDate = subscription.nextRenewalDate;
        const occurrenceKey = getSubscriptionExpenseOccurrenceKey(subscription, renewalDate);
        if (!occurrenceKey) return false;
        if (subscription.lastExpenseRecordedPeriod === occurrenceKey && !this.app.auth?.supabase) {
            if (subscription.autoRenew && getDaysUntilRenewal(renewalDate) <= 0) {
                this.subscriptions[index] = appendSubscriptionHistoryEvent(
                    advanceSubscriptionRenewal(subscription, renewalDate),
                    {
                        type: 'renewed',
                        effectiveDate: renewalDate,
                        occurrenceKey,
                        note: 'Período ya registrado; fecha de renovación recuperada'
                    }
                );
                this.saveData();
                this.render();
            }
            if (!silent) this.app.showToast?.('Este período ya está registrado en Finanzas.');
            return true;
        }
        if (!automatic) {
            const confirmed = await this.app.confirmAction?.({
                title: 'Registrar gasto de suscripción',
                message: `Se agregará el pago de “${subscription.name}” correspondiente a ${renewalDate}.`,
                confirmLabel: 'Registrar gasto',
                tone: 'primary',
                details: [
                    {
                        label: 'Importe',
                        value: `${subscription.currency === 'ARS' ? 'ARS$' : '$'}${subscription.cost.toFixed(2)}`
                    },
                    { label: 'Próxima renovación', value: renewalDate }
                ]
            });
            if (!confirmed) return false;
        }
        const result = await this.app.finanzas.recordSubscriptionExpense({
            subscriptionId: subscription.id,
            name: subscription.name,
            amount: subscription.cost,
            currency: subscription.currency,
            date: renewalDate,
            period: `Renovación ${renewalDate}`,
            occurrenceKey,
            automatic
        });
        const recorded = result === true || result?.created === true || result?.duplicate === true;
        if (!recorded) return false;
        if (result?.subscriptionRegistry) {
            this.subscriptions = normalizeSubscriptionRegistry(result.subscriptionRegistry).subscriptions;
            const auth=this.app.auth,restoring=auth.isRestoring;auth.isRestoring=true;
            try{this.saveData({sync:false});}finally{auth.isRestoring=restoring;}
            this.render();
            if (!silent) this.app.showToast?.(result.duplicate ? 'Ese período ya estaba registrado.' : 'Gasto registrado y renovación actualizada.');
            return true;
        }
        const now = new Date().toISOString();
        let updated = appendSubscriptionHistoryEvent({
            ...subscription,
            lastExpenseRecordedPeriod: occurrenceKey,
            updatedAt: now
        }, {
            type: 'expense-recorded',
            occurredAt: now,
            effectiveDate: renewalDate,
            occurrenceKey,
            note: automatic ? 'Registro automático' : 'Confirmación manual'
        });
        if (updated.autoRenew) {
            updated = appendSubscriptionHistoryEvent({
                ...advanceSubscriptionRenewal(updated, renewalDate),
                updatedAt: now
            }, {
                type: 'renewed',
                occurredAt: now,
                effectiveDate: renewalDate,
                occurrenceKey
            });
        }
        this.subscriptions[index] = updated;
        this.saveData();
        this.render();
        if (!silent) this.app.showToast?.(result?.duplicate ? 'Ese gasto ya existía en Finanzas.' : 'Gasto registrado en Finanzas.');
        return true;
    }

}
