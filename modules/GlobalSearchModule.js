import {
    CUSTOM_TRACKER_SECTIONS
} from '../custom-tracker-utils.mjs?v=20260730-global-search';
import {
    searchLifeCycleItems
} from '../search-utils.mjs?v=20260730-global-search';

const GROUP_META = Object.freeze({
    tracker: Object.freeze({ label: 'Tarjetas', icon: 'ph-stack' }),
    task: Object.freeze({ label: 'Tareas', icon: 'ph-check-square' }),
    project: Object.freeze({ label: 'Proyectos', icon: 'ph-briefcase' })
});

const URGENCY_LABELS = Object.freeze({
    muy_urgente: 'Muy urgente',
    urgente: 'Urgente',
    no_urgente: 'No urgente'
});

function uniqueSearchId(kind, ...parts) {
    return [kind, ...parts.map(part => String(part ?? ''))].join(':');
}

function getProjectDisplayName(project) {
    const client = String(project?.client || '').trim();
    const name = String(project?.project || '').trim();
    return client && name ? `${client} — ${name}` : (name || client || 'Proyecto sin nombre');
}

export class GlobalSearchModule {
    constructor(appController) {
        this.app = appController;
        this.modal = document.getElementById('global-search-modal');
        this.input = document.getElementById('global-search-input');
        this.resultsRoot = document.getElementById('global-search-results');
        this.openButton = document.getElementById('global-search-btn');
        this.closeButton = document.getElementById('global-search-close');
        this.returnFocus = null;
        this.results = [];
        this.activeIndex = -1;

        this.handleGlobalKeydown = this.handleGlobalKeydown.bind(this);
        this.handleInputKeydown = this.handleInputKeydown.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleResultsClick = this.handleResultsClick.bind(this);
        this.init();
    }

    init() {
        if (!this.modal || !this.input || !this.resultsRoot || !this.openButton) return;

        this.openButton.addEventListener('click', () => this.open());
        this.closeButton?.addEventListener('click', () => this.close());
        this.input.addEventListener('input', this.handleInput);
        this.input.addEventListener('keydown', this.handleInputKeydown);
        this.resultsRoot.addEventListener('click', this.handleResultsClick);
        this.modal.addEventListener('click', event => {
            if (event.target === this.modal) this.close();
        });
        document.addEventListener('keydown', this.handleGlobalKeydown);
        this.renderIdleState();
    }

    open() {
        if (!this.modal) return;
        this.returnFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : this.openButton;
        this.modal.classList.remove('hidden');
        document.body.classList.add('global-search-open');
        this.input.value = '';
        this.results = [];
        this.activeIndex = -1;
        this.renderIdleState();
        requestAnimationFrame(() => this.input.focus());
    }

    close({ restoreFocus = true } = {}) {
        if (!this.modal || this.modal.classList.contains('hidden')) return;
        this.modal.classList.add('hidden');
        document.body.classList.remove('global-search-open');
        this.input.value = '';
        this.results = [];
        this.activeIndex = -1;
        if (restoreFocus) {
            const target = this.returnFocus?.isConnected
                ? this.returnFocus
                : this.openButton;
            requestAnimationFrame(() => target?.focus());
        }
        this.returnFocus = null;
    }

    handleGlobalKeydown(event) {
        const isShortcut = (
            (event.ctrlKey || event.metaKey)
            && event.key.toLocaleLowerCase('es') === 'k'
        );
        if (isShortcut) {
            event.preventDefault();
            this.modal?.classList.contains('hidden') ? this.open() : this.close();
            return;
        }
        if (event.key === 'Escape' && !this.modal?.classList.contains('hidden')) {
            event.preventDefault();
            this.close();
        }
    }

    handleInput() {
        const query = this.input.value.trim();
        if (!query) {
            this.results = [];
            this.activeIndex = -1;
            this.renderIdleState();
            return;
        }

        this.results = searchLifeCycleItems(this.buildIndex(), query, { limit: 36 });
        this.activeIndex = this.results.length > 0 ? 0 : -1;
        this.renderResults(query);
    }

    handleInputKeydown(event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (this.results.length === 0) return;
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            this.activeIndex = (
                this.activeIndex + direction + this.results.length
            ) % this.results.length;
            this.updateActiveResult();
            return;
        }

        if (event.key === 'Enter' && this.activeIndex >= 0) {
            event.preventDefault();
            this.activateResult(this.results[this.activeIndex]);
        }
    }

    handleResultsClick(event) {
        const button = event.target.closest('[data-search-result-index]');
        if (!button) return;
        const result = this.results[Number(button.dataset.searchResultIndex)];
        if (result) this.activateResult(result);
    }

    buildIndex() {
        return [
            ...this.getTrackerItems(),
            ...this.getVehicleItems(),
            ...this.getTaskItems(),
            ...this.getProjectItems()
        ];
    }

    getTrackerItems() {
        const trackers = this.app.customTrackers?.registry?.trackers || [];
        return trackers
            .filter(tracker => !tracker.deleted)
            .map(tracker => {
                const section = CUSTOM_TRACKER_SECTIONS[tracker.section];
                const subsection = section?.subsections?.[tracker.subsection];
                return {
                    id: uniqueSearchId('tracker', tracker.id),
                    kind: 'tracker',
                    title: tracker.name,
                    subtitle: `${section?.label || 'Tarjeta'} · ${subsection?.label || 'General'}${tracker.archived ? ' · Archivada' : ''}`,
                    keywords: [
                        section?.label,
                        subsection?.label,
                        tracker.actionLabel,
                        tracker.archived ? 'archivada' : 'activa'
                    ],
                    target: {
                        trackerId: tracker.id,
                        sectionKey: tracker.section,
                        subsection: tracker.subsection,
                        sectionId: section?.mainSectionId,
                        archived: tracker.archived === true
                    }
                };
            });
    }

    getTaskItems() {
        const tasksModule = this.app.tareas;
        const regularTasks = (tasksModule?.tasks || []).map(task => ({
            id: uniqueSearchId('task', 'regular', task.id),
            kind: 'task',
            title: task.text || 'Tarea sin descripción',
            subtitle: `${task.category || 'Sin carpeta'} · ${task.completed ? 'Completada' : 'Pendiente'}`,
            keywords: [
                task.category,
                task.completed ? 'completada' : 'pendiente',
                URGENCY_LABELS[task.urgency] || task.urgency
            ],
            target: {
                taskId: task.id,
                category: task.category,
                projectId: null
            }
        }));

        const freelanceTasks = [];
        const seenProjects = new Set();
        for (const project of tasksModule?.getFreelanceProjects?.() || []) {
            const projectId = String(project.id);
            if (seenProjects.has(projectId)) continue;
            seenProjects.add(projectId);
            for (const task of project.tasks || []) {
                freelanceTasks.push({
                    id: uniqueSearchId('task', 'freelance', projectId, task.id),
                    kind: 'task',
                    title: task.text || 'Tarea sin descripción',
                    subtitle: `Freelance · ${getProjectDisplayName(project)} · ${task.completed ? 'Completada' : 'Pendiente'}`,
                    keywords: [
                        'Freelance',
                        project.client,
                        project.project,
                        task.completed ? 'completada' : 'pendiente',
                        URGENCY_LABELS[task.urgency] || task.urgency
                    ],
                    target: {
                        taskId: task.id,
                        category: 'Freelance',
                        projectId: project.id
                    }
                });
            }
        }
        return [...regularTasks, ...freelanceTasks];
    }

    getVehicleItems() {
        return (this.app.vehicle?.cards?.getCards?.() || []).map(card => ({
            id: uniqueSearchId('tracker', 'vehicle', card.id),
            kind: 'tracker',
            title: card.name,
            subtitle: `Vehículo · ${card.section === 'documents' ? 'Documentación' : 'Mantenimiento'}${card.archived ? ' · Archivada' : ''}`,
            keywords: [
                'vehículo',
                card.type,
                card.actionLabel,
                card.archived ? 'archivada' : 'activa'
            ],
            target: {
                vehicleCardId: card.id,
                vehicleTab: card.section === 'documents' ? 'docs' : 'maint',
                archived: card.archived === true
            }
        }));
    }

    getProjectItems() {
        const projectsModule = this.app.projects;
        const mapProject = (project, collection) => ({
            id: uniqueSearchId('project', collection, project.id),
            kind: 'project',
            title: getProjectDisplayName(project),
            subtitle: collection === 'history'
                ? 'Proyecto histórico · Cobrado'
                : 'Proyecto activo',
            keywords: [
                project.client,
                project.project,
                project.statusNote,
                project.source,
                collection === 'history' ? 'historial cobrado' : 'activo'
            ],
            target: {
                projectId: project.id,
                collection
            }
        });

        return [
            ...(projectsModule?.projects || []).map(project => mapProject(project, 'active')),
            ...(projectsModule?.history || []).map(project => mapProject(project, 'history'))
        ];
    }

    renderIdleState() {
        const counts = this.buildIndex().reduce((result, item) => {
            result[item.kind] = (result[item.kind] || 0) + 1;
            return result;
        }, {});
        this.resultsRoot.innerHTML = '';

        const state = document.createElement('div');
        state.className = 'global-search-state';
        const icon = document.createElement('i');
        icon.className = 'ph ph-magnifying-glass';
        const title = document.createElement('strong');
        title.textContent = 'Buscá sin salir de lo que estabas haciendo';
        const help = document.createElement('p');
        help.textContent = 'Encontrá tarjetas, tareas y proyectos. La búsqueda ocurre únicamente en este dispositivo.';
        const summary = document.createElement('div');
        summary.className = 'global-search-counts';
        [
            ['tracker', 'tarjetas'],
            ['task', 'tareas'],
            ['project', 'proyectos']
        ].forEach(([kind, label]) => {
            const badge = document.createElement('span');
            badge.textContent = `${counts[kind] || 0} ${label}`;
            summary.appendChild(badge);
        });
        state.append(icon, title, help, summary);
        this.resultsRoot.appendChild(state);
        this.input.removeAttribute('aria-activedescendant');
    }

    renderResults(query) {
        this.resultsRoot.innerHTML = '';
        if (this.results.length === 0) {
            const state = document.createElement('div');
            state.className = 'global-search-state';
            const icon = document.createElement('i');
            icon.className = 'ph ph-magnifying-glass-minus';
            const title = document.createElement('strong');
            title.textContent = `No encontramos “${query}”`;
            const help = document.createElement('p');
            help.textContent = 'Probá con el nombre de una tarjeta, una tarea, un cliente o un proyecto.';
            state.append(icon, title, help);
            this.resultsRoot.appendChild(state);
            this.input.removeAttribute('aria-activedescendant');
            return;
        }

        for (const kind of Object.keys(GROUP_META)) {
            const groupedResults = this.results
                .map((result, index) => ({ result, index }))
                .filter(entry => entry.result.kind === kind);
            if (groupedResults.length === 0) continue;

            const group = document.createElement('section');
            group.className = 'global-search-group';
            const heading = document.createElement('h3');
            const headingIcon = document.createElement('i');
            headingIcon.className = `ph ${GROUP_META[kind].icon}`;
            const headingText = document.createElement('span');
            headingText.textContent = GROUP_META[kind].label;
            const count = document.createElement('span');
            count.className = 'global-search-group-count';
            count.textContent = String(groupedResults.length);
            heading.append(headingIcon, headingText, count);
            group.appendChild(heading);

            groupedResults.forEach(({ result, index }) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.id = `global-search-result-${index}`;
                button.className = 'global-search-result';
                button.dataset.searchResultIndex = String(index);
                button.setAttribute('role', 'option');
                button.setAttribute('aria-selected', String(index === this.activeIndex));

                const text = document.createElement('span');
                text.className = 'global-search-result-copy';
                const title = document.createElement('strong');
                title.textContent = result.title;
                const subtitle = document.createElement('span');
                subtitle.textContent = result.subtitle;
                text.append(title, subtitle);

                const arrow = document.createElement('i');
                arrow.className = 'ph ph-arrow-right';
                button.append(text, arrow);
                group.appendChild(button);
            });
            this.resultsRoot.appendChild(group);
        }
        this.updateActiveResult({ scroll: false });
    }

    updateActiveResult({ scroll = true } = {}) {
        this.resultsRoot.querySelectorAll('[data-search-result-index]').forEach(button => {
            const selected = Number(button.dataset.searchResultIndex) === this.activeIndex;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-selected', String(selected));
            if (selected) {
                this.input.setAttribute('aria-activedescendant', button.id);
                if (scroll) button.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    activateResult(result) {
        if (!result) return;
        this.close({ restoreFocus: false });

        if (result.kind === 'tracker') {
            this.openTracker(result.target);
        } else if (result.kind === 'task') {
            this.openTask(result.target);
        } else if (result.kind === 'project') {
            this.openProject(result.target);
        }
    }

    openTracker(target) {
        if (target.vehicleCardId) {
            if (target.archived) {
                if (this.app.customTrackers) {
                    this.app.customTrackers.activeCategoryFilter = 'vehicle';
                }
                this.app.saveUiState?.({ trackerManagerFilter: 'vehicle' });
                this.app.openProfileTab?.('seguimientos');
                this.deferHighlight('vehicleCardId', target.vehicleCardId);
                return;
            }
            this.app.vehicle?.activateVehicleTab?.(target.vehicleTab, {
                persist: true,
                render: false
            });
            this.app.activateSection?.('vehiculo-section', { render: true });
            this.deferHighlight('vehicleCardId', target.vehicleCardId);
            return;
        }
        if (target.archived) {
            this.app.openProfileTab?.('seguimientos');
            this.deferHighlight('trackerId', target.trackerId);
            return;
        }

        if (target.sectionKey === 'hygiene' && this.app.hygiene) {
            this.app.hygiene.currentCategory = target.subsection;
            this.app.saveUiState?.({ hygieneCategory: target.subsection });
        }
        this.app.activateSection?.(target.sectionId, { render: true });
        this.deferHighlight('trackerId', target.trackerId);
    }

    openTask(target) {
        if (!this.app.tareas) return;
        this.app.tareas.currentCategory = target.category;
        this.app.tareas.activeProjectId = target.projectId;
        this.app.tareas.rememberNavigationContext?.();
        this.app.activateSection?.('tareas-section', { render: true });
        this.app.tareas.render?.();
        this.deferHighlight('taskId', target.taskId);
    }

    openProject(target) {
        if (!this.app.projects) return;
        this.app.activateSection?.('projects-section', { render: true });
        this.app.projects.render?.();

        if (target.collection === 'history') {
            const modal = document.getElementById('projects-history-modal');
            modal?.classList.remove('hidden');
            this.app.projects.renderMonthlyHistory?.('all');
            requestAnimationFrame(() => {
                const item = this.findByData('historyProjectId', target.projectId);
                item?.closest('.history-month-details')?.classList.remove('hidden');
                this.highlightElement(item);
            });
            return;
        }
        this.deferHighlight('projectId', target.projectId);
    }

    deferHighlight(datasetKey, value) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            this.highlightElement(this.findByData(datasetKey, value));
        }));
    }

    findByData(datasetKey, value) {
        const expected = String(value);
        const attribute = datasetKey.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        return [...document.querySelectorAll(`[data-${attribute}]`)]
            .find(element => String(element.dataset[datasetKey]) === expected) || null;
    }

    highlightElement(element) {
        if (!element) {
            this.app.showToast?.('Abrimos la sección, pero el elemento ya no está visible.', {
                tone: 'warning'
            });
            return;
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.remove('search-target-highlight');
        void element.offsetWidth;
        element.classList.add('search-target-highlight');
        window.setTimeout(() => {
            element.classList.remove('search-target-highlight');
        }, 2200);
    }
}
