import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import { buildTodayOverview } from '../today-utils.mjs?v=20260729-today-v1';

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
