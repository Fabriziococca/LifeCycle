export class TareasModule {
    constructor(appController) {
        this.app = appController;
        this.tasks = [];
        this.categories = [];
        this.currentCategory = null;
        this.activeProjectId = null;
        this.editingTaskId = null;

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

        textEl.innerText = t.text;

        if (urgencyBadge) {
            if (t.urgency === 'urgente') {
                urgencyBadge.innerText = 'Urgente';
                urgencyBadge.style.background = 'var(--status-red)';
                urgencyBadge.style.color = '#ffffff';
                urgencyBadge.style.display = 'inline-block';
            } else {
                urgencyBadge.innerText = 'No Urgente';
                urgencyBadge.style.background = 'rgba(255, 255, 255, 0.1)';
                urgencyBadge.style.color = 'var(--text-secondary)';
                urgencyBadge.style.display = 'inline-block';
            }
        }

        if (toggleLabel) {
            toggleLabel.innerText = t.completed ? 'Marcar Pendiente' : 'Marcar Completada';
        }

        const handleToggle = () => {
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

        const handleEdit = () => {
            modal.classList.add('hidden');
            this.editingTaskId = t.id;
            this.render();
        };

        const handleClose = () => {
            modal.classList.add('hidden');
        };

        if (toggleBtn) {
            const newToggleBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
            newToggleBtn.addEventListener('click', handleToggle);
        }

        if (editBtn) {
            const newEditBtn = editBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newEditBtn, editBtn);
            newEditBtn.addEventListener('click', handleEdit);
        }

        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', handleClose);
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        };

        modal.classList.remove('hidden');
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

        if (confirm(`¿Seguro que deseas eliminar el proyecto "${fullName}" de la lista de tareas?\n\n(Esto quitará el proyecto de la sección Tareas pero su historial financiero y registro en la sección Proyectos se mantendrán intactos)`)) {
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
        }
    }

    setupListeners() {
        // Modal Category
        const btnAddCategory = document.getElementById('btn-add-category');
        const catModal = document.getElementById('tareas-category-modal');
        const catCancel = document.getElementById('tareas-cat-cancel');
        const catSave = document.getElementById('tareas-cat-save');
        const catInput = document.getElementById('tareas-new-cat-name');

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
                alert("Esta carpeta ya existe.");
                return;
            }
            this.categories.push(val);
            this.currentCategory = val;
            this.saveData();
            catModal?.classList.add('hidden');
            this.render();
        });

        // Delete Category
        const btnDeleteCategory = document.getElementById('btn-delete-category');
        btnDeleteCategory?.addEventListener('click', () => {
            if (!this.currentCategory) return;
            if (this.currentCategory === 'Freelance') {
                alert("La carpeta Freelance se maneja automáticamente y no puede ser eliminada.");
                return;
            }
            if (confirm(`¿Seguro que deseas eliminar la carpeta "${this.currentCategory}"?\nTodas las tareas dentro de esta carpeta se borrarán permanentemente.`)) {
                this.tasks = this.tasks.filter(t => t.category !== this.currentCategory);
                this.categories = this.categories.filter(c => c !== this.currentCategory);
                this.currentCategory = this.categories.length > 0 ? this.categories[0] : null;
                this.saveData();
                this.render();
            }
        });

        // Modal Task
        const btnAddTask = document.getElementById('btn-add-task');
        const taskModal = document.getElementById('tareas-task-modal');
        const taskCancel = document.getElementById('tareas-task-cancel');
        const taskSave = document.getElementById('tareas-task-save');
        const taskInput = document.getElementById('tareas-task-text');
        const urgencyInput = document.getElementById('tareas-task-urgency');

        btnAddTask?.addEventListener('click', () => {
            if (!this.currentCategory) {
                alert("Primero crea una carpeta.");
                return;
            }
            if (this.currentCategory === 'Freelance') {
                alert("Para agregar tareas en Freelance, utiliza el panel integrado.");
                return;
            }
            if (taskInput) taskInput.value = '';
            if (urgencyInput) urgencyInput.value = 'no_urgente';
            taskModal?.classList.remove('hidden');
        });

        taskCancel?.addEventListener('click', () => {
            taskModal?.classList.add('hidden');
        });

        taskSave?.addEventListener('click', () => {
            const text = taskInput?.value.trim();
            if (!text) return;
            const urgency = urgencyInput?.value || 'no_urgente';

            const newTask = {
                id: Date.now(),
                text,
                category: this.currentCategory,
                urgency,
                completed: false,
                createdAt: new Date().toISOString()
            };

            this.tasks.push(newTask);
            this.saveData();
            taskModal?.classList.add('hidden');
            this.render();
            this.app.notificationsCenter?.render();
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
                alert("Por favor selecciona un proyecto primero.");
                return;
            }

            const projects = this.getFreelanceProjects();
            const p = projects.find(x => String(x.id) === String(activeProjId));
            if (!p) {
                alert("Proyecto no encontrado.");
                return;
            }

            if (!p.tasks) p.tasks = [];
            const newTask = {
                id: Date.now(),
                text: text,
                completed: false,
                urgency: freelanceUrgency?.value || 'no_urgente'
            };
            p.tasks.push(newTask);

            this.syncProjectTasksToStores(activeProjId, p.tasks);

            this.saveData();
            this.app.projects?.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.app.notificationsCenter?.updateBadge();
            
            if (freelanceInput) freelanceInput.value = '';
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

    toggleTask(id) {
        const t = this.tasks.find(x => x.id === id);
        if (t) {
            t.completed = !t.completed;
            this.saveData();
            this.render();
            this.app.notificationsCenter?.render();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(x => x.id !== id);
        this.saveData();
        this.render();
        this.app.notificationsCenter?.render();
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

            const p = freelanceProjects.find(x => String(x.id) === String(this.activeProjectId));

            // Actualizar botones de acción del proyecto activo (Fijar / Eliminar)
            const btnPinProject = document.getElementById('btn-pin-freelance-project');
            const lblPinProject = document.getElementById('lbl-pin-freelance-project');
            if (btnPinProject && p) {
                const isPinned = p.isPinned || this.pinnedProjectIds.map(String).includes(String(p.id));
                if (isPinned) {
                    if (lblPinProject) lblPinProject.innerText = 'Desfijar Proyecto';
                    btnPinProject.style.background = 'rgba(59, 130, 246, 0.25)';
                    btnPinProject.style.borderColor = '#3b82f6';
                    btnPinProject.style.color = '#ffffff';
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
                    const isUrgent = t.urgency === 'urgente';
                    const badge = isUrgent 
                        ? `<span class="badge" style="background:var(--status-red); color:white; font-size:0.65rem; padding:2px 6px;">Urgente</span>`
                        : '';
                    const isEditing = String(this.editingTaskId) === String(t.id);
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid var(--surface-border); border-radius:8px; padding:10px 14px;';
                    
                    if (isEditing) {
                        row.innerHTML = `
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; opacity:0.5; pointer-events:none;">
                                    <input type="checkbox" disabled class="task-check">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <input type="text" class="text-input edit-task-input" value="${t.text}" style="flex:1; margin:0; padding:6px 10px; font-size:0.95rem; height:36px; min-width:0;">
                            </div>
                            <div style="display:flex; gap:8px; align-items:center; margin-left:10px;">
                                <button class="btn-save-task" style="background:none; border:none; color:var(--status-green); cursor:pointer; font-size:1.1rem; padding:4px;"><i class="ph ph-check"></i></button>
                                <button class="btn-cancel-task" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.1rem; padding:4px;"><i class="ph ph-x"></i></button>
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
                                    <input type="checkbox" class="task-check">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <span class="task-text-span" style="color:white; font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${t.text} ${badge}</span>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                                <button class="btn-view-task" title="Ver tarea completa" style="background:none; border:none; color:#60a5fa; cursor:pointer; font-size:1.1rem; display:flex; align-items:center; padding:4px;"><i class="ph ph-eye"></i></button>
                                <button class="btn-edit-task" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.1rem; display:flex; align-items:center; padding:4px;"><i class="ph ph-pencil"></i></button>
                                <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
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
                            if (confirm('¿Borrar esta tarea?')) {
                                p.tasks = p.tasks.filter(x => x.id !== t.id);
                                this.syncProjectTasksToStores(p.id, p.tasks);
                                this.saveData();
                                this.app.projects?.saveData();
                                this.app.auth?.syncToCloud(false).catch(() => {});
                                this.app.notificationsCenter?.updateBadge();
                                this.render();
                            }
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
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.03); border-radius:8px; padding:10px 14px;';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px; opacity: 0.6; flex:1; min-width:0;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; flex-shrink:0;">
                                <input type="checkbox" checked class="task-check">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span class="task-text-span" style="color:var(--text-secondary); font-size:0.95rem; text-decoration:line-through; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${t.text}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                            <button class="btn-view-task" title="Ver tarea completa" style="background:none; border:none; color:#60a5fa; cursor:pointer; font-size:1.1rem; display:flex; align-items:center; padding:4px;"><i class="ph ph-eye"></i></button>
                            <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
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
                        if (confirm('¿Borrar esta tarea?')) {
                            p.tasks = p.tasks.filter(x => x.id !== t.id);
                            this.syncProjectTasksToStores(p.id, p.tasks);
                            this.saveData();
                            this.app.projects?.saveData();
                            this.app.auth?.syncToCloud(false).catch(() => {});
                            this.app.notificationsCenter?.updateBadge();
                            this.render();
                        }
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
            const completed = catTasks.filter(t => t.completed);

            if (pending.length === 0) {
                activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">¡Todo listo por aquí! No hay tareas pendientes.</p>';
            } else {
                pending.forEach(t => {
                    const isUrgent = t.urgency === 'urgente';
                    const badge = isUrgent 
                        ? `<span class="badge" style="background:var(--status-red); color:white; font-size:0.65rem; padding:2px 6px;">Urgente</span>`
                        : '';
                    const isEditing = String(this.editingTaskId) === String(t.id);
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid var(--surface-border); border-radius:8px; padding:10px 14px;';
                    
                    if (isEditing) {
                        row.innerHTML = `
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; opacity:0.5; pointer-events:none;">
                                    <input type="checkbox" disabled class="task-check">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <input type="text" class="text-input edit-task-input" value="${t.text}" style="flex:1; margin:0; padding:6px 10px; font-size:0.95rem; height:36px; min-width:0;">
                            </div>
                            <div style="display:flex; gap:8px; align-items:center; margin-left:10px;">
                                <button class="btn-save-task" style="background:none; border:none; color:var(--status-green); cursor:pointer; font-size:1.1rem; padding:4px;"><i class="ph ph-check"></i></button>
                                <button class="btn-cancel-task" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.1rem; padding:4px;"><i class="ph ph-x"></i></button>
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
                                    <input type="checkbox" class="task-check">
                                    <span class="custom-checkbox"></span>
                                </label>
                                <span class="task-text-span" style="color:white; font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${t.text} ${badge}</span>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                                <button class="btn-view-task" title="Ver tarea completa" style="background:none; border:none; color:#60a5fa; cursor:pointer; font-size:1.1rem; display:flex; align-items:center; padding:4px;"><i class="ph ph-eye"></i></button>
                                <button class="btn-edit-task" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.1rem; display:flex; align-items:center; padding:4px;"><i class="ph ph-pencil"></i></button>
                                <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
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
                completedList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay tareas completadas todavía.</p>';
            } else {
                completed.forEach(t => {
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.03); border-radius:8px; padding:10px 14px;';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px; opacity: 0.6; flex:1; min-width:0;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center; flex-shrink:0;">
                                <input type="checkbox" checked class="task-check">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span class="task-text-span" style="color:var(--text-secondary); font-size:0.95rem; text-decoration:line-through; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; cursor:pointer;" title="Haz clic para ver la tarea completa">${t.text}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:10px;">
                            <button class="btn-view-task" title="Ver tarea completa" style="background:none; border:none; color:#60a5fa; cursor:pointer; font-size:1.1rem; display:flex; align-items:center; padding:4px;"><i class="ph ph-eye"></i></button>
                            <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
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
            }
        }
    }
}
