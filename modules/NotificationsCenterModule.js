import {
    DateUtils,
    getLocalISODate,
    GROOMING_RULES,
    itemsConfig,
    LENS_LIMITS,
    parseDateLocal
} from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import {
    getCustomTrackerState,
    isStateReminderTracker
} from '../custom-tracker-utils.mjs?v=20260811-special-trackers';

const COMPLETABLE_MODULES = new Set([
    'hygiene',
    'robot',
    'grooming',
    'lenses',
    'custom_tracker',
    'vehicle',
    'workana',
    'tareas',
    'projects_tasks'
]);

export class NotificationsCenterModule {
    constructor(appController) {
        this.app = appController;
        this.bellBtn = document.getElementById('notification-bell-btn');
        this.badge = document.getElementById('notification-badge');
        this.panel = document.getElementById('notification-dropdown-panel');
        this.countText = document.getElementById('notification-dropdown-count');
        this.listContainer = document.getElementById('notification-list');
        
        this.init();
    }

    init() {
        if (!this.bellBtn || !this.panel) return;
        
        this.bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.app?.tooltips?.hide();
            this.panel.classList.toggle('hidden');
            if (!this.panel.classList.contains('hidden')) {
                this.render();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (this.panel && !this.panel.contains(e.target) && !this.bellBtn.contains(e.target)) {
                this.panel.classList.add('hidden');
            }
        });
        
        // Renderizado inicial y polling periódico
        setTimeout(() => this.updateBadge(), 1000);
        setInterval(() => this.updateBadge(), 30000);
    }

    getOverdueItems() {
        const items = [];
        try {
            const now = new Date();
            const hasUnifiedTrackers = this.app.customTrackers?.registry?.version === 2;

            if (hasUnifiedTrackers) {
                this.app.customTrackers.registry.trackers
                    .filter(tracker => !tracker.archived && !tracker.deleted)
                    .forEach(tracker => {
                        const state = getCustomTrackerState(
                            tracker,
                            this.app.customTrackers.getHistory(tracker.id),
                            now
                        );
                        if (state.status !== 'red') return;
                        if (isStateReminderTracker(tracker)) {
                            const elapsedText = state.elapsedHours >= 24
                                ? `${state.elapsedDays} ${state.elapsedDays === 1 ? 'día' : 'días'}`
                                : `${state.elapsedHours} ${state.elapsedHours === 1 ? 'hora' : 'horas'}`;
                            items.push({
                                module: 'custom_tracker',
                                id: tracker.id,
                                name: tracker.name,
                                icon: tracker.icon,
                                desc: `Pendiente hace ${elapsedText}; los avisos continúan hasta resolverlo.`
                            });
                            return;
                        }
                        const cadenceText = state.cadence.unit === 'months'
                            ? `${state.cadence.value} ${state.cadence.value === 1 ? 'mes' : 'meses'}`
                            : `${state.dueValue} días`;
                        items.push({
                            module: 'custom_tracker',
                            id: tracker.id,
                            name: tracker.name,
                            icon: tracker.icon,
                            desc: `Pasaron ${state.elapsedDays} días; frecuencia configurada: ${cadenceText}.`
                        });
                    });
            }

            // 1. HIGIENE
            if (this.app.hygiene) {
                const hData = this.app.hygiene.data || {};
                if (!hasUnifiedTrackers) {
                    itemsConfig.forEach(item => {
                        if (!item.limits) return;
                        const val = hData[item.id];
                        // Permitir soporte para arrays (historial) o strings
                        const history = Array.isArray(val) ? val : (val ? [val] : []);
                        const lastDateVal = history[0] || null;
                        const elapsed = this.app.hygiene.getDaysElapsed(lastDateVal);
                        if (elapsed !== null && elapsed >= item.limits.red) {
                            items.push({
                                module: 'hygiene',
                                id: item.id,
                                name: item.name,
                                icon: item.icon || 'ph-sparkle',
                                desc: `Pasaron ${elapsed} de ${item.limits.red} días.`
                            });
                        }
                    });
                }
                // Robot aspiradora
                const hasUnifiedRobot = hasUnifiedTrackers
                    && this.app.customTrackers.registry.trackers.some(tracker => (
                        isStateReminderTracker(tracker)
                        && (tracker.alertKey === 'robot' || tracker.id === 'trk_hygiene_robot_cleaner')
                        && !tracker.deleted
                    ));
                if (
                    !hasUnifiedRobot
                    && hData.robot_cleaner
                    && hData.robot_cleaner.status === 'dirty'
                ) {
                    let timeText = 'Robot Sucio';
                    if (hData.robot_cleaner.marked_dirty_at) {
                        const elapsedMs = now - new Date(hData.robot_cleaner.marked_dirty_at);
                        const elapsedHours = Math.floor(elapsedMs / 3600000);
                        const elapsedMins = Math.floor((elapsedMs % 3600000) / 60000);
                        timeText = elapsedHours > 0 ? `Lleva sucio ${elapsedHours}h ${elapsedMins}m` : `Lleva sucio ${elapsedMins} min`;
                    }
                    items.push({
                        module: 'robot',
                        id: 'robot_cleaner',
                        name: 'Robot Aspiradora',
                        icon: 'ph-robot',
                        desc: timeText
                    });
                }
            }

            // 2. CUIDADO CORPORAL
            if (this.app.grooming && !hasUnifiedTrackers) {
                const gData = this.app.grooming.data || {};
                const groomingItems = [
                    { id: 'barba', name: 'Afeitado de Barba', icon: 'ph-scissors' },
                    { id: 'pelo', name: 'Corte de Pelo', icon: 'ph-user' },
                    { id: 'axilas', name: 'Depilación Axilas', icon: 'ph-user' },
                    { id: 'hoja_gillette', name: 'Hoja Gillette', icon: 'ph-sparkle' },
                    { id: 'pecho_panza', name: 'Depilación Pecho y Panza', icon: 'ph-user' },
                    { id: 'brazos', name: 'Depilación Brazos', icon: 'ph-user' },
                    { id: 'piernas', name: 'Depilación Piernas', icon: 'ph-user' },
                    { id: 'intimas', name: 'Depilación Zonas Íntimas', icon: 'ph-user' },
                    { id: 'unas_manos', name: 'Cortar Uñas de Manos', icon: 'ph-hand' },
                    { id: 'unas_pies', name: 'Cortar Uñas de Pies', icon: 'ph-scissors' }
                ];

                groomingItems.forEach(item => {
                    const history = gData[item.id] || [];
                    if (history.length > 0) {
                        const diff = this.app.grooming.getDaysDiff(history[0]);
                        const limits = GROOMING_RULES[item.id]?.limits || { red: 30 };
                        const limitRed = limits.red;
                        if (diff >= limitRed) {
                            items.push({
                                module: 'grooming',
                                id: item.id,
                                name: item.name,
                                icon: item.icon,
                                desc: `Pasaron ${diff} de ${limitRed} días.`
                            });
                        }
                    }
                });
            }

            // 3. LENTES DE CONTACTO
            if (this.app.lenses && !hasUnifiedTrackers) {
                const checks = [
                    { key: 'lensDate', label: 'Reemplazo de Lentes', limit: LENS_LIMITS.lenses, icon: 'ph-eye' },
                    { key: 'solutionDate', label: 'Solución Lentes', limit: LENS_LIMITS.solution, icon: 'ph-eye' },
                    { key: 'caseDate', label: 'Estuche Lentes', limit: LENS_LIMITS.case, icon: 'ph-eye' },
                    { key: 'systaneDate', label: 'Gotas Systane', limit: LENS_LIMITS.systane, icon: 'ph-eye' },
                    { key: 'clothWashDate', label: 'Lavado Paño', limit: LENS_LIMITS.clothWash, icon: 'ph-eye' },
                    { key: 'clothChangeDate', label: 'Reemplazo Paño', limit: LENS_LIMITS.clothChange, icon: 'ph-eye' }
                ];

                checks.forEach(c => {
                    const dateVal = localStorage.getItem(c.key);
                    if (dateVal) {
                        const elapsed = this.app.lenses.calculateDaysElapsed(dateVal);
                        if (elapsed !== '--' && elapsed >= c.limit) {
                            items.push({
                                module: 'lenses',
                                id: c.key,
                                name: c.label,
                                icon: c.icon,
                                desc: `En uso hace ${elapsed} de ${c.limit} días.`
                            });
                        }
                    }
                });
            }

            // 4. VEHÍCULO
            if (this.app.vehicle) {
                items.push(...(this.app.vehicle.cards?.getOverdueItems?.(now) || []));
            }

            // 5. WORKANA SUBSCRIPTION
            if (this.app.projects) {
                const sub = this.app.projects.subscription;
                if (sub && sub.startDate) {
                    const nextDate = parseDateLocal(sub.startDate);
                    if (nextDate) {
                        nextDate.setMonth(nextDate.getMonth() + Number(sub.cycle || 0));
                        const diffDays = DateUtils.getDaysUntil(nextDate);
                        if (Number.isFinite(diffDays) && diffDays <= 2) {
                            items.push({
                                module: 'workana',
                                id: 'workana_sub',
                                name: 'Suscripción Workana',
                                icon: 'ph-credit-card',
                                desc: diffDays < 0 ? 'Plazo de suscripción vencido.' : `Vence en ${diffDays} días.`
                            });
                        }
                    }
                }
                // 5.2. PROYECTOS ACTIVOS (Entrega demorada o muy próxima)
                if (this.app.projects.projects) {
                    this.app.projects.projects.forEach(p => {
                        if (!p.isDelivered) {
                            const deadline = new Date(p.deadline);
                            const remainingMs = deadline - now;
                            const totalMs = deadline - new Date(p.accepted);
                            
                            if (totalMs > 0) {
                                const remPct = (remainingMs / totalMs) * 100;
                                if (remainingMs <= 0 || remPct <= 10) {
                                    const days = Math.max(0, Math.floor(remainingMs / 86400000));
                                    items.push({
                                        module: 'projects',
                                        id: p.id,
                                        name: `Proyecto: ${p.project}`,
                                        icon: 'ph-briefcase',
                                        desc: remainingMs <= 0
                                            ? '¡Entrega demorada!'
                                            : `Vence pronto. ${days === 1 ? 'Queda 1 día' : `Quedan ${days} días`}.`,
                                        overdue: remainingMs <= 0,
                                        deadline: p.deadline
                                    });
                                }
                            }
                        }
                    });
                }
            }

            // 6. VITAMINA D
            if (this.app.gym && this.app.gym.supplements) {
                const supps = this.app.gym.supplements;
                const vitDHist = supps.vit_d_history || [];
                if (vitDHist.length > 0) {
                    const lastTakeDate = parseDateLocal(vitDHist[0].date);
                    if (lastTakeDate) {
                        lastTakeDate.setHours(0, 0, 0, 0);
                        const interval = supps.vit_d_days_interval || 45;
                        const nextTake = new Date(lastTakeDate.getTime() + interval * 24 * 60 * 60 * 1000);
                        nextTake.setHours(0, 0, 0, 0);
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        const remaining = Math.ceil((nextTake - today) / 86400000);
                        if (remaining <= 0) {
                            items.push({
                                module: 'gym',
                                id: 'vit_d',
                                name: 'Vitamina D',
                                icon: 'ph-capsule',
                                desc: remaining === 0 ? 'Te toca tomarla hoy.' : `Pendiente hace ${Math.abs(remaining)} días.`
                            });
                        }
                    }
                }
            }

            // 7. SEGUIMIENTOS CONFIGURABLES
            if (this.app.customTrackers && !hasUnifiedTrackers) {
                this.app.customTrackers.registry.trackers
                    .filter(tracker => !tracker.archived)
                    .forEach(tracker => {
                        const state = getCustomTrackerState(
                            tracker,
                            this.app.customTrackers.getHistory(tracker.id),
                            now
                        );
                        if (state.status === 'red') {
                            items.push({
                                module: 'custom_tracker',
                                id: tracker.id,
                                name: tracker.name,
                                icon: tracker.icon,
                                desc: `Pasaron ${state.elapsedDays} de ${tracker.intervalDays} días.`
                            });
                        }
                    });
            }

            // 8. PENDING URGENT GENERAL TASKS
            if (this.app.tareas && this.app.tareas.tasks) {
                const pendingUrgentTasks = this.app.tareas.tasks.filter(t => !t.completed && (t.urgency === 'urgente' || t.urgency === 'muy_urgente'));
                pendingUrgentTasks.forEach(t => {
                    const catName = t.category || 'General';
                    const isVeryUrgent = t.urgency === 'muy_urgente';
                    items.push({
                        module: 'tareas',
                        id: t.id,
                        name: `${isVeryUrgent ? '🔥 ' : ''}Tarea: ${t.text}`,
                        icon: isVeryUrgent ? 'ph-fire' : 'ph-check-square',
                        desc: `${isVeryUrgent ? '¡MUY URGENTE!' : 'Urgente'} - Categoría: ${catName}`,
                        urgency: t.urgency,
                        category: catName
                    });
                });
            }

            // 9. PENDING URGENT PROJECT TASKS
            const freelanceProjs = this.app.tareas?.getFreelanceProjects ? this.app.tareas.getFreelanceProjects() : (this.app.projects?.projects || []);
            freelanceProjs.forEach(p => {
                if (p.tasks) {
                    const pendingUrgentProjTasks = p.tasks.filter(t => !t.completed && (t.urgency === 'urgente' || t.urgency === 'muy_urgente'));
                    pendingUrgentProjTasks.forEach(t => {
                        const isVeryUrgent = t.urgency === 'muy_urgente';
                        items.push({
                            module: 'projects_tasks',
                            id: t.id,
                            name: `${isVeryUrgent ? '🔥 ' : ''}Proyecto: ${p.client || p.project}`,
                            icon: isVeryUrgent ? 'ph-fire' : 'ph-list-checks',
                            desc: `${isVeryUrgent ? '¡MUY URGENTE!' : 'Urgente'} - Tarea: ${t.text}`,
                            urgency: t.urgency,
                            projectId: p.id
                        });
                    });
                }
            });
        } catch (e) {
            console.error("Error in getOverdueItems:", e);
        }
        return items;
    }

    isItemCompletable(item) {
        return item?.completable !== false && COMPLETABLE_MODULES.has(item?.module);
    }

    openItem(item) {
        if (!item) return false;

        let sectionId = null;
        if (item.module === 'tareas') {
            const task = this.app.tareas?.tasks?.find(
                candidate => String(candidate.id) === String(item.id)
            );
            if (task?.category) this.app.tareas.currentCategory = task.category;
            sectionId = 'tareas-section';
        } else if (item.module === 'projects_tasks') {
            this.app.tareas.currentCategory = 'Freelance';
            if (item.projectId !== undefined && item.projectId !== null) {
                this.app.tareas.activeProjectId = item.projectId;
            }
            sectionId = 'tareas-section';
        } else if (item.module === 'projects' || item.module === 'workana') {
            sectionId = 'projects-section';
        } else if (item.module === 'custom_tracker') {
            const tracker = this.app.customTrackers?.getTracker(item.id);
            const sectionMap = {
                hygiene: 'higiene-section',
                grooming: 'cuidado-section',
                lenses: 'lentes-section',
                health: 'salud-section'
            };
            sectionId = sectionMap[tracker?.section] || null;
        } else {
            const moduleSections = {
                hygiene: 'higiene-section',
                robot: 'higiene-section',
                grooming: 'cuidado-section',
                lenses: 'lentes-section',
                vehicle: 'vehiculo-section',
                gym: 'gym-section'
            };
            sectionId = moduleSections[item.module] || null;
        }

        if (item.module === 'vehicle' && item.vehicleTab) {
            this.app.vehicle?.activateVehicleTab?.(item.vehicleTab, {
                persist: true,
                render: true
            });
        }

        if (!sectionId || !this.app.activateSection(sectionId, { smooth: true })) {
            return false;
        }

        this.panel?.classList.add('hidden');
        requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return true;
    }

    updateBadge(items = null) {
        const pendingItems = items || this.getOverdueItems();
        const count = pendingItems.length;
        
        if (this.badge) {
            if (count > 0) {
                this.badge.innerText = count;
                this.badge.style.display = 'flex';
            } else {
                this.badge.style.display = 'none';
            }
        }
        
        if (this.countText) {
            this.countText.innerText = `${count} pendientes`;
        }

        this.app.today?.render(pendingItems);
    }

    render() {
        const items = this.getOverdueItems();
        this.updateBadge(items);

        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';
        
        if (items.length === 0) {
            this.listContainer.innerHTML = `
                <div class="notifications-empty">
                    <i class="ph ph-check-circle"></i>
                    <span>¡Estás al día! Sin tareas críticas.</span>
                </div>
            `;
            return;
        }
        
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'notification-item';
            const safeIcon = escapeHtml(item.icon || 'ph-bell');
            const safeName = escapeHtml(item.name || 'Recordatorio');
            const safeDescription = escapeHtml(item.desc || '');
            const isCompletable = this.isItemCompletable(item);
            const actionLabel = isCompletable ? 'Listo' : 'Abrir';
            const actionIcon = isCompletable ? 'ph-check' : 'ph-arrow-right';
            el.innerHTML = `
                <div class="notification-item-info">
                    <div class="notification-item-title">
                        <i class="ph ${safeIcon}"></i>
                        <span>${safeName}</span>
                    </div>
                    <div class="notification-item-desc">${safeDescription}</div>
                </div>
                <button type="button" class="notification-item-btn" aria-label="${isCompletable ? 'Marcar como resuelto' : 'Abrir'}: ${safeName}">
                    <i class="ph ${actionIcon}"></i> ${actionLabel}
                </button>
            `;
            
            el.querySelector('.notification-item-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (isCompletable) {
                    this.completeTask(item.module, item.id, item);
                } else {
                    this.openItem(item);
                }
            });
            
            this.listContainer.appendChild(el);
        });
    }

    completeTask(module, id, context = {}) {
        if (navigator.vibrate) navigator.vibrate(50);
        
        if (module === 'hygiene') {
            this.app.hygiene.washItem(id);
        } else if (module === 'robot') {
            this.app.hygiene.markRobotClean();
        } else if (module === 'grooming') {
            this.app.grooming.recordSession(id);
        } else if (module === 'lenses') {
            const today = getLocalISODate();
            localStorage.setItem(id, today);
            this.app.lenses.loadDatesAndStock();
        } else if (module === 'custom_tracker') {
            this.app.customTrackers?.recordTracker(id);
        } else if (module === 'vehicle') {
            if (this.app.vehicle.cards?.getCard?.(id)) {
                this.app.vehicle.cards.completeCard(id);
            } else if (id === 'oil') {
                const dateVal = getLocalISODate();
                const kmVal = this.app.vehicle.odometer;
                const entry = {
                    id: 'maint_' + Date.now(),
                    type: 'Aceite y Filtros',
                    date: dateVal,
                    km: kmVal,
                    details: { oil: true, filterOil: true, filterAir: true, filterCabin: true }
                };
                this.app.vehicle.maintenanceLog.push(entry);
                this.app.vehicle.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));
                this.app.vehicle.saveMaintenanceLog();
                this.app.vehicle.render();
            } else if (id === 'align') {
                this.app.vehicle.recordQuickGeometry('Alineación & Balanceo');
            } else if (id === 'rot') {
                this.app.vehicle.recordQuickGeometry('Rotación de Neumáticos');
            } else if (id === 'replace') {
                const dateVal = getLocalISODate();
                const kmVal = this.app.vehicle.odometer;
                const entry = {
                    id: 'maint_' + Date.now(),
                    type: 'Reemplazo de Neumáticos',
                    date: dateVal,
                    km: kmVal,
                    details: { front: true, rear: true }
                };
                this.app.vehicle.maintenanceLog.push(entry);
                this.app.vehicle.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));
                this.app.vehicle.saveMaintenanceLog();
                this.app.vehicle.render();
            } else if (id === 'escobillas') {
                this.app.vehicle.updateFluidCheck('escobillasDate');
            } else if (id === 'refrigerante') {
                this.app.vehicle.updateFluidCheck('refrigeranteDate');
            } else if (id === 'sapito') {
                this.app.vehicle.updateFluidCheck('sapitoDate');
            }
        } else if (module === 'workana') {
            const today = getLocalISODate();
            this.app.projects.subscription.startDate = today;
            this.app.projects.saveData();
            this.app.projects.render();
        } else if (module === 'tareas') {
            const t = this.app.tareas.tasks?.find(x => String(x.id) === String(id));
            if (t) {
                t.completed = true;
                this.app.tareas.saveData();
                this.app.tareas.render();
                this.app.auth?.syncToCloud(false).catch(() => {});
            }
        } else if (module === 'projects_tasks') {
            const freelanceProjs = this.app.tareas?.getFreelanceProjects ? this.app.tareas.getFreelanceProjects() : (this.app.projects?.projects || []);
            const projectCandidates = context.projectId !== undefined && context.projectId !== null
                ? freelanceProjs.filter(p => String(p.id) === String(context.projectId))
                : freelanceProjs;
            for (const p of projectCandidates) {
                const t = p.tasks?.find(x => String(x.id) === String(id));
                if (t) {
                    t.completed = true;
                    this.app.tareas?.syncProjectTasksToStores(p.id, p.tasks);
                    this.app.projects?.saveData();
                    this.app.projects?.render();
                    if (this.app.tareas?.currentCategory === 'Freelance') {
                        this.app.tareas.render();
                    }
                    this.app.auth?.syncToCloud(false).catch(() => {});
                    break;
                }
            }
        }
        
        // Update badge and list in real-time
        this.render();
    }
}
