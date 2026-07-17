import { getLocalISODate, parseDateLocal } from '../utils.js';

export class GymModule {
    constructor(appController) {
        this.app = appController;
        this.records = [];
        this.routine = [];
        this.routineFocus = {};
        this.sessions = [];
        this.meals = { fixed: [], variable: [] };
        this.generalMeals = [];
        this.supplements = { vit_d_history: [], vit_d_days_interval: 45, painkillers_history: [] };
        this.weight = [];
        this.activeSession = null;
        this.collapsedGroups = {};

        window.gym = this;
        this.loadData();
        this.setupListeners();
    }

    loadData() {
        try {
            const records = localStorage.getItem('gym_records');
            if (records) this.records = JSON.parse(records);

            const routine = localStorage.getItem('gym_routine');
            if (routine) this.routine = JSON.parse(routine);
            // Purgar ejercicios del fin de semana
            this.routine = this.routine.filter(r => r.day !== 'Sábado' && r.day !== 'Domingo');

            // Sincronizar y generar linkId para la rutina si no existen
            this.routine.forEach(item => {
                if (!item.linkId) {
                    item.linkId = 'link_' + item.id;
                }
            });

            // Emparejar por posición de forma retrospectiva (Lunes-Jueves y Martes-Viernes)
            const pairDays = [['Lunes', 'Jueves'], ['Martes', 'Viernes']];
            pairDays.forEach(([dayA, dayB]) => {
                const listA = this.routine.filter(r => r.day === dayA);
                const listB = this.routine.filter(r => r.day === dayB);
                const maxLen = Math.max(listA.length, listB.length);
                for (let i = 0; i < maxLen; i++) {
                    const itemA = listA[i];
                    const itemB = listB[i];
                    if (itemA && itemB) {
                        itemB.linkId = itemA.linkId;
                    }
                }
            });
            localStorage.setItem('gym_routine', JSON.stringify(this.routine));

            const routineFocus = localStorage.getItem('gym_routine_focus');
            if (routineFocus) this.routineFocus = JSON.parse(routineFocus);
            this.routineFocus = Object.assign({
                'Lunes': '', 'Martes': '', 'Miércoles': '', 'Jueves': '', 'Viernes': '', 'Sábado': '', 'Domingo': ''
            }, this.routineFocus);
            // Purgar focos del fin de semana
            delete this.routineFocus['Sábado'];
            delete this.routineFocus['Domingo'];

            const sessions = localStorage.getItem('gym_sessions');
            if (sessions) this.sessions = JSON.parse(sessions);

            const meals = localStorage.getItem('gym_meals');
            if (meals) this.meals = JSON.parse(meals);
            if (!this.meals.fixed) this.meals.fixed = [];
            if (!this.meals.variable) this.meals.variable = [];

            const generalMeals = localStorage.getItem('gym_general_meals');
            if (generalMeals) this.generalMeals = JSON.parse(generalMeals);
            if (!this.generalMeals) this.generalMeals = [];

            const supplements = localStorage.getItem('gym_supplements');
            if (supplements) this.supplements = JSON.parse(supplements);
            if (!this.supplements.vit_d_history) this.supplements.vit_d_history = [];
            if (!this.supplements.vit_d_days_interval) this.supplements.vit_d_days_interval = 45;
            if (!this.supplements.painkillers_history) this.supplements.painkillers_history = [];
            if (!this.supplements.custom_reminders) {
                this.supplements.custom_reminders = {
                    creatine: { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], time: '23:00' },
                    salmon: { enabled: true, days: [0], time: '17:00' },
                    neck: { enabled: true, days: [5, 6], time: '23:30' }
                };
            }

            const weight = localStorage.getItem('gym_weight');
            if (weight) this.weight = JSON.parse(weight);
        } catch (err) {
            console.error('Error loading Gym data', err);
        }
    }

    saveData(key) {
        if (key === 'gym_records') localStorage.setItem('gym_records', JSON.stringify(this.records));
        else if (key === 'gym_routine') localStorage.setItem('gym_routine', JSON.stringify(this.routine));
        else if (key === 'gym_routine_focus') localStorage.setItem('gym_routine_focus', JSON.stringify(this.routineFocus));
        else if (key === 'gym_sessions') localStorage.setItem('gym_sessions', JSON.stringify(this.sessions));
        else if (key === 'gym_meals') localStorage.setItem('gym_meals', JSON.stringify(this.meals));
        else if (key === 'gym_general_meals') localStorage.setItem('gym_general_meals', JSON.stringify(this.generalMeals));
        else if (key === 'gym_supplements') localStorage.setItem('gym_supplements', JSON.stringify(this.supplements));
        else if (key === 'gym_weight') localStorage.setItem('gym_weight', JSON.stringify(this.weight));

        // Sincronizar silenciosamente a la nube
        this.app.auth?.syncToCloud(false).catch(() => {});
    }

    setupListeners() {
        // Sub-tabs switching
        const container = document.getElementById('gym-tabs-container');
        if (container) {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (!btn) return;
                container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const activeTab = btn.dataset.gymTab;
                document.querySelectorAll('.gym-tab-content').forEach(c => {
                    c.classList.toggle('hidden', c.id !== `gym-${activeTab}-content`);
                });
                this.render();
            });
        }

        // Form 1: Records
        const recordForm = document.getElementById('record-form');
        if (recordForm) {
            recordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('record-exercise').value.trim();
                const weight = parseFloat(document.getElementById('record-weight').value);
                const reps = parseInt(document.getElementById('record-reps').value);
                const rir = document.getElementById('record-rir').value;

                const newRecord = {
                    id: Date.now(),
                    name,
                    weight,
                    reps,
                    rir,
                    date: new Date().toLocaleDateString('es-AR')
                };

                const idx = this.records.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
                if (idx !== -1) {
                    this.records[idx] = newRecord;
                } else {
                    this.records.push(newRecord);
                }

                this.saveData('gym_records');
                this.renderRecords();
                recordForm.reset();
            });
        }

        // Form 2: Routine inline values change
        const routineContainer = document.getElementById('routine-days-container');
        if (routineContainer) {
            routineContainer.addEventListener('change', (e) => {
                const target = e.target;
                const links = { 'Lunes': 'Jueves', 'Jueves': 'Lunes', 'Martes': 'Viernes', 'Viernes': 'Martes' };

                if (target.classList.contains('day-focus-input')) {
                    const day = target.getAttribute('data-day');
                    const val = target.value.trim();
                    this.routineFocus[day] = val;
                    const pairedDay = links[day];
                    if (pairedDay) {
                        this.routineFocus[pairedDay] = val;
                    }
                    this.saveData('gym_routine_focus');
                    this.renderRoutine();
                } else if (target.classList.contains('routine-weight-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const val = parseFloat(target.value);
                    const ex = this.routine.find(r => r.id === id);
                    if (ex) {
                        const weightVal = isNaN(val) ? null : val;
                        ex.weight = weightVal;
                        if (ex.linkId) {
                            this.routine.forEach(r => {
                                if (r.linkId === ex.linkId) r.weight = weightVal;
                            });
                        }
                        this.saveData('gym_routine');
                        this.renderRoutine();
                    }
                } else if (target.classList.contains('routine-reps-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const val = parseInt(target.value);
                    const ex = this.routine.find(r => r.id === id);
                    if (ex) {
                        const repsVal = isNaN(val) ? null : val;
                        ex.reps = repsVal;
                        if (ex.linkId) {
                            this.routine.forEach(r => {
                                if (r.linkId === ex.linkId) r.reps = repsVal;
                            });
                        }
                        this.saveData('gym_routine');
                        this.renderRoutine();
                    }
                } else if (target.classList.contains('routine-series-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const val = parseInt(target.value);
                    const ex = this.routine.find(r => r.id === id);
                    if (ex) {
                        const seriesVal = isNaN(val) || val < 1 ? 3 : val;
                        ex.series = seriesVal;
                        if (ex.linkId) {
                            this.routine.forEach(r => {
                                if (r.linkId === ex.linkId) r.series = seriesVal;
                            });
                        }
                        this.saveData('gym_routine');
                        this.renderRoutine();
                    }
                } else if (target.classList.contains('routine-name-input')) {
                    const id = parseInt(target.getAttribute('data-id'));
                    const val = target.value.trim();
                    const ex = this.routine.find(r => r.id === id);
                    if (ex && val) {
                        ex.name = val;
                        if (ex.linkId) {
                            this.routine.forEach(r => {
                                if (r.linkId === ex.linkId) r.name = val;
                            });
                        }
                        this.saveData('gym_routine');
                        this.renderRoutine();
                    }
                }
            });

            routineContainer.addEventListener('submit', (e) => {
                if (e.target.classList.contains('inline-add-exercise-form')) {
                    e.preventDefault();
                    const day = e.target.getAttribute('data-day');
                    const input = e.target.querySelector('input[type="text"]');
                    const name = input.value.trim();
                    if (!name) return;

                    const linkId = 'link_' + Date.now();

                    this.routine.push({
                        id: Date.now(),
                        linkId,
                        day,
                        name,
                        weight: null,
                        reps: null,
                        series: 3
                    });

                    const links = { 'Lunes': 'Jueves', 'Jueves': 'Lunes', 'Martes': 'Viernes', 'Viernes': 'Martes' };
                    const pairedDay = links[day];
                    if (pairedDay) {
                        this.routine.push({
                            id: Date.now() + 1,
                            linkId,
                            day: pairedDay,
                            name,
                            weight: null,
                            reps: null,
                            series: 3
                        });
                    }

                    this.saveData('gym_routine');
                    this.renderRoutine();

                    // Re-enfocar el input del día correspondiente
                    const newInput = document.querySelector(`.inline-add-exercise-form[data-day="${day}"] input[type="text"]`);
                    if (newInput) newInput.focus();
                }
            });
        }

        // Set today as default in the day selector (Lunes-Viernes)
        const daySelect = document.getElementById('start-session-day-select');
        if (daySelect) {
            const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const todayStr = daysMap[new Date().getDay()];
            if (['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].includes(todayStr)) {
                daySelect.value = todayStr;
            } else {
                daySelect.value = 'Lunes';
            }
        }

        // Form 3: Sessions
        const btnStart = document.getElementById('start-session-btn');
        const btnEnd = document.getElementById('finish-session-btn');
        const activeBox = document.getElementById('current-session');
        const btnAddSet = document.getElementById('add-set-btn');

        if (btnStart) {
            btnStart.addEventListener('click', () => {
                const daySel = document.getElementById('start-session-day-select');
                const selectedDay = daySel ? daySel.value : 'Lunes';

                const dayExercises = this.routine.filter(r => r.day === selectedDay);

                this.activeSession = {
                    id: Date.now(),
                    date: new Date().toLocaleDateString('es-AR'),
                    exercises: {}
                };

                dayExercises.forEach(ex => {
                    const seriesCount = ex.series || 3;
                    this.activeSession.exercises[ex.name] = Array.from({ length: seriesCount }, () => ({
                        weight: ex.weight !== null ? ex.weight : 0,
                        reps: ex.reps !== null ? ex.reps : 0,
                        rir: null,
                        failed: false
                    }));
                });

                document.getElementById('start-session-container').classList.add('hidden');
                activeBox?.classList.remove('hidden');

                const titleEl = document.getElementById('current-session-title');
                const subtitleEl = document.getElementById('current-session-subtitle');
                if (titleEl) titleEl.innerText = `Entrenamiento: ${selectedDay}`;
                if (subtitleEl) {
                    const focus = this.routineFocus[selectedDay] || '';
                    subtitleEl.innerText = focus ? `Foco: ${focus}` : 'Registrando rutina.';
                }

                this.renderActiveSessionForm();
                this.updateRoutineExercisesList();
            });
        }

        const activeContainer = document.getElementById('session-exercises-container');
        if (activeContainer) {
            activeContainer.addEventListener('change', (e) => {
                const target = e.target;
                const exName = target.getAttribute('data-exercise');
                const idx = parseInt(target.getAttribute('data-index'));
                if (!exName || isNaN(idx) || !this.activeSession) return;

                const sets = this.activeSession.exercises[exName];
                if (!sets || !sets[idx]) return;

                if (target.classList.contains('session-set-weight')) {
                    sets[idx].weight = parseFloat(target.value) || 0;
                } else if (target.classList.contains('session-set-reps')) {
                    sets[idx].reps = parseInt(target.value) || 0;
                } else if (target.classList.contains('session-set-rir')) {
                    const val = parseInt(target.value);
                    sets[idx].rir = isNaN(val) ? null : val;
                } else if (target.classList.contains('session-set-failed')) {
                    sets[idx].failed = target.checked;
                }
            });
        }

        if (btnAddSet) {
            btnAddSet.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.activeSession) return;

                const exName = document.getElementById('session-exercise').value.trim();
                const weight = parseFloat(document.getElementById('session-weight').value);
                const reps = parseInt(document.getElementById('session-reps').value);

                if (!exName || isNaN(weight) || isNaN(reps)) {
                    alert('Por favor completa ejercicio, peso y repeticiones.');
                    return;
                }

                if (!this.activeSession.exercises[exName]) {
                    this.activeSession.exercises[exName] = [];
                }

                this.activeSession.exercises[exName].push({ weight, reps, rir: null, failed: false });
                this.renderActiveSessionForm();

                document.getElementById('session-weight').value = '';
                document.getElementById('session-reps').value = '';
            });
        }

        if (btnEnd) {
            btnEnd.addEventListener('click', () => {
                if (!this.activeSession || Object.keys(this.activeSession.exercises).length === 0) {
                    if (!confirm('No registraste series. ¿Cerrar sesión igualmente?')) return;
                }

                if (this.activeSession && Object.keys(this.activeSession.exercises).length > 0) {
                    this.sessions.unshift(this.activeSession);
                    this.saveData('gym_sessions');
                }

                this.activeSession = null;
                activeBox?.classList.add('hidden');
                document.getElementById('start-session-container').classList.remove('hidden');

                document.getElementById('session-exercise').value = '';
                document.getElementById('session-weight').value = '';
                document.getElementById('session-reps').value = '';

                this.renderSessionsLog();
            });
        }

        // Form 4: Nutrition (Comidas Fijas)
        const toggleFixedBtn = document.getElementById('toggle-fixed-form-btn');
        const fixedForm = document.getElementById('fixed-meal-form');
        if (toggleFixedBtn && fixedForm) {
            toggleFixedBtn.addEventListener('click', () => {
                fixedForm.classList.toggle('hidden');
                const isHidden = fixedForm.classList.contains('hidden');
                toggleFixedBtn.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Cargar Comida' : '<i class="ph ph-x"></i> Cancelar';
            });
        }

        if (fixedForm) {
            fixedForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('fixed-meal-name').value.trim();
                const qty = parseFloat(document.getElementById('fixed-meal-qty').value) || 1;
                const unit = document.getElementById('fixed-meal-unit').value || 'u';
                const kcal = parseFloat(document.getElementById('fixed-meal-kcal').value) || 0;
                const protein = parseFloat(document.getElementById('fixed-meal-protein').value) || 0;
                const carbs = parseFloat(document.getElementById('fixed-meal-carbs').value) || 0;
                const fat = parseFloat(document.getElementById('fixed-meal-fat').value) || 0;
                const sodium = parseFloat(document.getElementById('fixed-meal-sodium').value) || 0;
                const fiber = parseFloat(document.getElementById('fixed-meal-fiber').value) || 0;
                const group = document.getElementById('fixed-meal-group').value.trim();

                this.meals.fixed.push({
                    id: Date.now(), name, qty, unit, kcal, protein, carbs, fat, sodium, fiber, group
                });
                this.saveData('gym_meals');
                this.renderNutrition();
                fixedForm.reset();
                fixedForm.classList.add('hidden');
                if (toggleFixedBtn) toggleFixedBtn.innerHTML = '<i class="ph ph-plus"></i> Cargar Comida';
            });
        }

        // Form 5: Comidas Generales
        const toggleGeneralBtn = document.getElementById('toggle-general-form-btn');
        const generalForm = document.getElementById('general-meal-form');
        if (toggleGeneralBtn && generalForm) {
            toggleGeneralBtn.addEventListener('click', () => {
                generalForm.classList.toggle('hidden');
                const isHidden = generalForm.classList.contains('hidden');
                toggleGeneralBtn.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Cargar Comida General' : '<i class="ph ph-x"></i> Cancelar';
            });
        }

        if (generalForm) {
            generalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('general-meal-name').value.trim();
                const qty = parseFloat(document.getElementById('general-meal-qty').value) || 1;
                const unit = document.getElementById('general-meal-unit').value || 'u';
                const kcal = parseFloat(document.getElementById('general-meal-kcal').value) || 0;
                const protein = parseFloat(document.getElementById('general-meal-protein').value) || 0;
                const carbs = parseFloat(document.getElementById('general-meal-carbs').value) || 0;
                const fat = parseFloat(document.getElementById('general-meal-fat').value) || 0;
                const sodium = parseFloat(document.getElementById('general-meal-sodium').value) || 0;
                const fiber = parseFloat(document.getElementById('general-meal-fiber').value) || 0;
                const group = document.getElementById('general-meal-group').value.trim();

                this.generalMeals.push({
                    id: Date.now(), name, qty, unit, kcal, protein, carbs, fat, sodium, fiber, group
                });
                this.saveData('gym_general_meals');
                this.renderGeneralMeals();
                generalForm.reset();
                generalForm.classList.add('hidden');
                if (toggleGeneralBtn) toggleGeneralBtn.innerHTML = '<i class="ph ph-plus"></i> Cargar Comida General';
            });
        }

        // Buscador de comidas generales
        const searchInput = document.getElementById('search-general-meals');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderGeneralMeals();
            });
        }

        // Modal de edición de comida
        const editModal = document.getElementById('nutrition-edit-modal');
        const editCancelBtn = document.getElementById('edit-meal-cancel');
        const editSaveBtn = document.getElementById('edit-meal-save');

        if (editCancelBtn && editModal) {
            editCancelBtn.addEventListener('click', () => {
                editModal.classList.add('hidden');
            });
        }

        if (editSaveBtn && editModal) {
            editSaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const type = editModal.dataset.mealType;
                const id = parseInt(editModal.dataset.mealId);
                let list = type === 'general' ? this.generalMeals : this.meals.fixed;
                
                const meal = list.find(m => m.id === id);
                if (!meal) return;

                const name = document.getElementById('edit-meal-name').value.trim();
                const qty = parseFloat(document.getElementById('edit-meal-qty').value) || 1;
                const unit = document.getElementById('edit-meal-unit').value || 'u';
                const kcal = parseFloat(document.getElementById('edit-meal-kcal').value) || 0;
                const protein = parseFloat(document.getElementById('edit-meal-protein').value) || 0;
                const carbs = parseFloat(document.getElementById('edit-meal-carbs').value) || 0;
                const fat = parseFloat(document.getElementById('edit-meal-fat').value) || 0;
                const sodium = parseFloat(document.getElementById('edit-meal-sodium').value) || 0;
                const fiber = parseFloat(document.getElementById('edit-meal-fiber').value) || 0;
                const group = document.getElementById('edit-meal-group').value.trim();

                if (!name) {
                    alert('Por favor ingresá un nombre para la comida.');
                    return;
                }

                meal.name = name;
                meal.qty = qty;
                meal.unit = unit;
                meal.kcal = kcal;
                meal.protein = protein;
                meal.carbs = carbs;
                meal.fat = fat;
                meal.sodium = sodium;
                meal.fiber = fiber;
                meal.group = group;

                if (type === 'general') {
                    this.saveData('gym_general_meals');
                    this.renderGeneralMeals();
                } else {
                    this.saveData('gym_meals');
                    this.renderNutrition();
                }
                
                editModal.classList.add('hidden');
            });
        }

        // Weight corporal
        const btnWeightLogToggle = document.getElementById('btn-weight-log-toggle');
        const formWeightLog = document.getElementById('weight-log-form');
        const btnWeightHistoryToggle = document.getElementById('btn-weight-history-toggle');

        if (btnWeightLogToggle && formWeightLog) {
            btnWeightLogToggle.addEventListener('click', () => {
                formWeightLog.classList.toggle('hidden');
                const isHidden = formWeightLog.classList.contains('hidden');
                btnWeightLogToggle.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Registrar Peso' : '<i class="ph ph-x"></i> Cancelar';
                if (!isHidden) {
                    document.getElementById('weight-log-date').value = getLocalISODate();
                    document.getElementById('weight-log-val').value = '';
                }
            });
        }

        if (btnWeightHistoryToggle) {
            btnWeightHistoryToggle.addEventListener('click', () => {
                const box = document.getElementById('weight-history-list');
                box?.classList.toggle('hidden');
                const isHidden = box?.classList.contains('hidden');
                btnWeightHistoryToggle.innerHTML = isHidden ? '<i class="ph ph-eye"></i> Historial de Pesos' : '<i class="ph ph-eye-slash"></i> Ocultar Historial';
            });
        }

        if (formWeightLog) {
            formWeightLog.addEventListener('submit', (e) => {
                e.preventDefault();
                const dateVal = document.getElementById('weight-log-date').value;
                const weightVal = document.getElementById('weight-log-val').value;
                const fastingVal = document.getElementById('weight-log-fasting').value;

                if (!dateVal || !weightVal) return;

                this.weight.push({
                    id: Date.now(),
                    date: dateVal,
                    weight: parseFloat(weightVal),
                    fasting: fastingVal ? parseFloat(fastingVal) : null
                });

                this.weight.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
                this.saveData('gym_weight');
                this.renderWeight();
                formWeightLog.reset();
                formWeightLog.classList.add('hidden');
                if (btnWeightLogToggle) btnWeightLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Peso';
            });
        }

        // Vitamin D
        const btnVitdLogToggle = document.getElementById('btn-vitd-log-toggle');
        const formVitdLog = document.getElementById('vitd-log-form');
        const btnVitdSettingsToggle = document.getElementById('btn-vitd-settings-toggle');
        const formVitdSettings = document.getElementById('vitd-settings-form');
        const btnVitdHistoryToggle = document.getElementById('btn-vitd-history-toggle');

        if (btnVitdLogToggle && formVitdLog) {
            btnVitdLogToggle.addEventListener('click', () => {
                formVitdLog.classList.toggle('hidden');
                const isHidden = formVitdLog.classList.contains('hidden');
                btnVitdLogToggle.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Registrar Toma' : '<i class="ph ph-x"></i> Cancelar';
                formVitdSettings?.classList.add('hidden');
                if (btnVitdSettingsToggle) btnVitdSettingsToggle.innerHTML = '<i class="ph ph-gear"></i> Ajustar Días';
                if (!isHidden) {
                    document.getElementById('vitd-log-date').value = getLocalISODate();
                }
            });
        }

        if (btnVitdSettingsToggle && formVitdSettings) {
            btnVitdSettingsToggle.addEventListener('click', () => {
                formVitdSettings.classList.toggle('hidden');
                const isHidden = formVitdSettings.classList.contains('hidden');
                btnVitdSettingsToggle.innerHTML = isHidden ? '<i class="ph ph-gear"></i> Ajustar Días' : '<i class="ph ph-x"></i> Cancelar';
                formVitdLog?.classList.add('hidden');
                if (btnVitdLogToggle) btnVitdLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Toma';
                if (!isHidden) {
                    document.getElementById('vitd-interval-days').value = this.supplements.vit_d_days_interval;
                }
            });
        }

        if (btnVitdHistoryToggle) {
            btnVitdHistoryToggle.addEventListener('click', () => {
                const box = document.getElementById('vitd-history-list');
                box?.classList.toggle('hidden');
                const isHidden = box?.classList.contains('hidden');
                btnVitdHistoryToggle.innerHTML = isHidden ? '<i class="ph ph-eye"></i> Historial' : '<i class="ph ph-eye-slash"></i> Ocultar';
            });
        }

        if (formVitdLog) {
            formVitdLog.addEventListener('submit', (e) => {
                e.preventDefault();
                const dateVal = document.getElementById('vitd-log-date').value;
                if (!dateVal) return;

                this.supplements.vit_d_history.push({ id: Date.now(), date: dateVal });
                this.supplements.vit_d_history.sort((a, b) => new Date(b.date) - new Date(a.date));
                this.saveData('gym_supplements');
                this.renderSupplements();
                formVitdLog.reset();
                formVitdLog.classList.add('hidden');
                if (btnVitdLogToggle) btnVitdLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Toma';
            });
        }

        if (formVitdSettings) {
            formVitdSettings.addEventListener('submit', (e) => {
                e.preventDefault();
                const intervalVal = parseInt(document.getElementById('vitd-interval-days').value);
                if (isNaN(intervalVal) || intervalVal < 1) return;

                this.supplements.vit_d_days_interval = intervalVal;
                this.saveData('gym_supplements');
                this.renderSupplements();
                formVitdSettings.classList.add('hidden');
                if (btnVitdSettingsToggle) btnVitdSettingsToggle.innerHTML = '<i class="ph ph-gear"></i> Ajustar Días';
            });
        }

        // Painkillers
        const btnPainLogToggle = document.getElementById('btn-pain-log-toggle');
        const formPainLog = document.getElementById('pain-log-form');
        const btnPainHistoryToggle = document.getElementById('btn-pain-history-toggle');

        if (btnPainLogToggle && formPainLog) {
            btnPainLogToggle.addEventListener('click', () => {
                formPainLog.classList.toggle('hidden');
                const isHidden = formPainLog.classList.contains('hidden');
                btnPainLogToggle.innerHTML = isHidden ? '<i class="ph ph-plus"></i> Registrar Toma' : '<i class="ph ph-x"></i> Cancelar';
                if (!isHidden) {
                    document.getElementById('pain-log-date').value = getLocalISODate();
                    document.getElementById('pain-log-note').value = '';
                }
            });
        }

        if (btnPainHistoryToggle) {
            btnPainHistoryToggle.addEventListener('click', () => {
                const box = document.getElementById('pain-history-list');
                box?.classList.toggle('hidden');
                const isHidden = box?.classList.contains('hidden');
                btnPainHistoryToggle.innerHTML = isHidden ? '<i class="ph ph-eye"></i> Historial' : '<i class="ph ph-eye-slash"></i> Ocultar';
            });
        }

        if (formPainLog) {
            formPainLog.addEventListener('submit', (e) => {
                e.preventDefault();
                const dateVal = document.getElementById('pain-log-date').value;
                const typeVal = document.getElementById('pain-log-type').value;
                const noteVal = document.getElementById('pain-log-note').value.trim();

                if (!dateVal) return;

                this.supplements.painkillers_history.push({
                    id: Date.now(), date: dateVal, type: typeVal, note: noteVal
                });
                this.supplements.painkillers_history.sort((a, b) => new Date(b.date) - new Date(a.date));
                this.saveData('gym_supplements');
                this.renderPainkillers();
                formPainLog.reset();
                formPainLog.classList.add('hidden');
                if (btnPainLogToggle) btnPainLogToggle.innerHTML = '<i class="ph ph-plus"></i> Registrar Toma';
            });
        }
    }

    render() {
        const activeBtn = document.querySelector('#gym-tabs-container .tab-btn.active');
        const tab = activeBtn ? activeBtn.dataset.gymTab : 'records';

        if (tab === 'records') this.renderRecords();
        else if (tab === 'routine') this.renderRoutine();
        else if (tab === 'sessions') {
            this.renderActiveSessionForm();
            this.renderSessionsLog();
        } else if (tab === 'nutrition') {
            this.renderNutrition();
            this.renderSupplements();
            this.renderPainkillers();
            this.renderWeight();
        } else if (tab === 'general-meals') {
            this.renderGeneralMeals();
        }
    }

    renderRecords() {
        const list = document.getElementById('records-list');
        if (!list) return;
        list.innerHTML = '';

        if (this.records.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 20px;">No hay récords personales guardados.</p>';
            return;
        }

        // Ordenar alfabéticamente
        const sorted = [...this.records].sort((a, b) => a.name.localeCompare(b.name));

        sorted.forEach(r => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header" style="justify-content: space-between;">
                    <h3 style="color: white; font-size: 1rem; margin: 0;">🏆 ${r.name}</h3>
                    <button class="btn-history-delete" data-id="${r.id}" title="Eliminar PR"><i class="ph ph-trash" style="font-size:1.1rem;"></i></button>
                </div>
                <div class="card-body" style="padding-top: 5px;">
                    <div style="font-size: 1.8rem; font-weight: 900; color: var(--status-green); margin: 5px 0;">
                        ${r.weight} <span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">kg</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; gap: 15px;">
                        <span><strong style="color:white;">Reps:</strong> ${r.reps}</span>
                        <span><strong style="color:white;">RIR:</strong> ${r.rir}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 10px; text-align: right;">
                        Logrado: ${r.date}
                    </div>
                </div>
            `;
            card.querySelector('.btn-history-delete').addEventListener('click', () => {
                this.deleteRecord(r.id);
            });
            list.appendChild(card);
        });
    }

    deleteRecord(id) {
        if (confirm('¿Seguro que querés eliminar esta marca personal?')) {
            this.records = this.records.filter(r => r.id !== id);
            this.saveData('gym_records');
            this.renderRecords();
        }
    }

    renderRoutine() {
        const container = document.getElementById('routine-days-container');
        if (!container) return;
        container.innerHTML = '';

        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        days.forEach(day => {
            const dayExercises = this.routine.filter(r => r.day === day);
            const focus = this.routineFocus[day] || '';

            const card = document.createElement('div');
            card.className = 'day-card';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--surface-border); padding-bottom: 0.5rem; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: var(--primary-color); font-size: 1.1rem;">${day}</h3>
                    <input type="text" class="day-focus-input" data-day="${day}" placeholder="Ej: Pecho y Tríceps" value="${focus}">
                </div>
                <div class="routine-exercises-list" style="display:flex; flex-direction:column; gap:8px;">
                    ${dayExercises.length === 0 ? '<p style="color:var(--text-secondary); font-size:0.8rem; font-style:italic; padding:5px 0;">Sin ejercicios programados.</p>' : ''}
                </div>
            `;

            const listContainer = card.querySelector('.routine-exercises-list');

            dayExercises.forEach(ex => {
                const item = document.createElement('div');
                item.className = 'routine-exercise-item';
                item.style.flexDirection = 'column';
                item.style.alignItems = 'stretch';
                item.style.gap = '8px';

                const w = ex.weight !== null ? ex.weight : '';
                const reps = ex.reps !== null ? ex.reps : '';
                const series = ex.series !== undefined && ex.series !== null ? ex.series : 3;

                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <input type="text" class="routine-name-input" data-id="${ex.id}" value="${ex.name}" style="background:transparent; border:none; border-bottom:1px solid transparent; color:white; font-weight:600; font-size:1rem; padding:2px 0; width:80%; outline:none; transition: border-color 0.2s;" onfocus="this.style.borderBottomColor='var(--primary-color)'" onblur="this.style.borderBottomColor='transparent'">
                        <button type="button" class="btn-history-delete" data-id="${ex.id}" style="padding:0;"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </div>
                    <div class="routine-inputs-row">
                        <div class="input-unit-wrapper">
                            <input type="number" step="0.5" class="routine-weight-input" data-id="${ex.id}" placeholder="0.0" value="${w}">
                            <span class="unit-label">kg</span>
                        </div>
                        <span class="separator">×</span>
                        <div class="input-unit-wrapper">
                            <input type="number" class="routine-reps-input" data-id="${ex.id}" placeholder="0" value="${reps}">
                            <span class="unit-label">reps</span>
                        </div>
                        <span class="separator">|</span>
                        <div class="input-unit-wrapper">
                            <input type="number" class="routine-series-input" data-id="${ex.id}" placeholder="3" value="${series}" min="1">
                            <span class="unit-label">series</span>
                        </div>
                    </div>
                `;
                item.querySelector('.btn-history-delete').addEventListener('click', () => {
                    this.deleteRoutine(ex.id);
                });
                listContainer.appendChild(item);
            });

            // Inline add form
            const form = document.createElement('form');
            form.className = 'inline-add-exercise-form';
            form.setAttribute('data-day', day);
            form.innerHTML = `
                <input type="text" class="text-input" placeholder="Añadir ejercicio..." required>
                <button type="submit" class="btn btn-primary"><i class="ph ph-plus"></i></button>
            `;
            card.appendChild(form);

            container.appendChild(card);
        });
    }

    deleteRoutine(id) {
        if (confirm('¿Seguro que querés quitar este ejercicio de la rutina?')) {
            const ex = this.routine.find(r => r.id === id);
            if (ex && ex.linkId) {
                this.routine = this.routine.filter(r => r.linkId !== ex.linkId);
            } else {
                this.routine = this.routine.filter(r => r.id !== id);
            }
            this.saveData('gym_routine');
            this.renderRoutine();
        }
    }

    renderActiveSessionForm() {
        const container = document.getElementById('session-exercises-container');
        if (!container || !this.activeSession) return;
        container.innerHTML = '';

        if (Object.keys(this.activeSession.exercises).length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary); padding: 20px; text-align:center;">Ningún ejercicio cargado todavía.</p>';
            return;
        }

        Object.keys(this.activeSession.exercises).forEach(exName => {
            const sets = this.activeSession.exercises[exName];
            const exDiv = document.createElement('div');
            exDiv.className = 'card';
            exDiv.style.background = 'rgba(255, 255, 255, 0.02)';
            exDiv.style.padding = '15px';
            exDiv.style.border = '1px solid var(--surface-border)';

            let setsHtml = '';
            sets.forEach((set, idx) => {
                const rirVal = set.rir !== null ? set.rir : '';
                const isFailedChecked = set.failed ? 'checked' : '';
                setsHtml += `
                    <div style="display: grid; grid-template-columns: auto 1.2fr 1.2fr 1.2fr auto; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.85rem;">
                        <span style="color: var(--text-secondary); font-weight:600; min-width: 50px;">Serie ${idx + 1}</span>
                        <div class="input-unit-wrapper" style="margin:0;">
                            <input type="number" step="0.5" class="session-set-weight" data-exercise="${exName}" data-index="${idx}" value="${set.weight}" style="padding: 4px 8px; height: 32px; font-size: 0.85rem; width: 100%;">
                            <span class="unit-label" style="font-size:0.75rem;">kg</span>
                        </div>
                        <div class="input-unit-wrapper" style="margin:0;">
                            <input type="number" class="session-set-reps" data-exercise="${exName}" data-index="${idx}" value="${set.reps}" style="padding: 4px 8px; height: 32px; font-size: 0.85rem; width: 100%;">
                            <span class="unit-label" style="font-size:0.75rem;">reps</span>
                        </div>
                        <div class="input-unit-wrapper" style="margin:0;">
                            <span class="unit-label-prefix" style="font-size:0.75rem;">RIR</span>
                            <input type="number" class="session-set-rir" data-exercise="${exName}" data-index="${idx}" placeholder="-" value="${rirVal}" min="0" max="10" style="padding: 4px 8px; height: 32px; font-size: 0.85rem; width: 100%;">
                        </div>
                        <label class="fail-checkbox-wrapper" style="margin:0; display: flex; align-items: center; gap: 4px;">
                            <input type="checkbox" class="session-set-failed" data-exercise="${exName}" data-index="${idx}" ${isFailedChecked}>
                            <span style="font-size: 0.8rem;">Fallo</span>
                        </label>
                    </div>
                `;
            });

            exDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed var(--surface-border); padding-bottom: 5px;">
                    <strong style="color: white; font-size: 0.95rem;">${exName}</strong>
                    <button type="button" class="btn-history-delete" style="padding:0;" title="Quitar Ejercicio"><i class="ph ph-trash" style="font-size:0.95rem;"></i></button>
                </div>
                <div style="display:flex; flex-direction:column;">
                    ${setsHtml}
                </div>
            `;
            exDiv.querySelector('.btn-history-delete').addEventListener('click', () => {
                this.removeExerciseFromActiveSession(exName);
            });
            container.appendChild(exDiv);
        });
    }

    removeExerciseFromActiveSession(exName) {
        if (confirm(`¿Seguro que querés quitar el ejercicio "${exName}" de este entrenamiento?`)) {
            if (this.activeSession && this.activeSession.exercises[exName]) {
                delete this.activeSession.exercises[exName];
                this.renderActiveSessionForm();
            }
        }
    }

    renderSessionsLog() {
        const list = document.getElementById('sessions-history');
        if (!list) return;
        list.innerHTML = '';

        if (this.sessions.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay historial de entrenamientos.</p>';
            return;
        }

        this.sessions.forEach(s => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.background = 'rgba(255,255,255,0.02)';

            let exHtml = '<div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">';
            Object.keys(s.exercises).forEach(ex => {
                const sets = s.exercises[ex];
                const setsStr = sets.map((val, idx) => {
                    let suffix = '';
                    if (val.rir !== undefined && val.rir !== null && val.rir !== '') {
                        suffix += ` (RIR ${val.rir})`;
                    }
                    if (val.failed) {
                        suffix += ' 💥';
                    }
                    return `S${idx+1}: <strong>${val.weight}kg</strong> x ${val.reps}${suffix}`;
                }).join(' | ');
                exHtml += `
                    <div style="font-size:0.85rem; background:rgba(0,0,0,0.15); padding:8px; border-radius:6px; border:1px solid var(--surface-border);">
                        <div style="font-weight:600; color:white; margin-bottom:3px;">${ex}</div>
                        <div style="color:var(--text-secondary);">${setsStr}</div>
                    </div>
                `;
            });
            exHtml += '</div>';

            card.innerHTML = `
                <div class="card-header" style="justify-content: space-between; border-bottom: 1px dashed var(--surface-border); padding-bottom: 0.5rem;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-calendar" style="color:var(--primary-color);"></i>
                        <h4 style="margin: 0; color: white;">Entrenamiento del ${s.date}</h4>
                    </div>
                    <button class="btn-history-delete" style="padding:0;" title="Eliminar Sesión"><i class="ph ph-trash" style="font-size:1.15rem;"></i></button>
                </div>
                <div class="card-body" style="padding-top: 5px;">
                    ${exHtml}
                </div>
            `;
            card.querySelector('.btn-history-delete').addEventListener('click', () => {
                this.deleteSession(s.id);
            });
            list.appendChild(card);
        });
    }

    deleteSession(id) {
        if (confirm('¿Seguro que deseas eliminar permanentemente este entrenamiento del historial?')) {
            this.sessions = this.sessions.filter(s => s.id !== id);
            this.saveData('gym_sessions');
            this.renderSessionsLog();
        }
    }

    updateRoutineExercisesList() {
        const dl = document.getElementById('routine-exercises-list');
        if (!dl) return;

        // Ejercicios únicos en la rutina maestra + marcas anteriores
        const unique = [...new Set([
            ...this.routine.map(r => r.name),
            ...this.records.map(r => r.name)
        ])];

        dl.innerHTML = unique.map(e => `<option value="${e}">`).join('');
    }

    renderNutrition() {
        const fixedBody = document.getElementById('fixed-meals-body');
        if (!fixedBody) return;

        // Render fixed meals
        const fixedTotals = this.renderMealRows(fixedBody, this.meals.fixed, 'fixed');

        // Sumar todo
        const totalKcal = fixedTotals.kcal;
        const totalProtein = fixedTotals.protein;
        const totalCarbs = fixedTotals.carbs;
        const totalFat = fixedTotals.fat;
        const totalSodium = fixedTotals.sodium;
        const totalFiber = fixedTotals.fiber;

        // Actualizar dashboard
        document.getElementById('total-kcal').textContent = totalKcal.toFixed(0);
        document.getElementById('total-protein').textContent = totalProtein.toFixed(1) + 'g';
        document.getElementById('total-carbs').textContent = totalCarbs.toFixed(1) + 'g';
        document.getElementById('total-fat').textContent = totalFat.toFixed(1) + 'g';
        document.getElementById('total-sodium').textContent = totalSodium.toFixed(0) + 'mg';
        document.getElementById('total-fiber').textContent = totalFiber.toFixed(1) + 'g';

        // Auto-complete list for groups
        const fixedGroups = [...new Set(this.meals.fixed.map(m => m.group).filter(Boolean))];
        const fixedDatalist = document.getElementById('fixed-groups-list');
        if (fixedDatalist) fixedDatalist.innerHTML = fixedGroups.map(g => `<option value="${g}">`).join('');
    }

    renderMealRows(body, meals, type) {
        body.innerHTML = '';
        let tKcal = 0, tProtein = 0, tCarbs = 0, tFat = 0, tSodium = 0, tFiber = 0;

        if (meals.length === 0) {
            body.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-secondary); padding: 15px 0;">No hay comidas cargadas.</td></tr>`;
            return { kcal: tKcal, protein: tProtein, carbs: tCarbs, fat: tFat, sodium: tSodium, fiber: tFiber };
        }

        const order = [];
        const groupsMap = {};

        meals.forEach(meal => {
            const grp = meal.group ? meal.group.trim() : '';
            if (grp) {
                if (!groupsMap[grp]) {
                    groupsMap[grp] = [];
                    order.push({ isGroup: true, name: grp });
                }
                groupsMap[grp].push(meal);
            } else {
                order.push({ isGroup: false, meal: meal });
            }
        });

        order.forEach(item => {
            if (item.isGroup) {
                const grpName = item.name;
                const grpMeals = groupsMap[grpName];
                if (!grpMeals || grpMeals.length === 0) return;

                delete groupsMap[grpName]; // Evitar duplicar

                let grpKcal = 0, grpProtein = 0, grpCarbs = 0, grpFat = 0, grpSodium = 0, grpFiber = 0;
                grpMeals.forEach(m => {
                    grpKcal += parseFloat(m.kcal) || 0;
                    grpProtein += parseFloat(m.protein) || 0;
                    grpCarbs += parseFloat(m.carbs) || 0;
                    grpFat += parseFloat(m.fat) || 0;
                    grpSodium += parseFloat(m.sodium) || 0;
                    grpFiber += parseFloat(m.fiber) || 0;
                });

                tKcal += grpKcal;
                tProtein += grpProtein;
                tCarbs += grpCarbs;
                tFat += grpFat;
                tSodium += grpSodium;
                tFiber += grpFiber;

                const collapsedKey = `${type}-${grpName}`;
                const isCollapsed = !!this.collapsedGroups[collapsedKey];

                const trHeader = document.createElement('tr');
                trHeader.style.background = 'rgba(255,255,255,0.02)';
                trHeader.innerHTML = `
                    <td style="padding: 8px;">
                        <button type="button" class="btn-group-toggle" style="background:transparent; border:none; color:var(--primary-color); cursor:pointer; padding: 2px 5px; font-size:0.8rem;">
                            <i class="ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'}"></i>
                        </button>
                        <strong style="color: white;">📁 ${grpName}</strong>
                    </td>
                    <td style="color:var(--text-secondary);">-</td>
                    <td style="font-weight:bold; color:white;">${grpKcal.toFixed(0)}</td>
                    <td style="font-weight:bold; color:white;">${grpProtein.toFixed(1)}g</td>
                    <td style="font-weight:bold; color:white;">${grpCarbs.toFixed(1)}g</td>
                    <td style="font-weight:bold; color:white;">${grpFat.toFixed(1)}g</td>
                    <td style="font-weight:bold; color:white;">${grpSodium.toFixed(0)}mg</td>
                    <td style="font-weight:bold; color:white;">${grpFiber.toFixed(1)}g</td>
                    <td style="text-align:right;">
                        <button class="btn-history-delete" style="padding:0;" title="Eliminar Grupo"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </td>
                `;
                trHeader.querySelector('.btn-group-toggle').addEventListener('click', () => {
                    this.toggleGroupCollapse(type, grpName);
                });
                trHeader.querySelector('.btn-history-delete').addEventListener('click', () => {
                    this.deleteMealGroup(type, grpName);
                });
                body.appendChild(trHeader);

                if (!isCollapsed) {
                    grpMeals.forEach(m => {
                        const trItem = document.createElement('tr');
                        const mKcal = parseFloat(m.kcal) || 0;
                        const mProtein = parseFloat(m.protein) || 0;
                        const mCarbs = parseFloat(m.carbs) || 0;
                        const mFat = parseFloat(m.fat) || 0;
                        const mSodium = parseFloat(m.sodium) || 0;
                        const mFiber = parseFloat(m.fiber) || 0;
                        trItem.innerHTML = `
                            <td style="padding: 8px 8px 8px 24px; color: var(--text-secondary);">↳ ${m.name}</td>
                            <td style="color:var(--text-secondary);">${m.qty || 1}${m.unit || 'u'}</td>
                            <td style="color:white;">${mKcal.toFixed(0)}</td>
                            <td style="color:white;">${mProtein.toFixed(1)}g</td>
                            <td style="color:white;">${mCarbs.toFixed(1)}g</td>
                            <td style="color:white;">${mFat.toFixed(1)}g</td>
                            <td style="color:white;">${mSodium.toFixed(0)}mg</td>
                            <td style="color:white;">${mFiber.toFixed(1)}g</td>
                            <td style="text-align:right; white-space:nowrap;">
                                <button class="btn-history-edit" style="padding:0; margin-right:6px;" title="Editar Comida"><i class="ph ph-pencil" style="font-size:0.95rem;"></i></button>
                                <button class="btn-history-delete" style="padding:0;" title="Eliminar Comida"><i class="ph ph-trash" style="font-size:0.95rem;"></i></button>
                            </td>
                        `;
                        trItem.querySelector('.btn-history-edit').addEventListener('click', () => {
                            this.editMeal(type, m.id);
                        });
                        trItem.querySelector('.btn-history-delete').addEventListener('click', () => {
                            this.deleteMeal(type, m.id);
                        });
                        body.appendChild(trItem);
                    });
                }
            } else {
                const m = item.meal;
                const mKcal = parseFloat(m.kcal) || 0;
                const mProtein = parseFloat(m.protein) || 0;
                const mCarbs = parseFloat(m.carbs) || 0;
                const mFat = parseFloat(m.fat) || 0;
                const mSodium = parseFloat(m.sodium) || 0;
                const mFiber = parseFloat(m.fiber) || 0;

                tKcal += mKcal;
                tProtein += mProtein;
                tCarbs += mCarbs;
                tFat += mFat;
                tSodium += mSodium;
                tFiber += mFiber;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 8px; font-weight:600; color:white;">${m.name}</td>
                    <td>${m.qty || 1}${m.unit || 'u'}</td>
                    <td style="color:white;">${mKcal.toFixed(0)}</td>
                    <td style="color:white;">${mProtein.toFixed(1)}g</td>
                    <td style="color:white;">${mCarbs.toFixed(1)}g</td>
                    <td style="color:white;">${mFat.toFixed(1)}g</td>
                    <td style="color:white;">${mSodium.toFixed(0)}mg</td>
                    <td style="color:white;">${mFiber.toFixed(1)}g</td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button class="btn-history-edit" style="padding:0; margin-right:6px;" title="Editar Comida"><i class="ph ph-pencil" style="font-size:1rem;"></i></button>
                        <button class="btn-history-delete" style="padding:0;" title="Eliminar Comida"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </td>
                `;
                tr.querySelector('.btn-history-edit').addEventListener('click', () => {
                    this.editMeal(type, m.id);
                });
                tr.querySelector('.btn-history-delete').addEventListener('click', () => {
                    this.deleteMeal(type, m.id);
                });
                body.appendChild(tr);
            }
        });

        return { kcal: tKcal, protein: tProtein, carbs: tCarbs, fat: tFat, sodium: tSodium, fiber: tFiber };
    }

    toggleGroupCollapse(type, groupName) {
        const key = `${type}-${groupName}`;
        this.collapsedGroups[key] = !this.collapsedGroups[key];
        if (type === 'general') {
            this.renderGeneralMeals();
        } else {
            this.renderNutrition();
        }
    }

    deleteMealGroup(type, groupName) {
        if (confirm(`¿Seguro que querés eliminar todo el grupo "${groupName}"?`)) {
            if (type === 'general') {
                this.generalMeals = this.generalMeals.filter(m => (m.group || '') !== groupName);
                this.saveData('gym_general_meals');
                this.renderGeneralMeals();
            } else {
                this.meals[type] = this.meals[type].filter(m => (m.group || '') !== groupName);
                this.saveData('gym_meals');
                this.renderNutrition();
            }
        }
    }

    deleteMeal(type, id) {
        if (type === 'general') {
            this.generalMeals = this.generalMeals.filter(m => m.id !== id);
            this.saveData('gym_general_meals');
            this.renderGeneralMeals();
        } else {
            this.meals[type] = this.meals[type].filter(m => m.id !== id);
            this.saveData('gym_meals');
            this.renderNutrition();
        }
    }

    renderWeight() {
        const valSpan = document.getElementById('weight-last-val');
        const dateSpan = document.getElementById('weight-last-date');
        const fastingSpan = document.getElementById('weight-last-fasting');
        const diffSpan = document.getElementById('weight-diff');
        const avgSpan = document.getElementById('weight-average');
        const timerSpan = document.getElementById('weight-timer-count');
        const historyBox = document.getElementById('weight-history-list');

        if (!valSpan || !historyBox) return;

        if (this.weight.length === 0) {
            valSpan.textContent = '-';
            dateSpan.textContent = '-';
            fastingSpan.textContent = '-';
            diffSpan.textContent = '-';
            avgSpan.textContent = '-';
            timerSpan.textContent = '-';
            historyBox.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 10px; font-size:0.85rem;">Historial vacío.</p>';
            return;
        }

        const last = this.weight[0];
        valSpan.textContent = last.weight.toFixed(2) + ' kg';
        dateSpan.textContent = last.date.split('-').reverse().join('/');
        fastingSpan.textContent = last.fasting !== null ? `${last.fasting} hs` : 'Sin registrar';

        // Timer
        const elapsedDays = Math.floor((new Date() - new Date(last.date)) / 86400000);
        timerSpan.textContent = elapsedDays;

        // Difs
        if (this.weight.length > 1) {
            const diff = last.weight - this.weight[1].weight;
            const sign = diff >= 0 ? '+' : '';
            diffSpan.textContent = `${sign}${diff.toFixed(2)} kg`;
            diffSpan.style.color = diff > 0 ? 'var(--status-red)' : 'var(--status-green)';
        } else {
            diffSpan.textContent = '-';
            diffSpan.style.color = 'var(--text-secondary)';
        }

        // Avg
        const sum = this.weight.reduce((acc, curr) => acc + curr.weight, 0);
        avgSpan.textContent = (sum / this.weight.length).toFixed(2) + ' kg';

        // History list
        historyBox.innerHTML = '';
        this.weight.forEach(w => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.fontSize = '0.8rem';
            el.style.padding = '6px 0';
            el.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            el.style.color = 'white';
            el.style.alignItems = 'center';
            el.innerHTML = `
                <span>📅 ${w.date.split('-').reverse().join('/')} - ⚖️ <strong>${w.weight.toFixed(2)}kg</strong> ${w.fasting ? `(${w.fasting}h ayuno)` : ''}</span>
                <button class="btn-history-delete" style="padding:0;"><i class="ph ph-trash" style="font-size:0.9rem;"></i></button>
            `;
            el.querySelector('.btn-history-delete').addEventListener('click', () => {
                this.deleteWeight(w.id);
            });
            historyBox.appendChild(el);
        });
    }

    deleteWeight(id) {
        if (confirm('¿Eliminar esta marca de peso corporal del historial?')) {
            this.weight = this.weight.filter(w => w.id !== id);
            this.saveData('gym_weight');
            this.renderWeight();
        }
    }

    renderSupplements() {
        const lastSpan = document.getElementById('vitd-last-date');
        const nextSpan = document.getElementById('vitd-next-date');
        const timerSpan = document.getElementById('vitd-timer-count');
        const badge = document.getElementById('vitd-badge');
        const histBox = document.getElementById('vitd-history-list');

        if (!lastSpan || !histBox) return;

        if (this.supplements.vit_d_history.length === 0) {
            lastSpan.textContent = '-';
            nextSpan.textContent = '-';
            timerSpan.textContent = '-';
            if (badge) {
                badge.textContent = 'Sin Tomas';
                badge.className = 'badge';
                badge.style.background = 'gray';
            }
            histBox.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 10px; font-size:0.85rem;">Historial vacío.</p>';
            return;
        }

        const last = parseDateLocal(this.supplements.vit_d_history[0].date);
        if (!last) return;
        last.setHours(0, 0, 0, 0);
        const interval = this.supplements.vit_d_days_interval;
        const next = new Date(last.getTime() + interval * 24 * 60 * 60 * 1000);
        next.setHours(0, 0, 0, 0);

        lastSpan.textContent = last.toLocaleDateString('es-AR');
        nextSpan.textContent = next.toLocaleDateString('es-AR');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const remainingDays = Math.ceil((next - today) / 86400000);
        timerSpan.textContent = Math.max(0, remainingDays);

        const timerBox = document.getElementById('vitd-timer-box');

        if (badge) {
            badge.style.background = '';
            badge.style.color = '';
            if (remainingDays <= 0) {
                badge.textContent = 'PENDIENTE';
                badge.className = 'badge red';
                timerSpan.style.color = 'var(--status-red)';
                if (timerBox) timerBox.style.borderColor = 'var(--status-red)';
            } else if (remainingDays <= 7) {
                badge.textContent = 'Próximo';
                badge.className = 'badge orange';
                timerSpan.style.color = 'var(--status-orange)';
                if (timerBox) timerBox.style.borderColor = 'var(--status-orange)';
            } else {
                badge.textContent = 'Al día';
                badge.className = 'badge green';
                timerSpan.style.color = 'var(--status-green)';
                if (timerBox) timerBox.style.borderColor = 'var(--surface-border)';
            }
        }

        histBox.innerHTML = '';
        this.supplements.vit_d_history.forEach(t => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.fontSize = '0.8rem';
            el.style.padding = '6px 0';
            el.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            el.style.color = 'white';
            el.style.alignItems = 'center';
            el.innerHTML = `
                <span>📅 Toma: ${new Date(t.date).toLocaleDateString('es-AR')}</span>
                <button class="btn-history-delete" style="padding:0;"><i class="ph ph-trash" style="font-size:0.9rem;"></i></button>
            `;
            el.querySelector('.btn-history-delete').addEventListener('click', () => {
                this.deleteVitdTake(t.id);
            });
            histBox.appendChild(el);
        });
    }

    deleteVitdTake(id) {
        if (confirm('¿Eliminar este registro de toma de Vitamina D?')) {
            this.supplements.vit_d_history = this.supplements.vit_d_history.filter(t => t.id !== id);
            this.saveData('gym_supplements');
            this.renderSupplements();
        }
    }

    renderPainkillers() {
        const lastSpan = document.getElementById('pain-last-date');
        const typeSpan = document.getElementById('pain-last-type');
        const noteSpan = document.getElementById('pain-last-note');
        const timerSpan = document.getElementById('pain-timer-count');
        const badge = document.getElementById('pain-badge');
        const histBox = document.getElementById('pain-history-list');

        if (!lastSpan || !histBox) return;

        if (this.supplements.painkillers_history.length === 0) {
            lastSpan.textContent = '-';
            typeSpan.textContent = '-';
            noteSpan.textContent = '-';
            timerSpan.textContent = '-';
            if (badge) {
                badge.textContent = 'Ninguno';
                badge.className = 'badge gray';
            }
            histBox.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 10px; font-size:0.85rem;">Historial vacío.</p>';
            return;
        }

        const last = this.supplements.painkillers_history[0];
        const lastDate = parseDateLocal(last.date);
        if (!lastDate) return;
        lastSpan.textContent = lastDate.toLocaleDateString('es-AR');
        typeSpan.textContent = last.type;
        noteSpan.textContent = last.note || 'Sin detalles';

        // Calcular días limpio
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastDateMidnight = new Date(lastDate);
        lastDateMidnight.setHours(0, 0, 0, 0);
        const elapsedDays = Math.floor((today - lastDateMidnight) / 86400000);
        timerSpan.textContent = elapsedDays;

        const timerBox = document.getElementById('pain-timer-box');
        if (elapsedDays === 0) {
            timerSpan.style.color = 'var(--status-red)';
            if (timerBox) timerBox.style.borderColor = 'var(--status-red)';
        } else if (elapsedDays === 1) {
            timerSpan.style.color = 'var(--status-orange)';
            if (timerBox) timerBox.style.borderColor = 'var(--status-orange)';
        } else {
            timerSpan.style.color = 'var(--status-green)';
            if (timerBox) timerBox.style.borderColor = 'var(--status-green)';
        }

        // Contadores
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
        const startOfMonth = startOfToday - 29 * 24 * 60 * 60 * 1000;

        let dayCount = 0, weekCount = 0, monthCount = 0;

        this.supplements.painkillers_history.forEach(p => {
            const dateObj = parseDateLocal(p.date);
            if (dateObj) {
                const time = dateObj.getTime();
                if (time >= startOfToday) dayCount++;
                if (time >= startOfWeek) weekCount++;
                if (time >= startOfMonth) monthCount++;
            }
        });

        // Hoy
        const elDay = document.getElementById('pain-count-day');
        const boxDay = document.getElementById('pain-box-day');
        if (elDay) {
            elDay.textContent = `${dayCount} / 2`;
            if (dayCount >= 2) {
                elDay.style.color = 'var(--status-red)';
                if (boxDay) boxDay.style.borderColor = 'var(--status-red)';
            } else if (dayCount === 1) {
                elDay.style.color = 'var(--status-orange)';
                if (boxDay) boxDay.style.borderColor = 'var(--status-orange)';
            } else {
                elDay.style.color = 'var(--status-green)';
                if (boxDay) boxDay.style.borderColor = 'var(--surface-border)';
            }
        }

        // Semana
        const elWeek = document.getElementById('pain-count-week');
        const boxWeek = document.getElementById('pain-box-week');
        if (elWeek) {
            elWeek.textContent = `${weekCount} / 6`;
            if (weekCount >= 6) {
                elWeek.style.color = 'var(--status-red)';
                if (boxWeek) boxWeek.style.borderColor = 'var(--status-red)';
            } else if (weekCount >= 4) {
                elWeek.style.color = 'var(--status-orange)';
                if (boxWeek) boxWeek.style.borderColor = 'var(--status-orange)';
            } else {
                elWeek.style.color = 'var(--status-green)';
                if (boxWeek) boxWeek.style.borderColor = 'var(--surface-border)';
            }
        }

        // Mes
        const elMonth = document.getElementById('pain-count-month');
        const boxMonth = document.getElementById('pain-box-month');
        if (elMonth) {
            elMonth.textContent = `${monthCount} / 10`;
            if (monthCount >= 10) {
                elMonth.style.color = 'var(--status-red)';
                if (boxMonth) boxMonth.style.borderColor = 'var(--status-red)';
            } else if (monthCount >= 8) {
                elMonth.style.color = 'var(--status-orange)';
                if (boxMonth) boxMonth.style.borderColor = 'var(--status-orange)';
            } else {
                elMonth.style.color = 'var(--status-green)';
                if (boxMonth) boxMonth.style.borderColor = 'var(--surface-border)';
            }
        }

        if (badge) {
            badge.style.background = '';
            badge.style.color = '';
            if (dayCount > 2 || weekCount > 6 || monthCount > 10) {
                badge.textContent = '¡EXCESO!';
                badge.className = 'badge red';
            } else if (dayCount === 2 || weekCount >= 5 || monthCount >= 8) {
                badge.textContent = 'Al límite';
                badge.className = 'badge orange';
            } else {
                badge.textContent = 'Uso seguro';
                badge.className = 'badge green';
            }
        }

        histBox.innerHTML = '';
        this.supplements.painkillers_history.forEach(p => {
            const dateObj = parseDateLocal(p.date);
            const friendlyDate = dateObj ? dateObj.toLocaleDateString('es-AR') : p.date;
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.fontSize = '0.8rem';
            el.style.padding = '6px 0';
            el.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            el.style.color = 'white';
            el.style.alignItems = 'center';
            el.innerHTML = `
                <span>📅 ${friendlyDate} - 💊 <strong>${p.type}</strong> ${p.note ? `(${p.note})` : ''}</span>
                <button class="btn-history-delete" style="padding:0;"><i class="ph ph-trash" style="font-size:0.9rem;"></i></button>
            `;
            el.querySelector('.btn-history-delete').addEventListener('click', () => {
                this.deletePainkillerTake(p.id);
            });
            histBox.appendChild(el);
        });
    }

    deletePainkillerTake(id) {
        if (confirm('¿Eliminar este registro de toma de analgésico?')) {
            this.supplements.painkillers_history = this.supplements.painkillers_history.filter(p => p.id !== id);
            this.saveData('gym_supplements');
            this.renderPainkillers();
        }
    }

    editMeal(type, id) {
        let list = type === 'general' ? this.generalMeals : this.meals.fixed;
        const meal = list.find(m => m.id === id);
        if (!meal) return;

        const modal = document.getElementById('nutrition-edit-modal');
        if (!modal) return;

        // Rellenar campos
        document.getElementById('edit-meal-name').value = meal.name || '';
        document.getElementById('edit-meal-qty').value = meal.qty !== undefined ? meal.qty : 1;
        document.getElementById('edit-meal-unit').value = meal.unit || 'u';
        document.getElementById('edit-meal-kcal').value = meal.kcal !== undefined ? meal.kcal : 0;
        document.getElementById('edit-meal-protein').value = meal.protein !== undefined ? meal.protein : 0;
        document.getElementById('edit-meal-carbs').value = meal.carbs !== undefined ? meal.carbs : 0;
        document.getElementById('edit-meal-fat').value = meal.fat !== undefined ? meal.fat : 0;
        document.getElementById('edit-meal-sodium').value = meal.sodium !== undefined ? meal.sodium : 0;
        document.getElementById('edit-meal-fiber').value = meal.fiber !== undefined ? meal.fiber : 0;
        document.getElementById('edit-meal-group').value = meal.group || '';

        // Guardar metadata
        modal.dataset.mealType = type;
        modal.dataset.mealId = id;

        modal.classList.remove('hidden');
    }

    copyToFixed(id) {
        const meal = this.generalMeals.find(m => m.id === id);
        if (!meal) return;

        // Clonamos la comida a la lista de fijas
        this.meals.fixed.push({
            id: Date.now(),
            name: meal.name,
            qty: meal.qty,
            unit: meal.unit,
            kcal: meal.kcal,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            sodium: meal.sodium,
            fiber: meal.fiber,
            group: meal.group
        });

        this.saveData('gym_meals');
        alert(`¡"${meal.name}" copiado a Comidas Fijas con éxito!`);
        this.renderNutrition();
    }

    renderGeneralMeals() {
        const body = document.getElementById('general-meals-body');
        if (!body) return;

        const searchInput = document.getElementById('search-general-meals');
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // Filtrar según búsqueda
        let filtered = this.generalMeals;
        if (query) {
            filtered = this.generalMeals.filter(m => 
                (m.name || '').toLowerCase().includes(query) || 
                (m.group || '').toLowerCase().includes(query)
            );
        }

        body.innerHTML = '';

        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-secondary); padding: 15px 0;">No hay comidas generales guardadas.</td></tr>`;
            return;
        }

        const order = [];
        const groupsMap = {};

        filtered.forEach(meal => {
            const grp = meal.group ? meal.group.trim() : '';
            if (grp) {
                if (!groupsMap[grp]) {
                    groupsMap[grp] = [];
                    order.push({ isGroup: true, name: grp });
                }
                groupsMap[grp].push(meal);
            } else {
                order.push({ isGroup: false, meal: meal });
            }
        });

        order.forEach(item => {
            if (item.isGroup) {
                const grpName = item.name;
                const grpMeals = groupsMap[grpName];
                if (!grpMeals || grpMeals.length === 0) return;

                delete groupsMap[grpName];

                const collapsedKey = `general-${grpName}`;
                const isCollapsed = !!this.collapsedGroups[collapsedKey];

                const trHeader = document.createElement('tr');
                trHeader.style.background = 'rgba(255,255,255,0.02)';
                trHeader.innerHTML = `
                    <td style="padding: 8px;">
                        <button type="button" class="btn-group-toggle" style="background:transparent; border:none; color:var(--primary-color); cursor:pointer; padding: 2px 5px; font-size:0.8rem;">
                            <i class="ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'}"></i>
                        </button>
                        <strong style="color: white;">📁 ${grpName}</strong>
                    </td>
                    <td colspan="7" style="color:var(--text-secondary);">-</td>
                    <td style="text-align:right;">
                        <button class="btn-history-delete" style="padding:0;" title="Eliminar Grupo"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </td>
                `;
                trHeader.querySelector('.btn-group-toggle').addEventListener('click', () => {
                    this.toggleGroupCollapse('general', grpName);
                });
                trHeader.querySelector('.btn-history-delete').addEventListener('click', () => {
                    this.deleteMealGroup('general', grpName);
                });
                body.appendChild(trHeader);

                if (!isCollapsed) {
                    grpMeals.forEach(m => {
                        const trItem = document.createElement('tr');
                        trItem.innerHTML = `
                            <td style="padding: 8px 8px 8px 24px; color: var(--text-secondary);">↳ ${m.name}</td>
                            <td style="color:var(--text-secondary);">${m.qty || 1}${m.unit || 'u'}</td>
                            <td style="color:white;">${(parseFloat(m.kcal) || 0).toFixed(0)}</td>
                            <td style="color:white;">${(parseFloat(m.protein) || 0).toFixed(1)}g</td>
                            <td style="color:white;">${(parseFloat(m.carbs) || 0).toFixed(1)}g</td>
                            <td style="color:white;">${(parseFloat(m.fat) || 0).toFixed(1)}g</td>
                            <td style="color:white;">${(parseFloat(m.sodium) || 0).toFixed(0)}mg</td>
                            <td style="color:white;">${(parseFloat(m.fiber) || 0).toFixed(1)}g</td>
                            <td style="text-align:right; white-space:nowrap;">
                                <button class="btn-copy-fixed" style="padding:0; margin-right:6px;" title="Copiar a Comidas Fijas"><i class="ph ph-calendar-plus" style="font-size:0.95rem;"></i></button>
                                <button class="btn-history-edit" style="padding:0; margin-right:6px;" title="Editar Comida"><i class="ph ph-pencil" style="font-size:0.95rem;"></i></button>
                                <button class="btn-history-delete" style="padding:0;" title="Eliminar Comida"><i class="ph ph-trash" style="font-size:0.95rem;"></i></button>
                            </td>
                        `;
                        trItem.querySelector('.btn-copy-fixed').addEventListener('click', () => {
                            this.copyToFixed(m.id);
                        });
                        trItem.querySelector('.btn-history-edit').addEventListener('click', () => {
                            this.editMeal('general', m.id);
                        });
                        trItem.querySelector('.btn-history-delete').addEventListener('click', () => {
                            this.deleteMeal('general', m.id);
                        });
                        body.appendChild(trItem);
                    });
                }
            } else {
                const m = item.meal;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 8px; font-weight:600; color:white;">${m.name}</td>
                    <td>${m.qty || 1}${m.unit || 'u'}</td>
                    <td style="color:white;">${(parseFloat(m.kcal) || 0).toFixed(0)}</td>
                    <td style="color:white;">${(parseFloat(m.protein) || 0).toFixed(1)}g</td>
                    <td style="color:white;">${(parseFloat(m.carbs) || 0).toFixed(1)}g</td>
                    <td style="color:white;">${(parseFloat(m.fat) || 0).toFixed(1)}g</td>
                    <td style="color:white;">${(parseFloat(m.sodium) || 0).toFixed(0)}mg</td>
                    <td style="color:white;">${(parseFloat(m.fiber) || 0).toFixed(1)}g</td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button class="btn-copy-fixed" style="padding:0; margin-right:6px;" title="Copiar a Comidas Fijas"><i class="ph ph-calendar-plus" style="font-size:1rem;"></i></button>
                        <button class="btn-history-edit" style="padding:0; margin-right:6px;" title="Editar Comida"><i class="ph ph-pencil" style="font-size:1rem;"></i></button>
                        <button class="btn-history-delete" style="padding:0;" title="Eliminar Comida"><i class="ph ph-trash" style="font-size:1rem;"></i></button>
                    </td>
                `;
                tr.querySelector('.btn-copy-fixed').addEventListener('click', () => {
                    this.copyToFixed(m.id);
                });
                tr.querySelector('.btn-history-edit').addEventListener('click', () => {
                    this.editMeal('general', m.id);
                });
                tr.querySelector('.btn-history-delete').addEventListener('click', () => {
                    this.deleteMeal('general', m.id);
                });
                body.appendChild(tr);
            }
        });

        // Datalist autocomplete for general groups
        const generalGroups = [...new Set(this.generalMeals.map(m => m.group).filter(Boolean))];
        const generalDatalist = document.getElementById('general-groups-list');
        if (generalDatalist) generalDatalist.innerHTML = generalGroups.map(g => `<option value="${g}">`).join('');
    }
}
