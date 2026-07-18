export class TareasModule {
    constructor(appController) {
        this.app = appController;
        this.tasks = [];
        this.categories = [];
        this.currentCategory = null;
        this.activeProjectId = null;

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

            if (this.categories.length > 0) {
                this.currentCategory = this.categories[0];
            }
        } catch (e) {
            console.error("Error loading Tareas data:", e);
            this.tasks = [];
            this.categories = ['Personal', 'LifeCycle', 'Facultad', 'Cotidianas', 'Freelance'];
            this.currentCategory = this.categories[0];
        }
    }

    saveData() {
        localStorage.setItem('tareas_list', JSON.stringify(this.tasks));
        localStorage.setItem('tareas_categories', JSON.stringify(this.categories));
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

            const p = this.app.projects?.projects?.find(x => String(x.id) === String(activeProjId));
            if (!p) {
                alert("Proyecto no encontrado.");
                return;
            }

            if (!p.tasks) p.tasks = [];
            p.tasks.push({
                id: Date.now(),
                text: text,
                completed: false,
                urgency: freelanceUrgency?.value || 'no_urgente'
            });

            this.app.projects.saveData();
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

            const activeProjects = this.app.projects?.projects || [];
            const freelanceTabs = document.getElementById('tareas-freelance-tabs');

            if (activeProjects.length === 0) {
                if (freelanceTabs) freelanceTabs.innerHTML = '';
                if (activeTitle) activeTitle.innerText = 'Tareas Pendientes (Freelance)';
                activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No tienes proyectos activos creados. Ve a la sección Proyectos para agregar uno.</p>';
                completedList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">-</p>';
                this.activeProjectId = null;
                return;
            }

            // Seleccionar proyecto por defecto
            if (!this.activeProjectId || !activeProjects.some(x => String(x.id) === String(this.activeProjectId))) {
                this.activeProjectId = activeProjects[0].id;
            }

            // Render project tabs
            if (freelanceTabs) {
                freelanceTabs.innerHTML = '';
                activeProjects.forEach(p => {
                    const btn = document.createElement('button');
                    btn.className = `tab-btn ${String(this.activeProjectId) === String(p.id) ? 'active' : ''}`;
                    const fullName = p.client ? `${p.client} - ${p.project}` : p.project;
                    btn.innerText = fullName;
                    btn.title = fullName;
                    btn.style.maxWidth = '250px';
                    btn.style.overflow = 'hidden';
                    btn.style.textOverflow = 'ellipsis';
                    btn.style.whiteSpace = 'nowrap';
                    btn.onclick = () => {
                        this.activeProjectId = p.id;
                        this.render();
                    };
                    freelanceTabs.appendChild(btn);
                });
            }

            const p = activeProjects.find(x => String(x.id) === String(this.activeProjectId));
            if (!p) return;

            if (activeTitle) {
                activeTitle.innerText = `Tareas Pendientes (Freelance - ${p.client ? p.client + ': ' + p.project : p.project})`;
            }

            const tasks = p.tasks || [];
            const pending = tasks.filter(t => !t.completed);
            const completed = tasks.filter(t => t.completed);

            // Render Pendientes
            if (pending.length === 0) {
                activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">¡Todo listo por aquí! No hay tareas pendientes en este proyecto.</p>';
            } else {
                pending.forEach(t => {
                    const isUrgent = t.urgency === 'urgente';
                    const badge = isUrgent 
                        ? `<span class="badge" style="background:var(--status-red); color:white; font-size:0.65rem; padding:2px 6px;">Urgente</span>`
                        : '';
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid var(--surface-border); border-radius:8px; padding:10px 14px;';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center;">
                                <input type="checkbox" class="task-check">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span style="color:white; font-size:0.95rem;">${t.text} ${badge}</span>
                        </div>
                        <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
                    `;
                    row.querySelector('.task-check').addEventListener('change', () => {
                        t.completed = true;
                        this.app.projects.saveData();
                        this.app.auth?.syncToCloud(false).catch(() => {});
                        this.app.notificationsCenter?.updateBadge();
                        this.render();
                    });
                    row.querySelector('.btn-delete-task').addEventListener('click', () => {
                        if (confirm('¿Borrar esta tarea?')) {
                            p.tasks = p.tasks.filter(x => x.id !== t.id);
                            this.app.projects.saveData();
                            this.app.auth?.syncToCloud(false).catch(() => {});
                            this.app.notificationsCenter?.updateBadge();
                            this.render();
                        }
                    });
                    activeList.appendChild(row);
                });
            }

            // Render Completadas
            if (completed.length === 0) {
                completedList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay tareas completadas todavía.</p>';
            } else {
                completed.forEach(t => {
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.03); border-radius:8px; padding:10px 14px;';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px; opacity: 0.6;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center;">
                                <input type="checkbox" checked class="task-check">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span style="color:var(--text-secondary); font-size:0.95rem; text-decoration:line-through;">${t.text}</span>
                        </div>
                        <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
                    `;
                    row.querySelector('.task-check').addEventListener('change', () => {
                        t.completed = false;
                        this.app.projects.saveData();
                        this.app.auth?.syncToCloud(false).catch(() => {});
                        this.app.notificationsCenter?.updateBadge();
                        this.render();
                    });
                    row.querySelector('.btn-delete-task').addEventListener('click', () => {
                        if (confirm('¿Borrar esta tarea?')) {
                            p.tasks = p.tasks.filter(x => x.id !== t.id);
                            this.app.projects.saveData();
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
                    const row = document.createElement('div');
                    row.className = 'task-item';
                    row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid var(--surface-border); border-radius:8px; padding:10px 14px;';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center;">
                                <input type="checkbox" class="task-check">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span style="color:white; font-size:0.95rem;">${t.text} ${badge}</span>
                        </div>
                        <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
                    `;
                    row.querySelector('.task-check').addEventListener('change', () => {
                        this.toggleTask(t.id);
                    });
                    row.querySelector('.btn-delete-task').addEventListener('click', () => {
                        this.deleteTask(t.id);
                    });
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
                        <div style="display:flex; align-items:center; gap:10px; opacity: 0.6;">
                            <label class="custom-checkbox-container" style="margin: 0; display: flex; align-items: center;">
                                <input type="checkbox" checked class="task-check">
                                <span class="custom-checkbox"></span>
                            </label>
                            <span style="color:var(--text-secondary); font-size:0.95rem; text-decoration:line-through;">${t.text}</span>
                        </div>
                        <button class="btn-delete-task" style="background:none; border:none; color:var(--status-red); cursor:pointer; font-size:1.2rem; display:flex; align-items:center; padding:4px;">&times;</button>
                    `;
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
