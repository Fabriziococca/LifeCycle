import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import { buildTodayOverview } from '../today-utils.mjs?v=20260729-today-v1';
import {
    normalizeTodayPreferences,
    TODAY_QUICK_ACTIONS
} from '../product-preferences.mjs?v=20260729-product-preferences';

const SOURCE_LABELS = Object.freeze({
    tareas: 'Tareas',
    projects_tasks: 'Tarea de proyecto',
    projects: 'Proyectos',
    workana: 'Proyectos',
    custom_tracker: 'Seguimiento',
    hygiene: 'Higiene',
    robot: 'Higiene',
    grooming: 'Cuidado',
    lenses: 'Lentes',
    vehicle: 'Vehículo',
    gym: 'Gimnasio'
});

export class TodayModule {
    constructor(appController) {
        this.app = appController;
        this.root = document.getElementById('hoy-section');
        this.currentItems = [];
        this.setupListeners();
    }

    setupListeners() {
        this.root?.addEventListener('click', event => {
            const action = event.target.closest('[data-today-action]');
            if (!action) return;

            if (action.dataset.todayAction === 'new-task') {
                this.app.tareas?.openTaskCapture({ quick: true });
                return;
            }
            if (action.dataset.todayAction === 'configure-quick-actions') {
                this.openQuickActionSettings();
                return;
            }
            if (action.dataset.todayAction === 'quick-action') {
                this.executeQuickAction(action.dataset.quickActionId);
                return;
            }

            const index = Number(action.dataset.todayItemIndex);
            const item = Number.isInteger(index) ? this.currentItems[index] : null;
            if (!item) return;

            if (action.dataset.todayAction === 'complete') {
                this.app.notificationsCenter?.completeTask(item.module, item.id, item);
                return;
            }

            if (action.dataset.todayAction === 'open') {
                const opened = this.app.notificationsCenter?.openItem(item);
                if (!opened) {
                    this.app.showToast?.(
                        'No se pudo abrir ese elemento desde el resumen.',
                        { tone: 'warning' }
                    );
                }
            }
        });
    }

    getQuickActions() {
        const preferences = normalizeTodayPreferences(
            this.app.customTrackers?.registry?.todayPreferences
        );
        return preferences.quickActions
            .filter(actionId => {
                const action = TODAY_QUICK_ACTIONS[actionId];
                if (!action) return false;
                return (
                    !action.moduleId
                    || this.app.customTrackers?.isModuleVisible(action.moduleId)
                );
            })
            .map(actionId => ({
                id: actionId,
                ...TODAY_QUICK_ACTIONS[actionId]
            }));
    }

    openQuickActionSettings() {
        document.getElementById('profile-btn')?.click();
        this.app.activateProfileTab?.('modulos', { smooth: true });
        requestAnimationFrame(() => {
            document.getElementById('today-actions-manager')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    }

    activateActionModule(moduleId) {
        if (!moduleId) return true;
        if (!this.app.customTrackers?.isModuleVisible(moduleId)) {
            this.app.showToast?.(
                'Ese módulo está oculto. Podés recuperarlo desde Perfil → Módulos.',
                { tone: 'warning' }
            );
            return false;
        }
        return this.app.activateSection?.(moduleId, { smooth: true }) === true;
    }

    executeQuickAction(actionId) {
        const action = TODAY_QUICK_ACTIONS[actionId];
        if (!action || !this.activateActionModule(action.moduleId)) return false;

        if (actionId === 'new_project') {
            requestAnimationFrame(() => {
                const input = document.getElementById('clientName');
                input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input?.focus({ preventScroll: true });
            });
            return true;
        }

        if (actionId === 'add_income') {
            document.getElementById('btnFinTabIncome')?.click();
            document.getElementById('btnOpenFinanzasModal')?.click();
            return true;
        }

        if (actionId === 'add_expense') {
            document.getElementById('btnFinTabExpense')?.click();
            document.getElementById('btnOpenFinanzasExpenseModal')?.click();
            return true;
        }

        if (actionId === 'open_gym') {
            document.querySelector('[data-gym-tab="sessions"]')?.click();
            requestAnimationFrame(() => {
                const startButton = document.getElementById('start-session-btn');
                startButton?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                startButton?.focus({ preventScroll: true });
            });
            return true;
        }

        if (actionId === 'new_tracker') {
            document.getElementById('profile-btn')?.click();
            this.app.activateProfileTab?.('seguimientos', { smooth: true });
            requestAnimationFrame(() => {
                document.getElementById('btn-new-custom-tracker')?.click();
            });
            return true;
        }

        return false;
    }

    getDateLabel() {
        const formatted = new Intl.DateTimeFormat('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'America/Argentina/Buenos_Aires'
        }).format(new Date());
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    getCompletionLabel(item) {
        const labels = {
            tareas: 'Completar',
            projects_tasks: 'Completar',
            robot: 'Marcar limpio',
            workana: 'Renovar ciclo'
        };
        return labels[item.module] || 'Registrar';
    }

    renderItem(item) {
        const sourceLabel = SOURCE_LABELS[item.module] || 'LifeCycle';
        const safeName = escapeHtml(item.name || 'Pendiente');
        const safeDescription = escapeHtml(item.desc || '');
        const safeIcon = escapeHtml(item.icon || 'ph-bell');
        const isCompletable = this.app.notificationsCenter?.isItemCompletable(item) === true;
        const urgencyClass = item.urgency === 'muy_urgente'
            ? ' is-very-urgent'
            : (item.urgency === 'urgente' ? ' is-urgent' : '');

        return `
            <article class="today-item${urgencyClass}">
                <span class="today-item-icon" aria-hidden="true">
                    <i class="ph ${safeIcon}"></i>
                </span>
                <div class="today-item-copy">
                    <span class="today-item-source">${escapeHtml(sourceLabel)}</span>
                    <h4>${safeName}</h4>
                    ${safeDescription ? `<p>${safeDescription}</p>` : ''}
                </div>
                <div class="today-item-actions">
                    <button
                        type="button"
                        class="today-action today-action-secondary"
                        data-today-action="open"
                        data-today-item-index="${item.sourceIndex}"
                    >
                        Abrir
                    </button>
                    ${isCompletable ? `
                        <button
                            type="button"
                            class="today-action today-action-primary"
                            data-today-action="complete"
                            data-today-item-index="${item.sourceIndex}"
                        >
                            <i class="ph ph-check" aria-hidden="true"></i>
                            ${this.getCompletionLabel(item)}
                        </button>
                    ` : ''}
                </div>
            </article>
        `;
    }

    renderGroup(group) {
        if (group.items.length === 0) return '';

        return `
            <section class="today-group" aria-labelledby="today-group-${group.id}">
                <div class="today-group-heading">
                    <span class="today-group-icon" aria-hidden="true">
                        <i class="ph ${group.icon}"></i>
                    </span>
                    <div>
                        <h3 id="today-group-${group.id}">${group.label}</h3>
                        <p>${group.description}</p>
                    </div>
                    <span class="today-group-count">${group.items.length}</span>
                </div>
                <div class="today-items">
                    ${group.items.map(item => this.renderItem(item)).join('')}
                </div>
            </section>
        `;
    }

    renderQuickActions() {
        const actions = this.getQuickActions();
        return `
            <section class="today-quick-panel" aria-labelledby="today-quick-actions-title">
                <div class="today-quick-heading">
                    <div>
                        <span class="today-quick-kicker">A un toque</span>
                        <h3 id="today-quick-actions-title">Acciones rápidas</h3>
                    </div>
                    <button
                        type="button"
                        class="today-quick-configure"
                        data-today-action="configure-quick-actions"
                    >
                        <i class="ph ph-sliders-horizontal" aria-hidden="true"></i>
                        Personalizar
                    </button>
                </div>
                ${actions.length > 0 ? `
                    <div class="today-quick-grid">
                        ${actions.map(action => `
                            <button
                                type="button"
                                class="today-quick-card"
                                data-today-action="quick-action"
                                data-quick-action-id="${action.id}"
                            >
                                <span aria-hidden="true"><i class="ph ${action.icon}"></i></span>
                                <strong>${escapeHtml(action.label)}</strong>
                                <small>${escapeHtml(action.description)}</small>
                            </button>
                        `).join('')}
                    </div>
                ` : `
                    <button
                        type="button"
                        class="today-quick-empty"
                        data-today-action="configure-quick-actions"
                    >
                        Elegí los accesos que querés ver en esta pantalla.
                    </button>
                `}
            </section>
        `;
    }

    render(items = null) {
        if (!this.root) return;

        this.currentItems = Array.isArray(items)
            ? items
            : (this.app.notificationsCenter?.getOverdueItems() || []);
        const overview = buildTodayOverview(this.currentItems);
        const allClear = overview.total === 0;

        this.root.innerHTML = `
            <div class="today-hero">
                <div>
                    <span class="today-eyebrow">Tu foco diario</span>
                    <h2>${allClear ? 'Todo bajo control' : 'Lo importante, en un solo lugar'}</h2>
                    <p class="today-date">${escapeHtml(this.getDateLabel())}</p>
                    <p class="today-intro">
                        ${allClear
                            ? 'No hay tareas urgentes, vencimientos ni seguimientos atrasados.'
                            : 'Priorizamos lo que requiere atención para que no tengas que recorrer cada módulo.'}
                    </p>
                </div>
                <button type="button" class="btn btn-primary today-new-task" data-today-action="new-task">
                    <i class="ph ph-plus-circle" aria-hidden="true"></i>
                    Nueva tarea
                </button>
            </div>

            ${this.renderQuickActions()}

            <div class="today-summary" aria-label="Resumen de pendientes">
                <article>
                    <span class="today-summary-icon tasks"><i class="ph ph-check-square"></i></span>
                    <div>
                        <strong>${overview.counts.tasks}</strong>
                        <span>Tareas prioritarias</span>
                    </div>
                </article>
                <article>
                    <span class="today-summary-icon projects"><i class="ph ph-briefcase"></i></span>
                    <div>
                        <strong>${overview.counts.projects}</strong>
                        <span>Proyectos y fechas</span>
                    </div>
                </article>
                <article>
                    <span class="today-summary-icon followups"><i class="ph ph-calendar-check"></i></span>
                    <div>
                        <strong>${overview.counts.followups}</strong>
                        <span>Seguimientos</span>
                    </div>
                </article>
            </div>

            ${allClear ? `
                <div class="today-empty">
                    <span><i class="ph ph-check-circle"></i></span>
                    <h3>Estás al día</h3>
                    <p>Podés continuar con tus módulos o anotar una tarea nueva sin perder el contexto.</p>
                </div>
            ` : `
                <div class="today-groups">
                    ${overview.groups.map(group => this.renderGroup(group)).join('')}
                </div>
            `}
        `;
    }
}
