/**
 * SubscriptionsModule.js
 * Módulo de gestión y seguimiento de suscripciones en LifeCycle.
 * Implementa Fase C (Tandas 11 a 15).
 */

import {
    SUBSCRIPTION_STORAGE_KEY,
    SUBSCRIPTION_CATEGORIES,
    SUBSCRIPTION_CATEGORY_LABELS,
    SUBSCRIPTION_STATUSES,
    calculateNextRenewalDate,
    getDaysUntilRenewal,
    calculateMonthlyEquivalent,
    normalizeSubscription,
    normalizeSubscriptionRegistry,
    migrateWorkanaToSubscriptions,
    addMonthsToDate
} from '../subscription-utils.mjs';

import { normalizeAlertTimes } from '../alert-schedule-utils.mjs';

export class SubscriptionsModule {
    constructor(app) {
        this.app = app;
        this.subscriptions = [];
        this.activeFilter = 'all'; // all, active, expiring, canceled
        this.editingSubscriptionId = null;
        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
    }

    loadData() {
        try {
            const rawStored = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
            const legacyWorkana = localStorage.getItem('projectPulseSubscription');

            let registry = normalizeSubscriptionRegistry(rawStored ? JSON.parse(rawStored) : []);

            // Si hay una suscripción previa de Workana y no fue migrada, migrarla automáticamente
            if (legacyWorkana) {
                const migrationResult = migrateWorkanaToSubscriptions(legacyWorkana, registry);
                if (migrationResult.migrated) {
                    registry.subscriptions = migrationResult.subscriptions;
                }
            }

            this.subscriptions = registry.subscriptions;
            this.syncAlerts();
        } catch (e) {
            console.error('[SubscriptionsModule] Error al cargar suscripciones:', e);
            this.subscriptions = [];
        }
    }

    saveData() {
        const registry = {
            version: 1,
            subscriptions: this.subscriptions.map(s => normalizeSubscription(s))
        };
        localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(registry));

        // Espejar para sincronización en la nube mediante projectPulseSubscription
        // garantizando compatibilidad con clientes existentes y respaldo cloud.
        const workanaSub = this.subscriptions.find(s => s.id === 'sub_workana_plan' || s.name.toLowerCase().includes('workana'));
        if (workanaSub) {
            const legacyMirror = {
                plan: workanaSub.name.replace(/.*\((.*?)\).*/, '$1').replace('Plan ', '') || 'Pro',
                cost: workanaSub.cost,
                cycle: workanaSub.periodMonths,
                startDate: workanaSub.startDate,
                _subscriptionsRegistry: registry
            };
            localStorage.setItem('projectPulseSubscription', JSON.stringify(legacyMirror));
        } else {
            localStorage.setItem('projectPulseSubscription', JSON.stringify({
                plan: null,
                _subscriptionsRegistry: registry
            }));
        }

        this.syncAlerts();
        this.app.triggerDataSync?.('projectPulseSubscription');
    }

    syncAlerts() {
        if (!this.app.alerts) return;

        // Registrar o actualizar alertas de cada suscripción activa
        this.subscriptions.forEach(sub => {
            const alertKey = `sub_${sub.id}`;
            if (sub.status === 'active' && sub.alert?.enabled) {
                this.app.alerts.configs[alertKey] = {
                    enabled: true,
                    time: sub.alert.time || '09:00',
                    times: sub.alert.times || [sub.alert.time || '09:00'],
                    days: [],
                    subscriptionId: sub.id,
                    name: sub.name
                };
            } else if (this.app.alerts.configs[alertKey]) {
                this.app.alerts.configs[alertKey].enabled = false;
            }
        });
    }

    bindEvents() {
        // Botón nueva suscripción
        const newBtn = document.getElementById('btn-new-subscription');
        if (newBtn && !newBtn.dataset.bound) {
            newBtn.dataset.bound = 'true';
            newBtn.addEventListener('click', () => this.openModal());
        }

        // Filtros de estado
        const filterButtons = document.querySelectorAll('[data-subscription-filter]');
        filterButtons.forEach(btn => {
            if (!btn.dataset.bound) {
                btn.dataset.bound = 'true';
                btn.addEventListener('click', () => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeFilter = btn.dataset.subscriptionFilter;
                    this.renderList();
                });
            }
        });

        // Formulario del modal
        const form = document.getElementById('subscription-form');
        if (form && !form.dataset.bound) {
            form.dataset.bound = 'true';
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSubscriptionFromModal();
            });
        }

        // Cerrar modal
        const closeButtons = document.querySelectorAll('[data-subscription-modal-close]');
        closeButtons.forEach(btn => {
            if (!btn.dataset.bound) {
                btn.dataset.bound = 'true';
                btn.addEventListener('click', () => this.closeModal());
            }
        });

        // Toggle alert time inputs
        const alertCheck = document.getElementById('sub-alert-enabled');
        if (alertCheck && !alertCheck.dataset.bound) {
            alertCheck.dataset.bound = 'true';
            alertCheck.addEventListener('change', () => {
                const wrap = document.getElementById('sub-alert-settings');
                wrap?.classList.toggle('hidden', !alertCheck.checked);
            });
        }
    }

    render() {
        this.renderSummary();
        this.renderList();
    }

    renderSummary() {
        const totalSubsEl = document.getElementById('subs-summary-total');
        const monthlyUsdEl = document.getElementById('subs-summary-monthly-usd');
        const monthlyArsEl = document.getElementById('subs-summary-monthly-ars');
        const upcomingCountEl = document.getElementById('subs-summary-upcoming');

        const activeSubs = this.subscriptions.filter(s => s.status === 'active');
        const totalCount = this.subscriptions.length;

        // Calcular costo mensualizado en USD
        let totalMonthlyUsd = 0;
        let totalMonthlyArs = 0;
        const rate = Number(this.app.currencyRate) || 0;

        activeSubs.forEach(sub => {
            const monthlyEquiv = calculateMonthlyEquivalent(sub.cost, sub.periodMonths);
            if (sub.currency === 'ARS') {
                totalMonthlyArs += monthlyEquiv;
                if (rate > 0) totalMonthlyUsd += (monthlyEquiv / rate);
            } else {
                totalMonthlyUsd += monthlyEquiv;
                if (rate > 0) totalMonthlyArs += (monthlyEquiv * rate);
            }
        });

        // Renovaciones próximas (en los próximos 7 días)
        const upcomingCount = activeSubs.filter(s => {
            const days = getDaysUntilRenewal(s.nextRenewalDate);
            return days >= 0 && days <= 7;
        }).length;

        if (totalSubsEl) totalSubsEl.textContent = totalCount;
        if (monthlyUsdEl) monthlyUsdEl.textContent = `$${totalMonthlyUsd.toFixed(2)} USD`;
        if (monthlyArsEl) {
            monthlyArsEl.textContent = totalMonthlyArs > 0
                ? `$${Math.round(totalMonthlyArs).toLocaleString('es-AR')} ARS`
                : '—';
        }
        if (upcomingCountEl) {
            upcomingCountEl.textContent = upcomingCount;
            upcomingCountEl.style.color = upcomingCount > 0 ? 'var(--status-yellow)' : 'var(--text-primary)';
        }
    }

    getFilteredSubscriptions() {
        return this.subscriptions.filter(sub => {
            if (this.activeFilter === 'all') return true;
            if (this.activeFilter === 'active') return sub.status === 'active';
            if (this.activeFilter === 'expiring') {
                const days = getDaysUntilRenewal(sub.nextRenewalDate);
                return sub.status === 'active' && days >= 0 && days <= 7;
            }
            if (this.activeFilter === 'canceled') return sub.status === 'canceled' || sub.status === 'paused';
            return true;
        });
    }

    renderList() {
        const container = document.getElementById('subscriptions-list');
        if (!container) return;

        const filtered = this.getFilteredSubscriptions();
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                    <i class="ph ph-receipt" style="font-size: 2.5rem; margin-bottom: 0.75rem; display: block; opacity: 0.6;"></i>
                    <p>No hay suscripciones en esta vista.</p>
                    <button type="button" class="btn btn-primary" onclick="window.app.subscriptions?.openModal()" style="margin-top: 1rem;">
                        <i class="ph ph-plus"></i> Nueva Suscripción
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(sub => {
            const daysLeft = getDaysUntilRenewal(sub.nextRenewalDate);
            const monthlyEquiv = calculateMonthlyEquivalent(sub.cost, sub.periodMonths);
            const categoryLabel = SUBSCRIPTION_CATEGORY_LABELS[sub.category] || 'Otros';

            let badgeClass = 'badge';
            let badgeText = 'Activa';
            let borderColor = 'var(--surface-border)';

            if (sub.status === 'canceled') {
                badgeClass = 'badge red';
                badgeText = daysLeft >= 0 ? `Cancelada (vigente ${daysLeft}d)` : 'Vencida';
                borderColor = 'rgba(239, 68, 68, 0.3)';
            } else if (sub.status === 'paused') {
                badgeClass = 'badge yellow';
                badgeText = 'Pausada';
            } else {
                if (daysLeft < 0) {
                    badgeClass = 'badge red';
                    badgeText = 'Venció hace ' + Math.abs(daysLeft) + 'd';
                    borderColor = 'var(--status-red)';
                } else if (daysLeft <= 2) {
                    badgeClass = 'badge red';
                    badgeText = daysLeft === 0 ? '¡Vence hoy!' : `Vence en ${daysLeft}d`;
                    borderColor = 'var(--status-red)';
                } else if (daysLeft <= 7) {
                    badgeClass = 'badge yellow';
                    badgeText = `Renueva en ${daysLeft}d`;
                    borderColor = 'var(--status-yellow)';
                } else {
                    badgeClass = 'badge green';
                    badgeText = `Renueva en ${daysLeft}d`;
                }
            }

            const periodText = sub.periodMonths === 1
                ? 'mes'
                : (sub.periodMonths === 12 ? 'año' : `${sub.periodMonths} meses`);

            return `
                <div class="subscription-card" data-sub-id="${sub.id}" style="border: 1px solid ${borderColor}; border-radius: 12px; background: var(--surface-inset); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; transition: transform 0.15s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">${categoryLabel}</span>
                            <h3 style="margin: 2px 0 0 0; font-size: 1.15rem; color: var(--text-primary); font-weight: 700;">${sub.name}</h3>
                        </div>
                        <span class="${badgeClass}">${badgeText}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
                        <div>
                            <strong style="font-size: 1.35rem; color: var(--text-primary);">${sub.currency === 'USD' ? '$' : 'ARS$'}${sub.cost.toFixed(2)}</strong>
                            <span style="font-size: 0.82rem; color: var(--text-secondary);"> / ${periodText}</span>
                        </div>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">~${sub.currency === 'USD' ? '$' : 'ARS$'}${monthlyEquiv.toFixed(2)}/mes</span>
                    </div>

                    <div style="font-size: 0.82rem; color: var(--text-secondary); border-top: 1px solid var(--surface-border); padding-top: 0.75rem; display: flex; justify-content: space-between;">
                        <span>Próxima renovación: <strong style="color: var(--text-primary);">${sub.nextRenewalDate}</strong></span>
                        <span>${sub.autoRenew ? '<i class="ph ph-arrows-clockwise" title="Renovación automática"></i> Auto' : 'Manual'}</span>
                    </div>

                    <div style="display: flex; gap: 6px; margin-top: 4px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="window.app.subscriptions?.recordExpense('${sub.id}')" title="Registrar gasto de este ciclo en Finanzas" style="padding: 5px 9px; font-size: 0.78rem;">
                            <i class="ph ph-receipt"></i> Gasto
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="window.app.subscriptions?.openModal('${sub.id}')" title="Editar suscripción" style="padding: 5px 9px; font-size: 0.78rem;">
                            <i class="ph ph-pencil"></i> Editar
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="window.app.subscriptions?.toggleAutoRenew('${sub.id}')" title="${sub.autoRenew ? 'Desactivar renovación automática' : 'Activar renovación automática'}" style="padding: 5px 9px; font-size: 0.78rem;">
                            <i class="ph ${sub.autoRenew ? 'ph-pause' : 'ph-play'}"></i>
                        </button>
                        <button type="button" class="btn-icon-danger" onclick="window.app.subscriptions?.deleteSubscription('${sub.id}')" title="Eliminar" style="padding: 5px 8px; font-size: 0.78rem;">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    openModal(subscriptionId = null) {
        this.editingSubscriptionId = subscriptionId;
        const modal = document.getElementById('subscription-modal');
        const titleEl = document.getElementById('subscription-modal-title');
        if (!modal) return;

        const sub = subscriptionId
            ? this.subscriptions.find(s => s.id === subscriptionId)
            : null;

        if (titleEl) {
            titleEl.textContent = sub ? 'Editar Suscripción' : 'Nueva Suscripción';
        }

        document.getElementById('sub-name').value = sub?.name || '';
        document.getElementById('sub-category').value = sub?.category || 'software';
        document.getElementById('sub-cost').value = sub?.cost ?? '';
        document.getElementById('sub-currency').value = sub?.currency || 'USD';
        document.getElementById('sub-period').value = sub?.periodMonths || 1;
        document.getElementById('sub-start-date').value = sub?.startDate || new Date().toISOString().slice(0, 10);
        document.getElementById('sub-renewal-date').value = sub?.nextRenewalDate || '';
        document.getElementById('sub-autorenew').checked = sub ? sub.autoRenew : true;
        document.getElementById('sub-auto-record-expense').checked = sub ? sub.autoRecordExpense : false;
        document.getElementById('sub-notes').value = sub?.notes || '';

        const alertEnabled = sub ? sub.alert?.enabled !== false : true;
        document.getElementById('sub-alert-enabled').checked = alertEnabled;
        document.getElementById('sub-alert-days').value = sub?.alert?.daysBefore ?? 3;
        document.getElementById('sub-alert-time').value = sub?.alert?.time || '09:00';

        const alertWrap = document.getElementById('sub-alert-settings');
        alertWrap?.classList.toggle('hidden', !alertEnabled);

        modal.classList.remove('hidden');
    }

    closeModal() {
        const modal = document.getElementById('subscription-modal');
        modal?.classList.add('hidden');
        this.editingSubscriptionId = null;
    }

    saveSubscriptionFromModal() {
        const name = document.getElementById('sub-name')?.value.trim();
        const category = document.getElementById('sub-category')?.value;
        const cost = parseFloat(document.getElementById('sub-cost')?.value) || 0;
        const currency = document.getElementById('sub-currency')?.value;
        const periodMonths = parseInt(document.getElementById('sub-period')?.value, 10) || 1;
        const startDate = document.getElementById('sub-start-date')?.value;
        let nextRenewalDate = document.getElementById('sub-renewal-date')?.value;
        const autoRenew = document.getElementById('sub-autorenew')?.checked;
        const autoRecordExpense = document.getElementById('sub-auto-record-expense')?.checked;
        const notes = document.getElementById('sub-notes')?.value.trim();

        if (!name) {
            this.app.showToast?.('Por favor ingresá un nombre para la suscripción.');
            return;
        }

        if (!nextRenewalDate) {
            nextRenewalDate = calculateNextRenewalDate(startDate, periodMonths);
        }

        const alertEnabled = document.getElementById('sub-alert-enabled')?.checked;
        const alertDaysBefore = parseInt(document.getElementById('sub-alert-days')?.value, 10) || 3;
        const alertTime = document.getElementById('sub-alert-time')?.value || '09:00';
        const normalizedAlert = normalizeAlertTimes(alertTime, '09:00');

        const existingSub = this.editingSubscriptionId
            ? this.subscriptions.find(s => s.id === this.editingSubscriptionId)
            : null;

        const candidate = normalizeSubscription({
            id: this.editingSubscriptionId || undefined,
            name,
            category,
            cost,
            currency,
            periodMonths,
            startDate,
            nextRenewalDate,
            autoRenew,
            status: existingSub ? existingSub.status : 'active',
            paymentMethod: existingSub?.paymentMethod || 'Tarjeta',
            notes,
            autoRecordExpense,
            lastExpenseRecordedPeriod: existingSub?.lastExpenseRecordedPeriod || null,
            alert: {
                enabled: alertEnabled,
                time: normalizedAlert.time,
                times: normalizedAlert.times,
                daysBefore: alertDaysBefore
            },
            history: existingSub?.history || []
        });

        if (this.editingSubscriptionId) {
            const idx = this.subscriptions.findIndex(s => s.id === this.editingSubscriptionId);
            if (idx >= 0) {
                this.subscriptions[idx] = candidate;
            }
        } else {
            this.subscriptions.unshift(candidate);
        }

        this.saveData();
        this.closeModal();
        this.render();
        this.app.showToast?.(this.editingSubscriptionId ? 'Suscripción actualizada.' : 'Suscripción creada.');
    }

    async toggleAutoRenew(subscriptionId) {
        const sub = this.subscriptions.find(s => s.id === subscriptionId);
        if (!sub) return;

        sub.autoRenew = !sub.autoRenew;
        if (!sub.autoRenew) {
            // Nota explicativa conforme a Tanda 12: distinguir registro en LifeCycle de cancelación externa
            this.app.showToast?.('Renovación automática desactivada en LifeCycle. Recordá cancelarla en el proveedor externo si deseás darla de baja.');
        } else {
            this.app.showToast?.('Renovación automática activada.');
        }

        this.saveData();
        this.render();
    }

    async deleteSubscription(subscriptionId) {
        const sub = this.subscriptions.find(s => s.id === subscriptionId);
        if (!sub) return;

        const confirmed = await this.app.confirmAction?.({
            title: '¿Eliminar suscripción?',
            message: `¿Seguro que deseás eliminar "${sub.name}"? Los gastos ya registrados en Finanzas no se borrarán.`,
            tone: 'danger',
            confirmLabel: 'Eliminar'
        });

        if (!confirmed) return;

        this.subscriptions = this.subscriptions.filter(s => s.id !== subscriptionId);
        this.saveData();
        this.render();
        this.app.showToast?.('Suscripción eliminada.');
    }

    recordExpense(subscriptionId) {
        const sub = this.subscriptions.find(s => s.id === subscriptionId);
        if (!sub) return;

        if (!this.app.finanzas) {
            this.app.showToast?.('El módulo de Finanzas no está disponible.');
            return;
        }

        const periodKey = `${sub.id}_${sub.nextRenewalDate}`;
        if (sub.lastExpenseRecordedPeriod === periodKey) {
            this.app.showToast?.('El gasto correspondiente a esta renovación ya fue registrado en Finanzas.');
            return;
        }

        const success = this.app.finanzas.recordSubscriptionExpense({
            subscriptionId: sub.id,
            name: sub.name,
            amount: sub.cost,
            currency: sub.currency,
            date: new Date().toISOString().slice(0, 10),
            period: `Renovación ${sub.nextRenewalDate}`
        });

        if (success) {
            sub.lastExpenseRecordedPeriod = periodKey;
            sub.history = sub.history || [];
            sub.history.push({
                date: new Date().toISOString().slice(0, 10),
                cost: sub.cost,
                currency: sub.currency,
                note: `Gasto registrado para el periodo ${sub.nextRenewalDate}`
            });
            this.saveData();
            this.render();
            this.app.showToast?.('Gasto registrado con éxito en Finanzas.');
        }
    }
}
