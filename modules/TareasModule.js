import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import {
    createTaskRecord,
    DEFAULT_TASK_URGENCY,
    getTaskCaptureCategories
} from '../task-capture-utils.mjs?v=20260729-quick-task';
import { shouldHideCompletedTask } from '../task-visibility-utils.mjs?v=20260801-safe-completed';
import { matchesKeyboardShortcut } from '../keyboard-shortcuts.mjs?v=20260801-shortcuts';

export class TareasModule {
    constructor(appController) {
        this.app = appController;
        this.tasks = [];
        this.categories = [];
        this.currentCategory = this.app.uiState?.tasksCategory || null;
        this.activeProjectId = this.app.uiState?.tasksProjectId || null;
        this.editingTaskId = null;
        this.isQuickCapture = false;
        this.taskCaptureTrigger = null;

        this.pinnedProjectIds = [];
        this.removedProjectIds = [];
        this.pinnedProjectsStore = [];

        window.tareas = this;
        this.loadData();
        this.setupListeners();
    }

    loadData() {
        try {
            const tasksRaw = localStorage.getItem('tareas_list');
            if (tasksRaw) {
                this.tasks = JSON.parse(tasksRaw) || [];
            } else {
                this.tasks = [];
            }

            const catsRaw = localStorage.getItem('tareas_categories');
            if (catsRaw) {
                this.categories = JSON.parse(catsRaw) || [];
            } else {
                this.categories = ['Personal', 'LifeCycle', 'Facultad', 'Cotidianas'];
            }

            // Asegurar que exista la carpeta Freelance
            if (!this.categories.includes('Freelance')) {
                this.categories.push('Freelance');
            }
            localStorage.setItem('tareas_categories', JSON.stringify(this.categories));

            if (!this.currentCategory || !this.categories.includes(this.currentCategory)) {
                if (this.categories.length > 0) {
                    this.currentCategory = this.categories[0];
                }
            }

            // Cargar proyectos fijados y eliminados de Tareas
            const pinnedIds = localStorage.getItem('tareas_pinned_project_ids');
            this.pinnedProjectIds = pinnedIds ? JSON.parse(pinnedIds) : [];

            const removedIds = localStorage.getItem('tareas_removed_project_ids');
            this.removedProjectIds = removedIds ? JSON.parse(removedIds) : [];

            const pinnedProjs = localStorage.getItem('tareas_pinned_projects');
            this.pinnedProjectsStore = pinnedProjs ? JSON.parse(pinnedProjs) : [];
            this.normalizeCompletedTaskTimestamps();
        } catch (e) {
            console.error("Error loading Tareas data:", e);
            this.tasks = [];
            this.categories = ['Personal', 'LifeCycle', 'Facultad', 'Cotidianas', 'Freelance'];
            this.currentCategory = this.categories[0];
            this.pinnedProjectIds = [];
            this.removedProjectIds = [];
            this.pinnedProjectsStore = [];
        }
    }

    saveData() {
        localStorage.setItem('tareas_list', JSON.stringify(this.tasks));
        localStorage.setItem('tareas_categories', JSON.stringify(this.categories));
        localStorage.setItem('tareas_pinned_project_ids', JSON.stringify(this.pinnedProjectIds));
        localStorage.setItem('tareas_removed_project_ids', JSON.stringify(this.removedProjectIds));
        localStorage.setItem('tareas_pinned_projects', JSON.stringify(this.pinnedProjectsStore));
    }

    rememberNavigationContext() {
        const tasksCategory = this.currentCategory || '';
        const tasksProjectId = this.activeProjectId === null
            || this.activeProjectId === undefined
            ? ''
            : String(this.activeProjectId);
        if (
            this.app.uiState?.tasksCategory === tasksCategory
            && this.app.uiState?.tasksProjectId === tasksProjectId
        ) {
            return;
        }
        this.app.saveUiState?.({
            tasksCategory,
            tasksProjectId
        });
    }

    getTaskCaptureElements() {
        return {
            modal: document.getElementById('tareas-task-modal'),
            title: document.getElementById('tareas-task-modal-title'),
            description: document.getElementById('tareas-task-modal-desc'),
            input: document.getElementById('tareas-task-text'),
            category: document.getElementById('tareas-task-category'),
            urgency: document.getElementById('tareas-task-urgency'),
            error: document.getElementById('tareas-task-error')
        };
    }

    setTaskCaptureError(message = '') {
        const error = document.getElementById('tareas-task-error');
        if (!error) return;
        error.textContent = message;
        error.classList.toggle('hidden', !message);
    }

    populateTaskCaptureCategories(preferredCategory = null) {
        const select = document.getElementById('tareas-task-category');
        if (!select) return [];

        const categories = getTaskCaptureCategories(this.categories);
        select.innerHTML = categories.map(category => (
            `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
        )).join('');

        const preferred = categories.includes(preferredCategory)
            ? preferredCategory
            : (
                categories.includes(this.currentCategory)
                    ? this.currentCategory
                    : categories[0]
            );
        if (preferred) select.value = preferred;
        select.disabled = categories.length === 0;
        return categories;
    }

    openTaskCapture({ quick = false, category = null } = {}) {
        const elements = this.getTaskCaptureElements();
        if (!elements.modal || !elements.input) return false;

        const categories = this.populateTaskCaptureCategories(category);
        if (categories.length === 0) {
            this.app.showToast?.(
                'Primero creá una carpeta para poder guardar tareas.',
                { tone: 'warning' }
            );
            return false;
        }

        this.isQuickCapture = quick;
        this.taskCaptureTrigger = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        elements.input.value = '';
        if (elements.urgency) elements.urgency.value = DEFAULT_TASK_URGENCY;
        if (elements.title) {
            elements.title.textContent = quick ? 'Nueva tarea rápida' : 'Nueva tarea';
        }
        if (elements.description) {
            elements.description.textContent = quick
                ? 'Anotala ahora y seguí exactamente donde estabas.'
                : 'Guardala en la carpeta que corresponda.';
        }
        this.setTaskCaptureError();
        elements.modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => elements.input.focus());
        return true;
    }

    closeTaskCapture({ restoreFocus = true } = {}) {
        const modal = document.getElementById('tareas-task-modal');
        modal?.classList.add('hidden');
        this.setTaskCaptureError();
        this.isQuickCapture = false;

        if (!document.querySelector('.modal:not(.hidden), .custom-tracker-dialog:not(.hidden)')) {
            document.body.classList.remove('modal-open');
        }
        if (restoreFocus && this.taskCaptureTrigger?.isConnected) {
            this.taskCaptureTrigger.focus();
        }
        this.taskCaptureTrigger = null;
    }

    saveTaskCapture() {
        const elements = this.getTaskCaptureElements();
        const wasQuickCapture = this.isQuickCapture;

        let newTask;
        try {
            newTask = createTaskRecord(
                {
                    text: elements.input?.value,
                    category: elements.category?.value,
                    urgency: elements.urgency?.value
                },
                {
                    categories: this.categories,
                    existingIds: this.tasks.map(task => task.id)
                }
            );
        } catch (error) {
            this.setTaskCaptureError(error.message);
            elements.input?.focus();
            return false;
        }

        this.tasks.push(newTask);
        if (!wasQuickCapture) this.currentCategory = newTask.category;
        this.saveData();
        this.closeTaskCapture();
        this.render();
        this.app.notificationsCenter?.render();
        this.app.showToast?.(`Tarea guardada en ${newTask.category}.`);
        return true;
    }

    getFreelanceProjects() {
        const activeProjects = this.app.projects?.projects || [];
        const historyProjects = this.app.projects?.history || [];
        
        const projectMap = new Map();

        // 1. Agregar proyectos activos de la sección Proyectos
        activeProjects.forEach(p => {
            const pidStr = String(p.id);
            if (!this.removedProjectIds.map(String).includes(pidStr)) {
                projectMap.set(pidStr, { ...p });
            }
        });

        // 2. Agregar proyectos del historial que estén fijados (isPinned)
        historyProjects.forEach(p => {
            const pidStr = String(p.id);
            if (!this.removedProjectIds.map(String).includes(pidStr)) {
                if (p.isPinned || this.pinnedProjectIds.map(String).includes(pidStr)) {
                    if (!projectMap.has(pidStr)) {
                        projectMap.set(pidStr, { ...p });
                    }
                }
            }
        });

        // 3. Agregar proyectos fijados del store local en Tareas (por si fueron borrados en Proyectos)
        this.pinnedProjectsStore.forEach(p => {
            const pidStr = String(p.id);
            if (!this.removedProjectIds.map(String).includes(pidStr)) {
                if (!projectMap.has(pidStr)) {
                    projectMap.set(pidStr, { ...p });
                } else {
                    const existing = projectMap.get(pidStr);
                    if (!existing.tasks) existing.tasks = p.tasks || [];
                }
            }
        });

        const list = Array.from(projectMap.values());

        // Asignar propiedad isPinned
        list.forEach(p => {
            const pidStr = String(p.id);
            if (this.pinnedProjectIds.map(String).includes(pidStr)) {
                p.isPinned = true;
            }
        });

        // Ordenar: Fijados primero, luego el resto
        list.sort((a, b) => {
            const aPin = a.isPinned ? 1 : 0;
            const bPin = b.isPinned ? 1 : 0;
            if (aPin !== bPin) return bPin - aPin;
            return 0;
        });

        return list;
    }

    syncProjectTasksToStores(projId, tasks) {
        if (!projId) return;
        const idStr = String(projId);

        // 1. Sincronizar en active projects
        const inActive = this.app.projects?.projects?.find(x => String(x.id) === idStr);
        if (inActive) inActive.tasks = tasks;

        // 2. Sincronizar en history projects
        const inHist = this.app.projects?.history?.find(x => String(x.id) === idStr);
        if (inHist) inHist.tasks = tasks;

        // 3. Sincronizar en pinnedProjectsStore
        const inPinned = this.pinnedProjectsStore.find(x => String(x.id) === idStr);
        if (inPinned) inPinned.tasks = tasks;
    }

    openTaskDetailModal(t, categoryName, isFreelance = false, projectObj = null) {
        const modal = document.getElementById('tareas-detail-modal');
        const catBadge = document.getElementById('tareas-detail-category');
        const textEl = document.getElementById('tareas-detail-text');
        const urgencyBadge = document.getElementById('tareas-detail-urgency-badge');
        const toggleBtn = document.getElementById('tareas-detail-toggle-btn');
        const toggleLabel = document.getElementById('tareas-detail-toggle-label');
        const editBtn = document.getElementById('tareas-detail-edit-btn');
        const closeBtn = document.getElementById('tareas-detail-close-btn');

        if (!modal || !textEl) return;

        if (catBadge) {
            catBadge.innerText = categoryName;
        }

        textEl.innerText = t.text || '';

        if (urgencyBadge) {
            if (t.urgency === 'muy_urgente') {
                urgencyBadge.innerText = '🔥 MUY URGENTE';
                urgencyBadge.style.background = '#dc2626';
                urgencyBadge.style.color = '#ffffff';
                urgencyBadge.style.fontWeight = 'bold';
                urgencyBadge.style.boxShadow = '0 0 12px rgba(220, 38, 38, 0.6)';
                urgencyBadge.style.display = 'inline-block';
            } else if (t.urgency === 'urgente') {
                urgencyBadge.innerText = 'Urgente';
                urgencyBadge.style.background = 'var(--status-red)';
                urgencyBadge.style.color = '#ffffff';
                urgencyBadge.style.fontWeight = 'normal';
                urgencyBadge.style.boxShadow = 'none';
                urgencyBadge.style.display = 'inline-block';
            } else {
                urgencyBadge.innerText = 'No Urgente';
                urgencyBadge.style.background = 'var(--surface-subtle)';
                urgencyBadge.style.color = 'var(--text-secondary)';
                urgencyBadge.style.fontWeight = 'normal';
                urgencyBadge.style.boxShadow = 'none';
                urgencyBadge.style.display = 'inline-block';
            }
        }

        if (toggleLabel) {
            toggleLabel.innerText = t.completed ? 'Marcar Pendiente' : 'Marcar Completada';
        }

        if (toggleBtn) {
            toggleBtn.onclick = () => {
                if (isFreelance && projectObj) {
                    t.completed = !t.completed;
                    this.syncProjectTasksToStores(projectObj.id, projectObj.tasks);
                    this.saveData();
                    this.app.projects?.saveData();
                    this.app.auth?.syncToCloud(false).catch(() => {});
                    this.app.notificationsCenter?.updateBadge();
                    this.render();
                } else {
                    this.toggleTask(t.id);
                }
                modal.classList.add('hidden');
            };
        }

        if (editBtn) {
            editBtn.onclick = () => {
                modal.classList.add('hidden');
                this.editingTaskId = t.id;
                this.render();
            };
        }

        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.classList.add('hidden');
            };
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        };

        modal.classList.remove('hidden');
    }

    openTaskDetailModalById(id) {
        const idStr = String(id);
        let foundTask = this.tasks.find(x => String(x.id) === idStr);
        let catName = this.currentCategory;
        let isFreelance = false;
        let projObj = null;

        if (!foundTask && this.app.projects) {
            const allProjs = [...(this.app.projects.projects || []), ...(this.app.projects.history || [])];
            for (const p of allProjs) {
                if (p.tasks) {
                    const t = p.tasks.find(x => String(x.id) === idStr);
                    if (t) {
                        foundTask = t;
                        catName = p.client ? `${p.client}: ${p.project}` : p.project;
                        isFreelance = true;
                        projObj = p;
                        break;
                    }
                }
            }
        }

        if (foundTask) {
            this.openTaskDetailModal(foundTask, catName, isFreelance, projObj);
        }
    }

    togglePinProject(id) {
        if (!id) return;
        const idStr = String(id);
        const projects = this.getFreelanceProjects();
        const p = projects.find(x => String(x.id) === idStr);
        if (!p) return;

        const isCurrentlyPinned = p.isPinned || this.pinnedProjectIds.map(String).includes(idStr);
        
        if (isCurrentlyPinned) {
            // Desfijar
            this.pinnedProjectIds = this.pinnedProjectIds.filter(x => String(x) !== idStr);
            this.pinnedProjectsStore = this.pinnedProjectsStore.filter(x => String(x.id) !== idStr);
            p.isPinned = false;

            const inActive = this.app.projects?.projects?.find(x => String(x.id) === idStr);
            if (inActive) inActive.isPinned = false;
            const inHist = this.app.projects?.history?.find(x => String(x.id) === idStr);
            if (inHist) inHist.isPinned = false;
        } else {
            // Fijar
            if (!this.pinnedProjectIds.map(String).includes(idStr)) {
                this.pinnedProjectIds.push(idStr);
            }
            p.isPinned = true;
            
            const inActive = this.app.projects?.projects?.find(x => String(x.id) === idStr);
            if (inActive) inActive.isPinned = true;
            const inHist = this.app.projects?.history?.find(x => String(x.id) === idStr);
            if (inHist) inHist.isPinned = true;

            const existingIdx = this.pinnedProjectsStore.findIndex(x => String(x.id) === idStr);
            if (existingIdx !== -1) {
                this.pinnedProjectsStore[existingIdx] = p;
            } else {
                this.pinnedProjectsStore.push(p);
            }
        }

        // Si se vuelve a fijar, remover del listado de eliminados
        this.removedProjectIds = this.removedProjectIds.filter(x => String(x) !== idStr);

        this.saveData();
        this.app.projects?.saveData();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
    }

    deleteProjectFromTareas(id) {
        if (!id) return;
        const idStr = String(id);
        const projects = this.getFreelanceProjects();
        const p = projects.find(x => String(x.id) === idStr);
        if (!p) return;

        const fullName = p.client ? `${p.client} - ${p.project}` : p.project;
        const wasPinned = this.pinnedProjectIds.map(String).includes(idStr);
        const pinnedSnapshot = this.pinnedProjectsStore.find(
            project => String(project.id) === idStr
        );

        if (!this.removedProjectIds.map(String).includes(idStr)) {
            this.removedProjectIds.push(idStr);
        }
        this.pinnedProjectIds = this.pinnedProjectIds.filter(x => String(x) !== idStr);
        this.pinnedProjectsStore = this.pinnedProjectsStore.filter(x => String(x.id) !== idStr);

        const inActive = this.app.projects?.projects?.find(x => String(x.id) === idStr);
        if (inActive) inActive.isPinned = false;
        const inHist = this.app.projects?.history?.find(x => String(x.id) === idStr);
        if (inHist) inHist.isPinned = false;

        const remaining = this.getFreelanceProjects();
        if (remaining.length > 0) {
            this.activeProjectId = remaining[0].id;
        } else {
            this.activeProjectId = null;
        }

        this.saveData();
        this.app.projects?.saveData();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
        this.app.showUndo(`"${fullName}" se ocultó de Tareas.`, () => {
            this.removedProjectIds = this.removedProjectIds.filter(
                projectId => String(projectId) !== idStr
            );
            if (wasPinned && !this.pinnedProjectIds.map(String).includes(idStr)) {
                this.pinnedProjectIds.push(idStr);
            }
            if (
                pinnedSnapshot
                && !this.pinnedProjectsStore.some(project => String(project.id) === idStr)
            ) {
                this.pinnedProjectsStore.push(pinnedSnapshot);
            }
            if (inActive) inActive.isPinned = wasPinned;
            if (inHist) inHist.isPinned = wasPinned;
            this.activeProjectId = p.id;
            this.saveData();
            this.app.projects?.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.render();
        });
    }

    setupListeners() {
        // Modal Category
        const btnAddCategory = document.getElementById('btn-add-category');
        const catModal = document.getElementById('tareas-category-modal');
        const catCancel = document.getElementById('tareas-cat-cancel');
        const catSave = document.getElementById('tareas-cat-save');
        const catInput = document.getElementById('tareas-new-cat-name');

        const btnTasksSettings = document.getElementById('btn-tasks-settings');
        btnTasksSettings?.addEventListener('click', () => {
            this.app.openProfileTab?.('preferencias');
        });

        const prefCleanToggle = document.getElementById('pref-auto-clean-tasks');
        if (prefCleanToggle) {
            prefCleanToggle.checked = localStorage.getItem('auto_clean_completed_tasks_24h') === 'true';
            prefCleanToggle.addEventListener('change', (e) => {
                localStorage.setItem('auto_clean_completed_tasks_24h', String(e.target.checked));
                this.render();
            });
        }

        btnAddCategory?.addEventListener('click', () => {
            if (catInput) catInput.value = '';
            catModal?.classList.remove('hidden');
        });

        catCancel?.addEventListener('click', () => {
            catModal?.classList.add('hidden');
        });

        catSave?.addEventListener('click', () => {
            const val = catInput?.value.trim();
            if (!val) return;
            if (this.categories.includes(val)) {
                void this.app.showMessage({
                    title: 'Carpeta duplicada',
                    message: 'Ya existe una carpeta con ese nombre.',
                    tone: 'warning'
                });
                return;
            }
            this.categories.push(val);
            this.currentCategory = val;
            this.rememberNavigationContext();
            this.saveData();
            catModal?.classList.add('hidden');
            this.render();
        });

        // Delete Category
        const btnDeleteCategory = document.getElementById('btn-delete-category');
        btnDeleteCategory?.addEventListener('click', async () => {
            if (!this.currentCategory) return;
            if (this.currentCategory === 'Freelance') {
                await this.app.showMessage({
                    title: 'Carpeta protegida',
                    message: 'Freelance se administra automáticamente y no puede eliminarse.',
                    tone: 'warning'
                });
                return;
            }
            const confirmed = await this.app.confirmAction({
                title: `Eliminar carpeta "${this.currentCategory}"`,
                message: 'Todas las tareas dentro de esta carpeta se borrarán permanentemente. Esta acción no se puede deshacer.',
                tone: 'danger',
                confirmLabel: 'Eliminar carpeta',
                closeOnBackdrop: false
            });
            if (confirmed) {
                this.tasks = this.tasks.filter(t => t.category !== this.currentCategory);
                this.categories = this.categories.filter(c => c !== this.currentCategory);
                this.currentCategory = this.categories.length > 0 ? this.categories[0] : null;
                this.rememberNavigationContext();
                this.saveData();
                this.render();
            }
        });

        // Modal Task
        const btnAddTask = document.getElementById('btn-add-task');
        const btnQuickTask = document.getElementById('global-quick-task-btn');
        const taskModal = document.getElementById('tareas-task-modal');
        const taskCancel = document.getElementById('tareas-task-cancel');
        const taskSave = document.getElementById('tareas-task-save');
        const taskInput = document.getElementById('tareas-task-text');

        btnAddTask?.addEventListener('click', () => {
            if (!this.currentCategory) {
                void this.app.showMessage({
                    title: 'Falta una carpeta',
                    message: 'Primero creá una carpeta para guardar la tarea.',
                    tone: 'warning'
                });
                return;
            }
            if (this.currentCategory === 'Freelance') {
                void this.app.showMessage({
                    title: 'Usá el panel del proyecto',
                    message: 'Las tareas de Freelance se agregan desde su panel integrado.',
                    tone: 'info'
                });
                return;
            }
            this.openTaskCapture({
                quick: false,
                category: this.currentCategory
            });
        });

        btnQuickTask?.addEventListener('click', () => {
            this.openTaskCapture({ quick: true });
        });

        taskCancel?.addEventListener('click', () => this.closeTaskCapture());
        taskSave?.addEventListener('click', () => this.saveTaskCapture());
        taskInput?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.isComposing) return;
            event.preventDefault();
            this.saveTaskCapture();
        });
        taskModal?.addEventListener('click', (event) => {
            if (event.target === taskModal) this.closeTaskCapture();
        });
        taskModal?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeTaskCapture();
            } else if (
                event.key === 'Enter'
                && (event.ctrlKey || event.metaKey)
                && !event.isComposing
            ) {
                event.preventDefault();
                this.saveTaskCapture();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (
                event.defaultPrevented
                || event.repeat
                || !matchesKeyboardShortcut(event, 'quick-task')
            ) {
                return;
            }

            const target = event.target;
            if (
                target instanceof HTMLElement
                && (
                    target.matches('input, textarea, select')
                    || target.isContentEditable
                )
            ) {
                return;
            }
            if (
                document.querySelector('.modal:not(.hidden), .custom-tracker-dialog:not(.hidden)')
                || document.querySelector('main.container')?.classList.contains('hidden')
            ) {
                return;
            }

            event.preventDefault();
            this.openTaskCapture({ quick: true });
        });

        // Freelance Actions (Fijar / Eliminar Proyecto)
        const btnPinProject = document.getElementById('btn-pin-freelance-project');
        const btnDeleteProject = document.getElementById('btn-delete-freelance-project');

        btnPinProject?.addEventListener('click', () => {
            if (this.activeProjectId) {
                this.togglePinProject(this.activeProjectId);
            }
        });

        btnDeleteProject?.addEventListener('click', () => {
            if (this.activeProjectId) {
                this.deleteProjectFromTareas(this.activeProjectId);
            }
        });

        // Freelance Inline Task Form Setup
        const btnFreelanceAdd = document.getElementById('tareas-freelance-btn-add-task');
        const freelanceInput = document.getElementById('tareas-freelance-new-task-text');
        const freelanceUrgency = document.getElementById('tareas-freelance-new-task-urgency');

        const addFreelanceTask = () => {
            const text = freelanceInput?.value.trim();
            if (!text) return;
            
            const activeProjId = this.activeProjectId;
            if (!activeProjId) {
                void this.app.showMessage({
                    title: 'Falta seleccionar el proyecto',
                    message: 'Seleccioná un proyecto antes de agregar la tarea.',
                    tone: 'warning'
                });
                return;
            }

            const projects = this.getFreelanceProjects();
            const p = projects.find(x => String(x.id) === String(activeProjId));
            if (!p) {
                void this.app.showMessage({
                    title: 'Proyecto no encontrado',
                    message: 'Actualizá la vista y volvé a intentarlo.',
                    tone: 'danger'
                });
                return;
            }

            if (!p.tasks) p.tasks = [];
            const newTask = {
                id: Date.now(),
                text: text,
                completed: false,
                urgency: freelanceUrgency?.value || DEFAULT_TASK_URGENCY
            };
            p.tasks.push(newTask);

            this.syncProjectTasksToStores(activeProjId, p.tasks);

            this.saveData();
            this.app.projects?.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.app.notificationsCenter?.updateBadge();
            
            if (freelanceInput) freelanceInput.value = '';
            if (freelanceUrgency) freelanceUrgency.value = DEFAULT_TASK_URGENCY;
            this.render();
        };

        btnFreelanceAdd?.addEventListener('click', addFreelanceTask);
        freelanceInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addFreelanceTask();
            }
        });

    }

    normalizeCompletedTaskTimestamps() {
        const now = Date.now();
        let changed = false;
        this.tasks.forEach(task => {
            if (task.completed && !task.completedAt && !task.completed_at && !task.updatedAt) {
                task.completedAt = now;
                changed = true;
            }
        });
        if (changed) this.saveData();
    }

    shouldHideCompletedTask(task) {
        return shouldHideCompletedTask(task, {
            enabled: localStorage.getItem('auto_clean_completed_tasks_24h') === 'true'
        });
    }

    toggleTask(id) {
        const t = this.tasks.find(x => x.id === id);
        if (t) {
            t.completed = !t.completed;
            if (t.completed) {
                t.completedAt = Date.now();
            } else {
                delete t.completedAt;
            }
            this.saveData();
            this.render();
            this.app.notificationsCenter?.render();
        }
    }

    deleteTask(id) {
        const index = this.tasks.findIndex(task => task.id === id);
        if (index < 0) return;
        const deletedTask = this.tasks[index];
        this.tasks.splice(index, 1);
        this.saveData();
        this.render();
        this.app.notificationsCenter?.render();
        this.app.showUndo('Tarea eliminada.', () => {
            this.tasks.splice(index, 0, deletedTask);
            this.saveData();
            this.render();
            this.app.notificationsCenter?.render();
            this.app.auth?.syncToCloud(false).catch(() => {});
        });
    }

    deleteFreelanceTask(project, taskId) {
        const index = project.tasks?.findIndex(task => task.id === taskId) ?? -1;
        if (index < 0) return;
        const deletedTask = project.tasks[index];
        project.tasks.splice(index, 1);
        this.syncProjectTasksToStores(project.id, project.tasks);
        this.saveData();
        this.app.projects?.saveData();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.app.notificationsCenter?.updateBadge();
        this.render();
        this.app.showUndo('Tarea eliminada.', () => {
            project.tasks.splice(index, 0, deletedTask);
            this.syncProjectTasksToStores(project.id, project.tasks);
            this.saveData();
            this.app.projects?.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.app.notificationsCenter?.updateBadge();
            this.render();
        });
    }

    render() {
        const tabsContainer = document.getElementById('tareas-categories-tabs');
        const activeList = document.getElementById('tareas-active-list');
        const completedList = document.getElementById('tareas-completed-list');
        const activeTitle = document.getElementById('tareas-active-title');
        const freelanceContainer = document.getElementById('tareas-freelance-container');
        const btnAddTask = document.getElementById('btn-add-task');
        const btnDeleteCategory = document.getElementById('btn-delete-category');

        if (!tabsContainer || !activeList || !completedList) return;
        if (this.currentCategory && !this.categories.includes(this.currentCategory)) {
            this.currentCategory = this.categories[0] || null;
        }
        this.rememberNavigationContext();

        // Render Tabs
        tabsContainer.innerHTML = '';
        if (this.categories.length === 0) {
            tabsContainer.innerHTML = '<span style="color:var(--text-secondary); font-size:0.9rem; padding: 5px;">No hay carpetas. Creá una arriba a la derecha.</span>';
        } else {
            this.categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = `tab-btn ${this.currentCategory === cat ? 'active' : ''}`;
                btn.innerText = cat;
                btn.onclick = () => {
                    this.currentCategory = cat;
                    this.rememberNavigationContext();
                    this.render();
                };
                tabsContainer.appendChild(btn);
            });
        }

        // Render Titles & Lists
        activeList.innerHTML = '';
        completedList.innerHTML = '';

        if (!this.currentCategory) {
            if (activeTitle) activeTitle.innerText = 'Tareas Pendientes';
            activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">Crea o selecciona una carpeta.</p>';
            completedList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">-</p>';
            if (freelanceContainer) freelanceContainer.classList.add('hidden');
            if (btnAddTask) btnAddTask.style.display = 'inline-flex';
            if (btnDeleteCategory) btnDeleteCategory.style.display = 'inline-flex';
            return;
        }

        if (this.currentCategory === 'Freelance') {
            // Mostrar panel Freelance
            if (freelanceContainer) freelanceContainer.classList.remove('hidden');
            if (btnAddTask) btnAddTask.style.display = 'none';
            if (btnDeleteCategory) btnDeleteCategory.style.display = 'none';

            const freelanceProjects = this.getFreelanceProjects();
            const freelanceTabs = document.getElementById('tareas-freelance-tabs');

            if (freelanceProjects.length === 0) {
                if (freelanceTabs) freelanceTabs.innerHTML = '';
                if (activeTitle) activeTitle.innerText = 'Tareas Pendientes (Freelance)';
                activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No tienes proyectos activos ni fijados en Tareas. Ve a la sección Proyectos para agregar uno.</p>';
                completedList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">-</p>';
                this.activeProjectId = null;
                this.rememberNavigationContext();

                const projectActions = document.getElementById('tareas-freelance-project-actions');
                if (projectActions) projectActions.style.display = 'none';
                return;
            } else {
                const projectActions = document.getElementById('tareas-freelance-project-actions');
                if (projectActions) projectActions.style.display = 'flex';
            }

            // Seleccionar proyecto por defecto
            if (!this.activeProjectId || !freelanceProjects.some(x => String(x.id) === String(this.activeProjectId))) {
                this.activeProjectId = freelanceProjects[0].id;
            }
            this.rememberNavigationContext();

            const p = freelanceProjects.find(x => String(x.id) === String(this.activeProjectId));

            // Actualizar botones de acción del proyecto activo (Fijar / Eliminar)
            const btnPinProject = document.getElementById('btn-pin-freelance-project');
            const lblPinProject = document.getElementById('lbl-pin-freelance-project');
            if (btnPinProject && p) {
                const isPinned = p.isPinned || this.pinnedProjectIds.map(String).includes(String(p.id));
                if (isPinned) {
                    if (lblPinProject) lblPinProject.innerText = 'Desfijar Proyecto';
                    btnPinProject.style.background = 'var(--surface-active)';
                    btnPinProject.style.borderColor = 'var(--primary-color)';
                    btnPinProject.style.color = 'var(--text-link)';
                    btnPinProject.querySelector('i').className = 'ph ph-push-pin-slash';
                } else {
                    if (lblPinProject) lblPinProject.innerText = 'Fijar Proyecto';
                    btnPinProject.style.background = 'rgba(59, 130, 246, 0.1)';
                    btnPinProject.style.borderColor = 'rgba(59, 130, 246, 0.25)';
                    btnPinProject.style.color = '#3b82f6';
                    btnPinProject.querySelector('i').className = 'ph ph-push-pin';
                }
            }

            // Render project tabs
            if (freelanceTabs) {
                freelanceTabs.innerHTML = '';
                freelanceProjects.forEach(proj => {
                    const btn = document.createElement('button');
                    const isPinned = proj.isPinned || this.pinnedProjectIds.map(String).includes(String(proj.id));
                    btn.className = `tab-btn ${String(this.activeProjectId) === String(proj.id) ? 'active' : ''} ${isPinned ? 'pinned' : ''}`;
                    
                    const nameStr = proj.client ? `${proj.client} - ${proj.project}` : proj.project;
                    const fullName = isPinned ? `📌 ${nameStr}` : nameStr;
                    btn.innerText = fullName;
                    btn.title = nameStr + (isPinned ? ' (Fijado)' : '');
                    btn.style.maxWidth = '250px';
                    btn.style.overflow = 'hidden';
                    btn.style.textOverflow = 'ellipsis';
                    btn.style.whiteSpace = 'nowrap';
                    btn.onclick = () => {
                        this.activeProjectId = proj.id;
                        this.rememberNavigationContext();
                        this.render();
                    };
                    freelanceTabs.appendChild(btn);
                });
            }

            if (!p) return;

            const projNameTitle = `Freelance - ${p.client ? p.client + ': ' + p.project : p.project}`;

            if (activeTitle) {
                const isPinned = p.isPinned || this.pinnedProjectIds.map(String).includes(String(p.id));
                const pinBadge = isPinned ? ' 📌' : '';
                activeTitle.innerText = `Tareas Pendientes (${projNameTitle})${pinBadge}`;
            }

            const tasks = p.tasks || [];
            const pending = tasks.filter(t => !t.completed);
            const completed = tasks.filter(t => t.completed);

            // Render Pendientes (Freelance)
            if (pending.length === 0) {
                activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">¡Todo listo por aquí! No hay tareas pendientes en este proyecto.</p>';
            } else {
                pending.forEach(t => {
                    const badge = t.urgency === 'muy_urgente'
                        ? `<span class="badge" style="background:#dc2626; color:white; font-size:0.65rem; padding:2px 6px; box-shadow:0 0 8px rgba(220,38,38,0.6); font-weight:bold;">🔥 Muy Urgente</span>`
                        : (t.urgency === 'urgente' 
                            ? `<span class="badge" style="background:var(--status-red); color:white; font-size:0.65rem; padding:2px 6px;">Urgente</span>`
                            : '');
                    const isEditing = String(this.editingTaskId) === String(t.id);
                    const safeTaskText = escapeHtml(t.text || '');
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.setAttribute('data-task-id', t.id);
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:var(--surface-inset); border:1px solid var(--surface-border); border-radius:8px; padding:10px 14px;';
                    
                    if (isEditing) {
                        row.innerHTML = `
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; opacity:0.5; pointer-events:none;">
                                    <input type="checkbox" disabled class="task-check" aria-label="Tarea en edición">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <input type="text" class="text-input edit-task-input" value="${safeTaskText}" aria-label="Editar descripción de la tarea" style="flex:1; margin:0; padding:6px 10px; font-size:0.95rem; height:36px; min-width:0;">
                            </div>
                            <div style="display:flex; gap:8px; align-items:center; margin-left:10px;">
                                <button type="button" class="btn-save-task icon-btn icon-btn-sm is-success" data-tooltip="Guardar tarea" aria-label="Guardar tarea"><i class="ph ph-check" aria-hidden="true"></i></button>
                                <button type="button" class="btn-cancel-task icon-btn icon-btn-sm" data-tooltip="Cancelar edición" aria-label="Cancelar edición"><i class="ph ph-x" aria-hidden="true"></i></button>
                            </div>
                        `;
                        const input = row.querySelector('.edit-task-input');
                        setTimeout(() => input?.focus(), 50);

                        const saveAction = () => {
                            const newText = input.value.trim();
                            if (newText) {
                                t.text = newText;
                                this.syncProjectTasksToStores(p.id, p.tasks);
                                this.saveData();
                                this.app.projects?.saveData();
                                this.app.auth?.syncToCloud(false).catch(() => {});
                                this.app.notificationsCenter?.updateBadge();
                            }
                            this.editingTaskId = null;
                            this.render();
                        };

                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') saveAction();
                            if (e.key === 'Escape') {
                                this.editingTaskId = null;
                                this.render();
                            }
                        });

                        row.querySelector('.btn-save-task').addEventListener('click', saveAction);
                        row.querySelector('.btn-cancel-task').addEventListener('click', () => {
                            this.editingTaskId = null;
                            this.render();
                        });

                    } else {
                        row.innerHTML = `
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; flex-shrink:0;">
                                    <input type="checkbox" class="task-check" aria-label="Marcar tarea como completada">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <span class="task-text-span" style="color:var(--text-primary); font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${safeTaskText} ${badge}</span>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                                <button type="button" class="btn-view-task icon-btn icon-btn-sm is-primary" data-tooltip="Ver tarea completa" aria-label="Ver tarea completa"><i class="ph ph-eye" aria-hidden="true"></i></button>
                                <button type="button" class="btn-edit-task icon-btn icon-btn-sm" data-tooltip="Editar tarea" aria-label="Editar tarea"><i class="ph ph-pencil" aria-hidden="true"></i></button>
                                <button type="button" class="btn-delete-task icon-btn icon-btn-sm is-danger" data-tooltip="Eliminar tarea" aria-label="Eliminar tarea"><i class="ph ph-trash" aria-hidden="true"></i></button>
                            </div>
                        `;

                        row.querySelector('.task-text-span')?.addEventListener('click', () => this.openTaskDetailModal(t, projNameTitle, true, p));
                        row.querySelector('.btn-view-task')?.addEventListener('click', () => this.openTaskDetailModal(t, projNameTitle, true, p));

                        row.querySelector('.task-check').addEventListener('change', () => {
                            t.completed = true;
                            this.syncProjectTasksToStores(p.id, p.tasks);
                            this.saveData();
                            this.app.projects?.saveData();
                            this.app.auth?.syncToCloud(false).catch(() => {});
                            this.app.notificationsCenter?.updateBadge();
                            this.render();
                        });
                        row.querySelector('.btn-edit-task').addEventListener('click', () => {
                            this.editingTaskId = t.id;
                            this.render();
                        });
                        row.querySelector('.btn-delete-task').addEventListener('click', () => {
                            this.deleteFreelanceTask(p, t.id);
                        });
                    }
                    activeList.appendChild(row);
                });
            }

            // Render Completadas (Freelance)
            if (completed.length === 0) {
                completedList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay tareas completadas todavía.</p>';
            } else {
                completed.forEach(t => {
                    const safeTaskText = escapeHtml(t.text || '');
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.setAttribute('data-task-id', t.id);
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:8px; padding:10px 14px;';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px; opacity: 0.6; flex:1; min-width:0;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; flex-shrink:0;">
                                <input type="checkbox" checked class="task-check" aria-label="Marcar tarea como pendiente">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span class="task-text-span" style="color:var(--text-secondary); font-size:0.95rem; text-decoration:line-through; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${safeTaskText}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                            <button type="button" class="btn-view-task icon-btn icon-btn-sm is-primary" data-tooltip="Ver tarea completa" aria-label="Ver tarea completa"><i class="ph ph-eye" aria-hidden="true"></i></button>
                            <button type="button" class="btn-delete-task icon-btn icon-btn-sm is-danger" data-tooltip="Eliminar tarea" aria-label="Eliminar tarea"><i class="ph ph-trash" aria-hidden="true"></i></button>
                        </div>
                    `;

                    row.querySelector('.task-text-span')?.addEventListener('click', () => this.openTaskDetailModal(t, projNameTitle, true, p));
                    row.querySelector('.btn-view-task')?.addEventListener('click', () => this.openTaskDetailModal(t, projNameTitle, true, p));

                    row.querySelector('.task-check').addEventListener('change', () => {
                        t.completed = false;
                        this.syncProjectTasksToStores(p.id, p.tasks);
                        this.saveData();
                        this.app.projects?.saveData();
                        this.app.auth?.syncToCloud(false).catch(() => {});
                        this.app.notificationsCenter?.updateBadge();
                        this.render();
                    });
                    row.querySelector('.btn-delete-task').addEventListener('click', () => {
                        this.deleteFreelanceTask(p, t.id);
                    });
                    completedList.appendChild(row);
                });
            }

        } else {
            // Mostrar panel estándar
            if (freelanceContainer) freelanceContainer.classList.add('hidden');
            if (btnAddTask) btnAddTask.style.display = 'inline-flex';
            if (btnDeleteCategory) btnDeleteCategory.style.display = 'inline-flex';

            if (activeTitle) {
                activeTitle.innerText = `Tareas Pendientes (${this.currentCategory})`;
            }

            const catTasks = this.tasks.filter(t => t.category === this.currentCategory);
            const pending = catTasks.filter(t => !t.completed);
            const allCompleted = catTasks.filter(t => t.completed);
            const completed = allCompleted.filter(t => !this.shouldHideCompletedTask(t));
            const hiddenCompletedCount = allCompleted.length - completed.length;

            if (pending.length === 0) {
                activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">¡Todo listo por aquí! No hay tareas pendientes.</p>';
            } else {
                pending.forEach(t => {
                    const badge = t.urgency === 'muy_urgente'
                        ? `<span class="badge" style="background:#dc2626; color:white; font-size:0.65rem; padding:2px 6px; box-shadow:0 0 8px rgba(220,38,38,0.6); font-weight:bold;">🔥 Muy Urgente</span>`
                        : (t.urgency === 'urgente' 
                            ? `<span class="badge" style="background:var(--status-red); color:white; font-size:0.65rem; padding:2px 6px;">Urgente</span>`
                            : '');
                    const isEditing = String(this.editingTaskId) === String(t.id);
                    const safeTaskText = escapeHtml(t.text || '');
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.setAttribute('data-task-id', t.id);
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:var(--surface-inset); border:1px solid var(--surface-border); border-radius:8px; padding:10px 14px;';
                    
                    if (isEditing) {
                        row.innerHTML = `
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; opacity:0.5; pointer-events:none;">
                                    <input type="checkbox" disabled class="task-check" aria-label="Tarea en edición">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <input type="text" class="text-input edit-task-input" value="${safeTaskText}" aria-label="Editar descripción de la tarea" style="flex:1; margin:0; padding:6px 10px; font-size:0.95rem; height:36px; min-width:0;">
                            </div>
                            <div style="display:flex; gap:8px; align-items:center; margin-left:10px;">
                                <button type="button" class="btn-save-task icon-btn icon-btn-sm is-success" data-tooltip="Guardar tarea" aria-label="Guardar tarea"><i class="ph ph-check" aria-hidden="true"></i></button>
                                <button type="button" class="btn-cancel-task icon-btn icon-btn-sm" data-tooltip="Cancelar edición" aria-label="Cancelar edición"><i class="ph ph-x" aria-hidden="true"></i></button>
                            </div>
                        `;
                        const input = row.querySelector('.edit-task-input');
                        setTimeout(() => input?.focus(), 50);

                        const saveAction = () => {
                            const newText = input.value.trim();
                            if (newText) {
                                t.text = newText;
                                this.saveData();
                                this.app.auth?.syncToCloud(false).catch(() => {});
                                this.app.notificationsCenter?.updateBadge();
                            }
                            this.editingTaskId = null;
                            this.render();
                        };

                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') saveAction();
                            if (e.key === 'Escape') {
                                this.editingTaskId = null;
                                this.render();
                            }
                        });

                        row.querySelector('.btn-save-task').addEventListener('click', saveAction);
                        row.querySelector('.btn-cancel-task').addEventListener('click', () => {
                            this.editingTaskId = null;
                            this.render();
                        });

                    } else {
                        row.innerHTML = `
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; flex-shrink:0;">
                                    <input type="checkbox" class="task-check" aria-label="Marcar tarea como completada">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <span class="task-text-span" style="color:var(--text-primary); font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${safeTaskText} ${badge}</span>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                                <button type="button" class="btn-view-task icon-btn icon-btn-sm is-primary" data-tooltip="Ver tarea completa" aria-label="Ver tarea completa"><i class="ph ph-eye" aria-hidden="true"></i></button>
                                <button type="button" class="btn-edit-task icon-btn icon-btn-sm" data-tooltip="Editar tarea" aria-label="Editar tarea"><i class="ph ph-pencil" aria-hidden="true"></i></button>
                                <button type="button" class="btn-delete-task icon-btn icon-btn-sm is-danger" data-tooltip="Eliminar tarea" aria-label="Eliminar tarea"><i class="ph ph-trash" aria-hidden="true"></i></button>
                            </div>
                        `;

                        row.querySelector('.task-text-span')?.addEventListener('click', () => this.openTaskDetailModal(t, this.currentCategory, false));
                        row.querySelector('.btn-view-task')?.addEventListener('click', () => this.openTaskDetailModal(t, this.currentCategory, false));

                        row.querySelector('.task-check').addEventListener('change', () => {
                            this.toggleTask(t.id);
                        });
                        row.querySelector('.btn-edit-task').addEventListener('click', () => {
                            this.editingTaskId = t.id;
                            this.render();
                        });
                        row.querySelector('.btn-delete-task').addEventListener('click', () => {
                            this.deleteTask(t.id);
                        });
                    }
                    activeList.appendChild(row);
                });
            }

            if (completed.length === 0) {
                completedList.innerHTML = hiddenCompletedCount > 0
                    ? `<p class="tasks-hidden-completed-note"><i class="ph ph-eye-slash"></i> ${hiddenCompletedCount} ${hiddenCompletedCount === 1 ? 'tarea completada antigua está oculta' : 'tareas completadas antiguas están ocultas'}. Podés mostrarlas desde Perfil → Preferencias.</p>`
                    : '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay tareas completadas todavía.</p>';
            } else {
                completed.forEach(t => {
                    const safeTaskText = escapeHtml(t.text || '');
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.setAttribute('data-task-id', t.id);
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:8px; padding:10px 14px;';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px; opacity: 0.6; flex:1; min-width:0;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; flex-shrink:0;">
                                <input type="checkbox" checked class="task-check" aria-label="Marcar tarea como pendiente">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span class="task-text-span" style="color:var(--text-secondary); font-size:0.95rem; text-decoration:line-through; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${safeTaskText}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                            <button type="button" class="btn-view-task icon-btn icon-btn-sm is-primary" data-tooltip="Ver tarea completa" aria-label="Ver tarea completa"><i class="ph ph-eye" aria-hidden="true"></i></button>
                            <button type="button" class="btn-delete-task icon-btn icon-btn-sm is-danger" data-tooltip="Eliminar tarea" aria-label="Eliminar tarea"><i class="ph ph-trash" aria-hidden="true"></i></button>
                        </div>
                    `;

                    row.querySelector('.task-text-span')?.addEventListener('click', () => this.openTaskDetailModal(t, this.currentCategory, false));
                    row.querySelector('.btn-view-task')?.addEventListener('click', () => this.openTaskDetailModal(t, this.currentCategory, false));

                    row.querySelector('.task-check').addEventListener('change', () => {
                        this.toggleTask(t.id);
                    });
                    row.querySelector('.btn-delete-task').addEventListener('click', () => {
                        this.deleteTask(t.id);
                    });
                    completedList.appendChild(row);
                });
                if (hiddenCompletedCount > 0) {
                    completedList.insertAdjacentHTML(
                        'beforeend',
                        `<p class="tasks-hidden-completed-note"><i class="ph ph-eye-slash"></i> ${hiddenCompletedCount} ${hiddenCompletedCount === 1 ? 'completada antigua oculta' : 'completadas antiguas ocultas'} · Perfil → Preferencias</p>`
                    );
                }
            }
        }
    }
}
