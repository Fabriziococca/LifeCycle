import { itemsConfig, LENS_LIMITS, GROOMING_RULES, parseDateLocal, getLocalISODate } from '../utils.js';

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

            // 1. HIGIENE
            if (this.app.hygiene) {
                const hData = this.app.hygiene.data || {};
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
                // Robot aspiradora
                if (hData.robot_cleaner && hData.robot_cleaner.status === 'dirty') {
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
            if (this.app.grooming) {
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
            if (this.app.lenses) {
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
                const odo = this.app.vehicle.odometer;
                const log = this.app.vehicle.maintenanceLog || [];

                // Aceite y Filtros
                const lastOil = log.find(m => m.type === 'Aceite y Filtros');
                if (lastOil) {
                    const remKm = (lastOil.km + 10000) - odo;
                    const days = this.app.vehicle.calculateDaysElapsed(lastOil.date);
                    const remDays = 365 - (days || 0);
                    if (remKm <= 0 || remDays <= 0) {
                        items.push({
                            module: 'vehicle',
                            id: 'oil',
                            name: 'Aceite y Filtros',
                            icon: 'ph-car',
                            desc: remKm <= 0 ? 'Vencido por kilometraje.' : 'Plazo anual vencido.'
                        });
                    }
                }

                // Alineación y Balanceo
                const lastAlign = log.find(m => m.type === 'Alineación & Balanceo');
                if (lastAlign) {
                    const remKm = (lastAlign.km + 10000) - odo;
                    if (remKm <= 0) {
                        items.push({
                            module: 'vehicle',
                            id: 'align',
                            name: 'Alineación & Balanceo',
                            icon: 'ph-car',
                            desc: 'Vencido por kilometraje.'
                        });
                    }
                }

                // Rotación de Neumáticos
                const lastRot = log.find(m => m.type === 'Rotación de Neumáticos');
                if (lastRot) {
                    const remKm = (lastRot.km + 10000) - odo;
                    if (remKm <= 0) {
                        items.push({
                            module: 'vehicle',
                            id: 'rot',
                            name: 'Rotación de Neumáticos',
                            icon: 'ph-car',
                            desc: 'Vencido por kilometraje.'
                        });
                    }
                }

                // Reemplazo de Neumáticos
                const lastRep = log.find(m => m.type === 'Reemplazo de Neumáticos');
                if (lastRep) {
                    const remKm = (lastRep.km + 60000) - odo;
                    if (remKm <= 0) {
                        items.push({
                            module: 'vehicle',
                            id: 'replace',
                            name: 'Reemplazo de Neumáticos',
                            icon: 'ph-car',
                            desc: 'Vencido por kilometraje.'
                        });
                    }
                }

                // Escobillas limpiaparabrisas (alerta desde 240 días / 8 meses)
                const escDate = this.app.vehicle.trackerData?.escobillasDate;
                if (escDate) {
                    const escDays = this.app.vehicle.calculateDaysElapsed(escDate);
                    if (escDays !== null && escDays >= 240) {
                        const isRed = escDays >= 300;
                        items.push({
                            module: 'vehicle',
                            id: 'escobillas',
                            name: 'Escobillas Limpiaparabrisas',
                            icon: 'ph-arrows-left-right',
                            desc: isRed ? `¡Cambiar ya! Pasaron ${escDays} días (~${Math.floor(escDays / 30)} meses).` : `Cambio recomendado. Pasaron ${escDays} días (${Math.floor(escDays / 30)} meses).`
                        });
                    }
                }
            }

            // 5. WORKANA SUBSCRIPTION
            if (this.app.projects) {
                const sub = this.app.projects.subscription;
                if (sub && sub.startDate) {
                    const nextDate = new Date(sub.startDate);
                    nextDate.setMonth(nextDate.getMonth() + sub.cycle);
                    const diffTime = nextDate - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays <= 2) {
                        items.push({
                            module: 'workana',
                            id: 'workana_sub',
                            name: 'Suscripción Workana',
                            icon: 'ph-credit-card',
                            desc: diffDays < 0 ? 'Plazo de suscripción vencido.' : `Vence en ${diffDays} días.`
                        });
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
                                        desc: remainingMs <= 0 ? '¡Entrega demorada!' : `Vence pronto. Quedan ${days} días.`
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

            // 7. PENDING URGENT GENERAL TASKS
            if (this.app.tareas && this.app.tareas.tasks) {
                const pendingUrgentTasks = this.app.tareas.tasks.filter(t => !t.completed && t.urgency === 'urgente');
                pendingUrgentTasks.forEach(t => {
                    const catName = t.category || 'General';
                    items.push({
                        module: 'tareas',
                        id: t.id,
                        name: `Tarea: ${t.text}`,
                        icon: 'ph-check-square',
                        desc: `Urgente - Categoría: ${catName}`
                    });
                });
            }

            // 8. PENDING URGENT PROJECT TASKS
            if (this.app.projects && this.app.projects.projects) {
                this.app.projects.projects.forEach(p => {
                    if (p.tasks) {
                        const pendingUrgentProjTasks = p.tasks.filter(t => !t.completed && t.urgency === 'urgente');
                        pendingUrgentProjTasks.forEach(t => {
                            items.push({
                                module: 'projects_tasks',
                                id: t.id,
                                name: `Proyecto: ${p.client || p.project}`,
                                icon: 'ph-list-checks',
                                desc: `Urgente - Tarea: ${t.text}`
                            });
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Error in getOverdueItems:", e);
        }
        return items;
    }

    updateBadge() {
        const items = this.getOverdueItems();
        const count = items.length;
        
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
    }

    render() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';
        
        const items = this.getOverdueItems();
        
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
            el.innerHTML = `
                <div class="notification-item-info">
                    <div class="notification-item-title">
                        <i class="ph ${item.icon}"></i>
                        <span>${item.name}</span>
                    </div>
                    <div class="notification-item-desc">${item.desc}</div>
                </div>
                <button class="notification-item-btn">
                    <i class="ph ph-check"></i> Listo
                </button>
            `;
            
            el.querySelector('.notification-item-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.completeTask(item.module, item.id);
            });
            
            this.listContainer.appendChild(el);
        });
    }

    completeTask(module, id) {
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
        } else if (module === 'vehicle') {
            if (id === 'oil') {
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
            for (const p of this.app.projects.projects) {
                const t = p.tasks?.find(x => String(x.id) === String(id));
                if (t) {
                    t.completed = true;
                    this.app.projects.saveData();
                    this.app.projects.render();
                    if (this.app.tareas.currentCategory === 'Freelance' && String(this.app.tareas.activeProjectId) === String(p.id)) {
                        this.app.tareas.render();
                    }
                    this.app.auth?.syncToCloud(false).catch(() => {});
                    break;
                }
            }
        }
        
        // Update badge and list in real-time
        this.updateBadge();
        this.render();
    }
}
