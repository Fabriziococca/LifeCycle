import { DateUtils, getLocalISODate, parseDateLocal } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

export class ProjectsModule {
    constructor(appController) {
        this.app = appController;
        this.projects = [];
        this.history = [];
        this.currentProjectId = null;
        this.editingStatusNoteProjectId = null;
        this.FIXED_FEE = 0.0732; // Costo operativo retiro PayPal/Lemon (7.32%)

        window.projects = this;
        this.loadData();
        this.setupListeners();
        this.startTimersLoop();
    }

    loadData() {
        try {
            const projects = localStorage.getItem('projectPulseData');
            if (projects) {
                const parsed = JSON.parse(projects);
                this.projects = Array.isArray(parsed) ? parsed : [];
            } else {
                this.projects = [];
            }

            const history = localStorage.getItem('projectPulseHistory');
            if (history) {
                const parsed = JSON.parse(history);
                this.history = Array.isArray(parsed) ? parsed : [];
            } else {
                this.history = [];
            }

            const subscription = localStorage.getItem('projectPulseSubscription');
            if (subscription) {
                const parsed = JSON.parse(subscription);
                this.subscription = (parsed && typeof parsed === 'object') ? parsed : {
                    plan: 'Explorer',
                    cost: 37.18,
                    cycle: 3,
                    startDate: '2026-04-24'
                };
            } else {
                this.subscription = {
                    plan: 'Explorer',
                    cost: 37.18,
                    cycle: 3,
                    startDate: '2026-04-24'
                };
            }
        } catch (err) {
            console.error('Error loading Projects data', err);
            this.projects = [];
            this.history = [];
            this.subscription = {
                plan: 'Explorer',
                cost: 37.18,
                cycle: 3,
                startDate: '2026-04-24'
            };
        }
    }

    saveData() {
        localStorage.setItem('projectPulseData', JSON.stringify(this.projects));
        localStorage.setItem('projectPulseHistory', JSON.stringify(this.history));
        localStorage.setItem('projectPulseSubscription', JSON.stringify(this.subscription));
    }

    calculateNet(gross, feeType, manualPercent, isDelegated = false, isReceived = false) {
        let finalNet = 0;
        const feeVal = (feeType === null || feeType === undefined || feeType === '') ? 20 : feeType;
        if (feeVal === 'direct') {
            finalNet = gross;
        } else if (feeVal === 'paypal_direct') {
            const netAfterPayPal = (gross * (1 - 0.054)) - 0.30;
            finalNet = netAfterPayPal * 0.9457;
            if (finalNet < 0) finalNet = 0;
        } else {
            let pct = (feeVal === 'custom') ? (parseFloat(manualPercent) || 0) : parseFloat(feeVal);
            if (isNaN(pct)) pct = 20;
            const amountAfterWorkana = gross * (1 - (pct / 100));
            finalNet = amountAfterWorkana * (1 - this.FIXED_FEE);
        }

        if (isDelegated) {
            finalNet = finalNet * 0.30;
        } else if (isReceived) {
            finalNet = finalNet * 0.70;
        }

        return parseFloat(finalNet.toFixed(2));
    }

    formatDate(isoString) {
        return DateUtils.formatDateTime(isoString);
    }

    setupListeners() {
        // Workana Subscription Listeners
        const btnEditSub = document.getElementById('btn-edit-sub');
        const subForm = document.getElementById('sub-settings-form');
        const selectPlan = document.getElementById('sub-input-plan');
        const customPlanContainer = document.getElementById('sub-custom-plan-container');

        if (btnEditSub && subForm && selectPlan && customPlanContainer) {
            btnEditSub.addEventListener('click', () => {
                const isHidden = subForm.classList.toggle('hidden');
                if (!isHidden) {
                    // Prefill values
                    const sub = this.subscription;
                    const isStandard = ['Explorer', 'Profesional', 'Beginner', 'Free'].includes(sub.plan);
                    selectPlan.value = isStandard ? sub.plan : 'custom';
                    if (!isStandard) {
                        customPlanContainer.classList.remove('hidden');
                        document.getElementById('sub-input-plan-custom').value = sub.plan;
                    } else {
                        customPlanContainer.classList.add('hidden');
                    }
                    document.getElementById('sub-input-cost').value = sub.cost;
                    document.getElementById('sub-input-cycle').value = sub.cycle;
                    document.getElementById('sub-input-date').value = sub.startDate;
                }
            });

            selectPlan.addEventListener('change', () => {
                customPlanContainer.classList.toggle('hidden', selectPlan.value !== 'custom');
            });

            subForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const selectedVal = selectPlan.value;
                const finalPlanName = selectedVal === 'custom' 
                    ? document.getElementById('sub-input-plan-custom').value.trim() 
                    : selectedVal;

                this.subscription = {
                    plan: finalPlanName || 'Explorer',
                    cost: parseFloat(document.getElementById('sub-input-cost').value) || 0,
                    cycle: parseInt(document.getElementById('sub-input-cycle').value) || 3,
                    startDate: document.getElementById('sub-input-date').value
                };

                this.saveData();
                this.render();
                subForm.classList.add('hidden');

                if (this.app.auth) {
                    if (navigator.vibrate) navigator.vibrate(50);
                    this.app.auth.syncToCloud(false).catch(() => {});
                }
            });
        }

        // Commission select custom percent toggle
        const feeSelect = document.getElementById('workanaFeeSelect');
        const customContainer = document.getElementById('customFeeContainer');
        if (feeSelect && customContainer) {
            feeSelect.addEventListener('change', () => {
                customContainer.classList.toggle('hidden', feeSelect.value !== 'custom');
            });
        }

        // Quick Now Date/Time button for project acceptance
        const btnNowAccept = document.getElementById('btn-now-accept-date');
        if (btnNowAccept) {
            btnNowAccept.addEventListener('click', () => {
                const acceptInput = document.getElementById('acceptDate');
                if (acceptInput) {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    acceptInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            });
        }

        // New Project Form Submit
        const form = document.getElementById('projectForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const client = document.getElementById('clientName').value.trim();
                const project = document.getElementById('projectName').value.trim();
                const accepted = document.getElementById('acceptDate').value;
                const days = parseFloat(document.getElementById('deliveryDays').value);
                const gross = parseFloat(document.getElementById('budgetGross').value);
                const feeType = document.getElementById('workanaFeeSelect').value;
                const customPct = parseFloat(document.getElementById('customWorkanaFee').value) || 0;
                const source = document.getElementById('projectSourceSelect')?.value || 'workana';
                const isDel = false;
                const isRec = false;

                const timeTotal = days * 24 * 60 * 60 * 1000;
                const deadline = new Date(new Date(accepted).getTime() + timeTotal).toISOString();
                const net = this.calculateNet(gross, feeType, customPct, isDel, isRec);

                const newProj = {
                    id: Date.now(),
                    client,
                    project,
                    accepted,
                    days,
                    budgetGross: gross,
                    feeType,
                    manualPercent: customPct,
                    isDelegated: isDel,
                    isReceived: isRec,
                    budgetNet: net,
                    timeSpent: 0,
                    timerStart: null,
                    tasks: [],
                    summary: '',
                    phases: '',
                    isDelivered: false,
                    deliveredAt: null,
                    deadline,
                    source
                };

                this.projects.push(newProj);
                this.saveData();
                this.render();
                form.reset();
                customContainer?.classList.add('hidden');
            });
        }

        // Projects Edit (Gestionar) Modal Cancel/Save
        const editCancel = document.getElementById('proj-edit-cancel');
        const editSave = document.getElementById('proj-edit-save');
        const editModal = document.getElementById('projects-edit-modal');

        editCancel?.addEventListener('click', () => {
            editModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        editSave?.addEventListener('click', () => {
            if (!this.currentProjectId) return;
            const p = this.projects.find(proj => String(proj.id) === String(this.currentProjectId));
            if (!p) return;

            const newDeadlineVal = document.getElementById('proj-edit-deadline').value;
            const extraBudget = parseFloat(document.getElementById('proj-extraBudget').value) || 0;
            const manualHrs = parseFloat(document.getElementById('proj-manualHours').value) || 0;
            const manualMins = parseFloat(document.getElementById('proj-manualMinutes').value) || 0;

            // Ajustar plazos
            if (newDeadlineVal) {
                const newDeadlineDate = new Date(newDeadlineVal);
                p.deadline = newDeadlineDate.toISOString();
                const acceptedDate = new Date(p.accepted);
                const diffMs = newDeadlineDate.getTime() - acceptedDate.getTime();
                p.days = Math.max(0, parseFloat((diffMs / (24 * 60 * 60 * 1000)).toFixed(2)));
            }

            // Presupuesto extra
            if (extraBudget > 0) {
                p.budgetGross = (p.budgetGross || 0) + extraBudget;
                p.budgetNet = this.calculateNet(p.budgetGross, p.feeType, p.manualPercent, p.isDelegated, p.isReceived);
            }

            // Tiempo trabajado manual (Sobreescribir/Reemplazar)
            p.timeSpent = (manualHrs * 60 * 60 * 1000) + (manualMins * 60 * 1000);
            if (p.timerStart) {
                p.timerStart = new Date().toISOString();
            }

            // Arbitraje status
            const isArbitrationChecked = document.getElementById('proj-isArbitration')?.checked || false;
            if (isArbitrationChecked && !p.isArbitration) {
                // Entrando en arbitraje: pausar timer
                if (p.timerStart) {
                    const elapsed = new Date() - new Date(p.timerStart);
                    p.timeSpent = (p.timeSpent || 0) + elapsed;
                    p.timerStart = null;
                }
                p.isArbitration = true;
                p.isDelivered = false; // Congelado
            } else if (!isArbitrationChecked && p.isArbitration) {
                // Saliendo de arbitraje
                p.isArbitration = false;
            }

            this.saveData();
            this.render();
            editModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        // Checkbox visual change listener
        const isArbitrationCheckbox = document.getElementById('proj-isArbitration');
        isArbitrationCheckbox?.addEventListener('change', () => {
            const visual = document.getElementById('proj-isArbitration-visual');
            if (visual) {
                visual.innerHTML = isArbitrationCheckbox.checked ? '✓' : '';
                visual.style.background = isArbitrationCheckbox.checked ? 'var(--status-red)' : 'transparent';
            }
        });

        // Resolve Arbitration Modal Listeners
        const resolveCancel = document.getElementById('proj-resolve-cancel');
        const resolveConfirm = document.getElementById('proj-resolve-confirm');
        const resolveModal = document.getElementById('projects-resolve-arbitration-modal');
        const arbitrationPctInput = document.getElementById('proj-arbitration-pct');

        resolveCancel?.addEventListener('click', () => {
            resolveModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        arbitrationPctInput?.addEventListener('input', () => {
            let val = parseFloat(arbitrationPctInput.value);
            if (isNaN(val)) val = 0;
            if (val < 0) arbitrationPctInput.value = 0;
            if (val > 100) arbitrationPctInput.value = 100;
            this.updateArbitrationPreview();
        });

        resolveConfirm?.addEventListener('click', () => {
            this.confirmResolveArbitration();
        });

        // Plan Modal Save & Close
        const planClose = document.getElementById('proj-plan-modal-close');
        const planSave = document.getElementById('proj-plan-modal-save');
        const planModal = document.getElementById('projects-plan-modal');

        planClose?.addEventListener('click', () => {
            planModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        planSave?.addEventListener('click', () => {
            if (!this.currentProjectId) return;
            const p = this.projects.find(proj => String(proj.id) === String(this.currentProjectId)) || this.history.find(proj => String(proj.id) === String(this.currentProjectId));
            if (!p) return;

            const summaryEl = document.getElementById('proj-summary-textarea');
            const phasesEl = document.getElementById('proj-phases-textarea');

            if (summaryEl) p.summary = summaryEl.value.trim();
            if (phasesEl) p.phases = phasesEl.value.trim();

            this.saveData();
            this.render();
            planModal?.classList.add('hidden');
            this.currentProjectId = null;
        });

        planModal?.addEventListener('click', (e) => {
            if (e.target === planModal) {
                planModal.classList.add('hidden');
                this.currentProjectId = null;
            }
        });

        // History Modal click controls
        const btnOpenHistory = document.getElementById('btnOpenHistory');
        const btnOpenMonthDetails = document.getElementById('btnOpenMonthDetails');
        const btnOpenYearDetails = document.getElementById('btnOpenYearDetails');
        const historyModal = document.getElementById('projects-history-modal');
        const closeHistory = document.getElementById('proj-close-history-modal');

        btnOpenHistory?.addEventListener('click', () => {
            historyModal?.classList.remove('hidden');
            this.renderMonthlyHistory('all');
        });

        btnOpenMonthDetails?.addEventListener('click', () => {
            historyModal?.classList.remove('hidden');
            this.renderMonthlyHistory('month');
        });

        btnOpenYearDetails?.addEventListener('click', () => {
            historyModal?.classList.remove('hidden');
            this.renderMonthlyHistory('year');
        });

        closeHistory?.addEventListener('click', () => {
            historyModal?.classList.add('hidden');
        });

        // Past Income toggler
        const btnTogglePast = document.getElementById('proj-btnToggleAddPastIncome');
        const pastForm = document.getElementById('proj-add-past-income-form');
        const btnCancelPast = document.getElementById('proj-btnCancelPastIncome');
        const btnSavePast = document.getElementById('proj-btnSavePastIncome');

        btnTogglePast?.addEventListener('click', () => {
            pastForm?.classList.toggle('hidden');
        });

        btnCancelPast?.addEventListener('click', () => {
            pastForm?.classList.add('hidden');
            this.resetPastForm();
        });

        btnSavePast?.addEventListener('click', () => {
            const client = document.getElementById('proj-pastClient').value.trim();
            const project = document.getElementById('proj-pastProject').value.trim();
            const date = document.getElementById('proj-pastDate').value;
            const hrs = parseFloat(document.getElementById('proj-pastHours').value) || 0;
            const gross = parseFloat(document.getElementById('proj-pastGross').value) || 0;
            const net = parseFloat(document.getElementById('proj-pastNet').value) || 0;

            if (!client || !project || !date || isNaN(gross) || isNaN(net)) {
                alert('Por favor completa todos los campos requeridos.');
                return;
            }

            const pPast = {
                id: Date.now(),
                client,
                project,
                accepted: date,
                days: 0,
                budgetGross: gross,
                budgetNet: net,
                timeSpent: hrs * 60 * 60 * 1000,
                timerStart: null,
                tasks: [],
                summary: 'Ingreso cargado manualmente del historial pasado.',
                phases: '',
                isDelivered: true,
                deliveredAt: parseDateLocal(date).toISOString(),
                deliveredDate: date,
                deadline: date
            };

            this.history.unshift(pPast);
            this.history.sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt));
            this.saveData();
            this.render();
            this.renderMonthlyHistory('all');
            pastForm?.classList.add('hidden');
            this.resetPastForm();
        });

        // Projects Status Note Modal Cancel/Save and Chips
        const statusModal = document.getElementById('projects-status-note-modal');
        const statusCancel = document.getElementById('proj-status-note-cancel');
        const statusSave = document.getElementById('proj-status-note-save');
        const statusInput = document.getElementById('proj-status-note-input');
        const statusChipsContainer = document.getElementById('status-note-chips');

        statusCancel?.addEventListener('click', () => {
            statusModal?.classList.add('hidden');
            this.editingStatusNoteProjectId = null;
        });

        statusSave?.addEventListener('click', () => {
            if (!this.editingStatusNoteProjectId) return;
            const noteVal = statusInput?.value.trim() || '';
            this.setStatusNote(this.editingStatusNoteProjectId, noteVal);
            statusModal?.classList.add('hidden');
            this.editingStatusNoteProjectId = null;
        });

        statusChipsContainer?.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const noteVal = btn.dataset.note || '';
                if (statusInput) statusInput.value = noteVal;
                if (!this.editingStatusNoteProjectId) return;
                this.setStatusNote(this.editingStatusNoteProjectId, noteVal);
                statusModal?.classList.add('hidden');
                this.editingStatusNoteProjectId = null;
            });
        });

    }

    openStatusNoteModal(id) {
        this.editingStatusNoteProjectId = id;
        const p = this.projects.find(proj => String(proj.id) === String(id));
        const modal = document.getElementById('projects-status-note-modal');
        const input = document.getElementById('proj-status-note-input');
        if (modal && p) {
            if (input) input.value = p.statusNote || '';
            modal.classList.remove('hidden');
        }
    }

    setStatusNote(id, note) {
        const p = this.projects.find(proj => String(proj.id) === String(id));
        if (p) {
            p.statusNote = note;
            this.saveData();
            this.render();
            if (this.app.auth) {
                this.app.auth.syncToCloud(false).catch(() => {});
            }
        }
    }

    requestChanges(id) {
        const p = this.projects.find(proj => String(proj.id) === String(id));
        if (!p) return;
        if (confirm(`¿Marcar que el cliente solicitó cambios en "${p.project}"?\n\nEl temporizador de 15 días se pausará hasta que vuelvas a entregar el trabajo.`)) {
            p.isDelivered = false;
            p.hasChangesRequested = true;
            p.changesRequestedAt = new Date().toISOString();
            this.saveData();
            this.render();
            if (this.app.auth) {
                this.app.auth.syncToCloud(false).catch(() => {});
            }
        }
    }

    reDeliverWork(id) {
        const p = this.projects.find(proj => String(proj.id) === String(id));
        if (!p) return;
        if (confirm(`¿Reentregar el trabajo del proyecto "${p.project}"?\n\nSe actualizará la fecha de entrega y reiniciará el plazo de 15 días.`)) {
            p.isDelivered = true;
            p.hasChangesRequested = false;
            p.deliveredAt = new Date().toISOString();
            this.saveData();
            this.render();
            if (this.app.auth) {
                this.app.auth.syncToCloud(false).catch(() => {});
            }
        }
    }

    resetPastForm() {
        document.getElementById('proj-pastClient').value = '';
        document.getElementById('proj-pastProject').value = '';
        document.getElementById('proj-pastDate').value = '';
        document.getElementById('proj-pastHours').value = '';
        document.getElementById('proj-pastGross').value = '';
        document.getElementById('proj-pastNet').value = '';
    }

    renderSubscription() {
        const subNameEl = document.getElementById('sub-plan-name');
        const startDateEl = document.getElementById('sub-start-date');
        const endDateEl = document.getElementById('sub-end-date');
        const costValEl = document.getElementById('sub-cost-val');
        const daysCountEl = document.getElementById('sub-days-count');
        const badgeEl = document.getElementById('sub-badge');
        const cardEl = document.getElementById('workana-subscription-card');

        if (!subNameEl || !startDateEl || !endDateEl || !costValEl || !daysCountEl || !badgeEl || !cardEl) return;

        const sub = this.subscription;
        const start = new Date(sub.startDate + 'T12:00:00');
        const expiry = new Date(start);
        expiry.setMonth(expiry.getMonth() + parseInt(sub.cycle));

        const today = new Date();
        today.setHours(0,0,0,0);
        const expiryDay = new Date(expiry);
        expiryDay.setHours(0,0,0,0);

        const diffTime = expiryDay - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        subNameEl.textContent = `Plan ${sub.plan} (${sub.cycle} ${sub.cycle == 1 ? 'mes' : 'meses'})`;
        startDateEl.textContent = start.toLocaleDateString('es-AR');
        endDateEl.textContent = expiry.toLocaleDateString('es-AR');
        costValEl.textContent = this.app.formatCurrency(sub.cost);
        daysCountEl.textContent = diffDays;

        // Reset class and styling
        badgeEl.className = 'badge';
        cardEl.style.borderColor = '';

        if (diffDays > 15) {
            badgeEl.textContent = 'Activa';
            badgeEl.className = 'badge green';
            daysCountEl.style.color = 'var(--status-green)';
            cardEl.style.borderColor = 'var(--status-green)';
        } else if (diffDays > 7) {
            badgeEl.textContent = 'Por vencer';
            badgeEl.className = 'badge yellow';
            daysCountEl.style.color = 'var(--status-yellow)';
            cardEl.style.borderColor = 'var(--status-yellow)';
        } else if (diffDays > 2) {
            badgeEl.textContent = 'Vence pronto';
            badgeEl.className = 'badge orange';
            daysCountEl.style.color = 'var(--status-orange)';
            cardEl.style.borderColor = 'var(--status-orange)';
        } else {
            badgeEl.textContent = diffDays < 0 ? 'Vencida' : 'Crítico';
            badgeEl.className = 'badge red';
            daysCountEl.style.color = 'var(--status-red)';
            cardEl.style.borderColor = 'var(--status-red)';
        }
        this.app.notificationsCenter?.updateBadge();
    }

    render() {
        this.renderSubscription();
        const list = document.getElementById('projectsList');
        const activeCount = document.getElementById('activeCount');
        if (!list || !activeCount) return;

        list.innerHTML = '';
        activeCount.innerText = this.projects.length;

        // Calcular Finanzas del Dashboard
        let activeNetSum = 0;
        this.projects.forEach(p => {
            activeNetSum += Number(p.budgetNet || 0);
        });
        document.getElementById('activeUSD').innerText = this.app.formatCurrency(activeNetSum);

        const now = new Date();
        const currYear = now.getFullYear();
        const currMonth = now.getMonth();

        let monthNetSum = 0;
        let yearNetSum = 0;
        let totalNetSum = 0;

        this.history.forEach(p => {
            const netVal = Number(p.budgetNet || 0);
            totalNetSum += netVal;
            const dateStr = p.deliveredDate || p.deliveredAt;
            if (dateStr) {
                const del = parseDateLocal(dateStr);
                if (del && del.getFullYear() === currYear) {
                    yearNetSum += netVal;
                    if (del.getMonth() === currMonth) {
                        monthNetSum += netVal;
                    }
                }
            }
        });

        document.getElementById('monthUSD').innerText = this.app.formatCurrency(monthNetSum);
        document.getElementById('yearUSD').innerText = this.app.formatCurrency(yearNetSum);
        document.getElementById('totalUSD').innerText = this.app.formatCurrency(totalNetSum);

        if (this.projects.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 25px;">No hay proyectos activos.</p>';
            return;
        }

        this.projects.forEach(p => {
            const deadline = new Date(p.deadline);
            let remainingMs = deadline - now;
            let totalMs = deadline - new Date(p.accepted);

            let progress = ((totalMs - remainingMs) / totalMs) * 100;
            progress = Math.max(0, Math.min(100, progress));

            let colorVar = "var(--status-green)";
            let countdownText = "";
            let leftDateLabel = "Aceptado:";
            let leftDateVal = this.formatDate(p.accepted);
            let rightDateLabel = `Límite (${p.days}d):`;
            let rightDateVal = this.formatDate(p.deadline);

            if (p.isArbitration) {
                progress = 100;
                colorVar = "var(--status-red)";
                countdownText = "⚠️ EN ARBITRAJE";
                leftDateLabel = "Entró en Disputa:";
                leftDateVal = this.formatDate(p.deliveredAt || p.accepted);
                rightDateLabel = "Estado:";
                rightDateVal = "FONDOS CONGELADOS";
            } else if (p.hasChangesRequested) {
                progress = 100;
                colorVar = "var(--status-orange)";
                countdownText = "⚠️ EN SOLICITUD DE CAMBIOS (PAUSADO)";
                leftDateLabel = "Aceptado:";
                leftDateVal = this.formatDate(p.accepted);
                rightDateLabel = "Solicitud Cambios:";
                rightDateVal = this.formatDate(p.changesRequestedAt || now);
            } else if (p.isDelivered) {
                if (!p.deliveredAt) p.deliveredAt = now.toISOString();
                const del = new Date(p.deliveredAt);
                const isOver300 = (p.budgetGross || 0) >= 300;

                if (isOver300) {
                    progress = 100;
                    colorVar = "#3b82f6";
                    countdownText = "🔒 ESPERANDO LIBERACIÓN MANUAL DEL CLIENTE";
                    leftDateLabel = "Entregado:";
                    leftDateVal = this.formatDate(p.deliveredAt);
                    rightDateLabel = "Liberación:";
                    rightDateVal = "Manual (> $300 USD)";
                } else {
                    const releaseDate = new Date(del.getTime() + 15 * 24 * 60 * 60 * 1000);
                    const relRemainingMs = releaseDate - now;
                    const relTotalMs = 15 * 24 * 60 * 60 * 1000;

                    progress = ((relTotalMs - relRemainingMs) / relTotalMs) * 100;
                    progress = Math.max(0, Math.min(100, progress));

                    leftDateLabel = "Entregado:";
                    leftDateVal = this.formatDate(p.deliveredAt);
                    rightDateLabel = "Liberación (15d):";
                    rightDateVal = this.formatDate(releaseDate);

                    if (relRemainingMs <= 0) {
                        countdownText = "LISTO PARA LIBERAR";
                        colorVar = "var(--status-green)";
                        progress = 100;
                    } else {
                        const d = Math.floor(relRemainingMs / 86400000);
                        const h = Math.floor((relRemainingMs % 86400000) / 3600000);
                        countdownText = `Fondos en ${d}d ${h}h`;

                        const remPct = (relRemainingMs / relTotalMs) * 100;
                        if (remPct <= 10) colorVar = "var(--status-green)";
                        else if (remPct <= 50) colorVar = "var(--status-orange)";
                        else colorVar = "var(--status-yellow)";
                    }
                }
            } else {
                if (remainingMs <= 0) {
                    countdownText = "ENTREGA DEMORADA";
                    colorVar = "var(--status-red)";
                } else {
                    const d = Math.floor(remainingMs / 86400000);
                    const h = Math.floor((remainingMs % 86400000) / 3600000);
                    countdownText = `Faltan ${d}d ${h}h`;

                    const remPct = (remainingMs / totalMs) * 100;
                    if (remPct <= 10) colorVar = "var(--status-red)";
                    else if (remPct <= 30) colorVar = "var(--status-orange)";
                    else if (remPct <= 50) colorVar = "var(--status-yellow)";
                }
            }

            let badgeSpan = '';
            if (p.isDelegated) {
                badgeSpan = '<span class="badge" style="background:var(--status-yellow); color:#000; font-size:0.7rem; margin-left:8px; vertical-align:middle; padding:3px 8px;">Delegado (30%)</span>';
            } else if (p.isReceived) {
                badgeSpan = '<span class="badge" style="background:var(--status-green); color:#fff; font-size:0.7rem; margin-left:8px; vertical-align:middle; padding:3px 8px;">Fabro (70%)</span>';
            }

            let sourceBadge = '';
            if (p.source === 'external') {
                sourceBadge = '<span class="badge" style="background:rgba(255,255,255,0.08); color:var(--text-secondary); border: 1px solid var(--surface-border); font-size:0.7rem; margin-left:8px; vertical-align:middle; padding:3px 8px;">Externo</span>';
            } else {
                sourceBadge = '<span class="badge" style="background:rgba(59, 130, 246, 0.15); color:#60a5fa; font-size:0.7rem; margin-left:8px; vertical-align:middle; padding:3px 8px;">Workana</span>';
            }

            const isRunning = p.timerStart !== null;
            const btnIcon = p.isArbitration ? '🔒' : (isRunning ? '⏸️' : '▶️');
            const btnBg = p.isArbitration ? 'rgba(255,255,255,0.05)' : (isRunning ? 'var(--status-red)' : 'var(--primary-color)');
            const btnColor = p.isArbitration ? 'var(--text-secondary)' : 'white';
            const timerButtonLabel = p.isArbitration
                ? 'Temporizador bloqueado durante el arbitraje'
                : (isRunning ? 'Pausar temporizador' : 'Iniciar temporizador');

            let initialMs = p.timeSpent || 0;
            if (p.timerStart) {
                initialMs += (now - new Date(p.timerStart));
            }
            const initialSecs = Math.floor(initialMs / 1000);
            const h = Math.floor(initialSecs / 3600);
            const m = Math.floor((initialSecs % 3600) / 60);
            const s = initialSecs % 60;
            const formattedTime = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;

            let rateText = '--/h';
            let rateColor = 'var(--text-secondary)';
            const totalHours = initialMs / (3600 * 1000);
            if (totalHours > 0) {
                const rate = (p.budgetNet || 0) / totalHours;
                rateText = `${this.app.formatCurrency(rate)}/h`;
                if (rate >= 25) rateColor = 'var(--status-green)';
                else if (rate >= 20) rateColor = 'var(--primary-color)';
                else if (rate >= 10) rateColor = 'var(--status-yellow)';
                else rateColor = 'var(--status-red)';
            }

            const safeClient = escapeHtml(p.client || '');
            const safeProjectName = escapeHtml(p.project || '');
            const safeStatusNote = escapeHtml(
                p.statusNote || '+ Asignar estado (ej: Esperando credenciales)'
            );
            const safeCountdownText = escapeHtml(countdownText);
            const safeLeftDateLabel = escapeHtml(leftDateLabel);
            const safeLeftDateValue = escapeHtml(leftDateVal);
            const safeRightDateLabel = escapeHtml(rightDateLabel);
            const safeRightDateValue = escapeHtml(rightDateVal);
            const feeDescription = p.feeType === 'direct'
                ? 'Sin comisiones'
                : (
                    p.feeType === 'paypal_direct'
                        ? 'PayPal Direct'
                        : (
                            p.feeType === 'custom'
                                ? `Workana ${p.manualPercent}%`
                                : `Workana ${p.feeType || 20}%`
                        )
                );

            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-project-id', p.id);
            card.style.background = p.isDelivered ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-color)';
            card.style.borderColor = colorVar;

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.75rem; gap: 12px;">
                    <div style="min-width: 0; flex: 1;">
                        <h3 class="project-client" style="color:white; font-size:1.2rem; margin:0; display:flex; align-items:center; flex-wrap:wrap; gap: 6px;">
                            ${safeClient} ${badgeSpan} ${sourceBadge}
                        </h3>
                        <p class="project-name" style="color:var(--text-secondary); font-size:0.88rem; margin: 3px 0 8px 0; font-weight: 500;">${safeProjectName}</p>
                        <div>
                            <span class="project-status-pill ${!p.statusNote ? 'empty-status' : ''}" title="Haz clic para cambiar el estado de seguimiento" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 600; cursor: pointer;">
                                <i class="ph ph-push-pin"></i> 
                                <span class="status-note-text">${safeStatusNote}</span>
                                <i class="ph ph-pencil-simple" style="font-size: 0.8rem; opacity: 0.7;"></i>
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;">
                        <div class="countdown-badge" style="background: rgba(0,0,0,0.3); border: 1.5px solid ${colorVar}; color: ${colorVar}; padding: 6px 12px; border-radius: 12px; font-weight: 800; font-size: 1.1rem; font-variant-numeric: tabular-nums; box-shadow: 0 0 10px ${colorVar}30; white-space: nowrap;">
                            ${safeCountdownText}
                        </div>
                        <button type="button" class="btn-history-delete" title="Eliminar proyecto" aria-label="Eliminar proyecto ${safeProjectName}" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; padding: 2px; font-size: 1.1rem; transition: color 0.2s;"><i class="ph ph-trash"></i></button>
                    </div>
                </div>

                <div class="pulse-bar" style="margin-bottom: 0.75rem;">
                    <div class="pulse-progress" style="width:${progress}%; background:${colorVar}"></div>
                </div>

                <div class="finance-block" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--surface-border); padding: 8px 12px; border-radius: 8px; margin-bottom: 0.75rem;">
                    <span class="gross-amount" style="font-size: 0.8rem; color: var(--text-secondary);">Bruto: ${this.app.formatCurrency(p.budgetGross || 0)} (${escapeHtml(feeDescription)})</span>
                    <strong class="net-amount" style="font-size: 0.95rem; color: var(--status-green);">Neto: ${this.app.formatCurrency(p.budgetNet || 0)}</strong>
                </div>

                <div class="timer-block" style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.25); border:1px solid var(--surface-border); border-radius:8px; padding:8px 12px; margin-bottom:0.75rem; gap:10px;">
                    <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                        <span style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Tiempo dedicado</span>
                        <strong class="timer-display" style="font-size:1.05rem; color:white; font-variant-numeric: tabular-nums;">${formattedTime}</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; min-width:0;">
                            <span style="font-size:0.7rem; color:var(--text-secondary);">Valor Hora</span>
                            <strong class="rate-value" style="font-size:0.9rem; color:${rateColor};">${rateText}</strong>
                        </div>
                        <button class="btn-timer" aria-label="${timerButtonLabel}" data-tooltip="${timerButtonLabel}" style="background:${btnBg}; color:${btnColor}; border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; transition: transform 0.1s; flex-shrink:0;">${btnIcon}</button>
                    </div>
                </div>

                <div class="project-dates" style="margin-bottom: 0.75rem;">
                    <div class="date-block">
                        <span>${safeLeftDateLabel}</span>
                        <strong>${safeLeftDateValue}</strong>
                    </div>
                    <div class="date-block" style="text-align: right;">
                        <span>${safeRightDateLabel}</span>
                        <strong>${safeRightDateValue}</strong>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-plan" style="margin: 0; width: 100%;"><i class="ph ph-clipboard-text"></i> Plan del Proyecto</button>
                    </div>
                    ${p.isArbitration ? `
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary half btn-manage" style="margin:0;"><i class="ph ph-gear"></i> Gestionar</button>
                            <button class="btn btn-primary half btn-resolve" style="margin:0; background: var(--status-red); color: white;"><i class="ph ph-scales"></i> Resolver</button>
                        </div>
                    ` : (p.hasChangesRequested ? `
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary half btn-manage" style="margin:0;"><i class="ph ph-gear"></i> Gestionar</button>
                            <button class="btn btn-primary half btn-redeliver" style="margin:0; background: var(--status-green); color: white;"><i class="ph ph-arrow-clockwise"></i> Reentregar Trabajo</button>
                        </div>
                    ` : (!p.isDelivered ? `
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary half btn-manage" style="margin:0;"><i class="ph ph-gear"></i> Gestionar</button>
                            <button class="btn btn-primary half btn-deliver" style="margin:0; background: var(--status-green); color: white;"><i class="ph ph-check"></i> Entregado</button>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary half btn-manage" style="margin:0;"><i class="ph ph-gear"></i> Gestionar</button>
                                <button class="btn btn-primary half btn-confirm" style="margin:0; background: var(--status-green); color: white;"><i class="ph ph-coins"></i> Pago Confirmado</button>
                            </div>
                            <button class="btn btn-secondary btn-request-changes" style="margin:0; width:100%; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.3); color: #fbbf24; font-size: 0.8rem; height: 32px;"><i class="ph ph-warning-diamond"></i> Solicitó Cambios el Cliente</button>
                        </div>
                    `)) }
                </div>
            `;
            card.querySelector('.project-status-pill')?.addEventListener('click', () => {
                this.openStatusNoteModal(p.id);
            });
            card.querySelector('.btn-history-delete').addEventListener('click', () => {
                this.deleteActiveProject(p.id);
            });
            card.querySelector('.btn-timer').addEventListener('click', (e) => {
                this.toggleTimer(p.id, e);
            });
            card.querySelector('.btn-plan').addEventListener('click', () => {
                this.openPlanModal(p.id);
            });
            card.querySelector('.btn-manage').addEventListener('click', () => {
                this.openEditModal(p.id);
            });

            if (p.isArbitration) {
                card.querySelector('.btn-resolve').addEventListener('click', () => {
                    this.openResolveArbitrationModal(p.id);
                });
            } else if (p.hasChangesRequested) {
                card.querySelector('.btn-redeliver')?.addEventListener('click', () => {
                    this.reDeliverWork(p.id);
                });
            } else if (!p.isDelivered) {
                card.querySelector('.btn-deliver')?.addEventListener('click', () => {
                    this.markAsDelivered(p.id);
                });
            } else {
                card.querySelector('.btn-confirm')?.addEventListener('click', () => {
                    this.confirmPayment(p.id);
                });
                card.querySelector('.btn-request-changes')?.addEventListener('click', () => {
                    this.requestChanges(p.id);
                });
            }

            list.appendChild(card);
        });
    }

    deleteActiveProject(id) {
        if (confirm('¿Seguro que deseas eliminar este proyecto de la lista de activos?')) {
            const idStr = String(id);
            this.projects = this.projects.filter(p => String(p.id) !== idStr);
            this.saveData();
            this.render();
            this.app.auth?.syncToCloud(false).catch(() => {});
        }
    }

    toggleTimer(id, event) {
        if (event) event.stopPropagation();

        const now = new Date();
        const p = this.projects.find(proj => proj.id == id);
        if (!p) return;

        if (p.isArbitration) {
            alert("No se puede iniciar el temporizador en un proyecto en arbitraje.");
            return;
        }

        if (p.timerStart) {
            // Pausar timer
            const elapsed = now - new Date(p.timerStart);
            p.timeSpent = (p.timeSpent || 0) + elapsed;
            p.timerStart = null;
        } else {
            // Iniciar timer (Pausar todos los demás activos)
            this.projects.forEach(other => {
                if (other.timerStart && other.id !== p.id) {
                    const elapsed = now - new Date(other.timerStart);
                    other.timeSpent = (other.timeSpent || 0) + elapsed;
                    other.timerStart = null;
                }
            });
            p.timerStart = now.toISOString();
        }

        this.saveData();
        this.render();
    }

    openPlanModal(id) {
        this.currentProjectId = id;
        const p = this.projects.find(proj => String(proj.id) === String(id)) || this.history.find(proj => String(proj.id) === String(id));
        if (!p) return;

        const titleEl = document.getElementById('proj-plan-modal-title');
        if (titleEl) {
            titleEl.innerText = `Plan de Acción (${p.client ? p.client + ': ' + p.project : p.project})`;
        }

        const summaryEl = document.getElementById('proj-summary-textarea');
        const phasesEl = document.getElementById('proj-phases-textarea');

        if (summaryEl) summaryEl.value = p.summary || '';
        if (phasesEl) phasesEl.value = p.phases || '';

        const modal = document.getElementById('projects-plan-modal');
        modal?.classList.remove('hidden');
    }



    openEditModal(id) {
        this.currentProjectId = id;
        const p = this.projects.find(proj => String(proj.id) === String(id));
        const modal = document.getElementById('projects-edit-modal');
        if (modal && p) {
            let deadlineStr = '';
            if (p.deadline) {
                const date = new Date(p.deadline);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                deadlineStr = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else {
                const date = new Date();
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                deadlineStr = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
            document.getElementById('proj-edit-deadline').value = deadlineStr;
            document.getElementById('proj-extraBudget').value = 0;
            
            // Calcular horas y minutos acumulados actuales
            const totalSecs = Math.floor((p.timeSpent || 0) / 1000);
            const totalMins = Math.floor(totalSecs / 60);
            const hrs = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            
            document.getElementById('proj-manualHours').value = hrs;
            document.getElementById('proj-manualMinutes').value = mins;
            
            const isArbitrationCheckbox = document.getElementById('proj-isArbitration');
            if (isArbitrationCheckbox) {
                isArbitrationCheckbox.checked = !!p.isArbitration;
                const visual = document.getElementById('proj-isArbitration-visual');
                if (visual) {
                    visual.innerHTML = isArbitrationCheckbox.checked ? '✓' : '';
                    visual.style.background = isArbitrationCheckbox.checked ? 'var(--status-red)' : 'transparent';
                }
            }
            
            modal.classList.remove('hidden');
        }
    }

    markAsDelivered(id) {
        const p = this.projects.find(proj => proj.id == id);
        if (p) {
            // Pausar timer si está activo
            if (p.timerStart) {
                const elapsed = new Date() - new Date(p.timerStart);
                p.timeSpent = (p.timeSpent || 0) + elapsed;
                p.timerStart = null;
            }
            p.isDelivered = true;
            p.hasChangesRequested = false;
            p.deliveredAt = new Date().toISOString();
            this.saveData();
            this.render();
        }
    }

    confirmPayment(id) {
        const pIndex = this.projects.findIndex(proj => proj.id == id);
        if (pIndex !== -1) {
            const p = this.projects[pIndex];
            p.deliveredDate = getLocalISODate();

            this.history.unshift(p);
            this.projects.splice(pIndex, 1);
            this.saveData();
            this.render();
            this.app.finanzas?.render();
        }
    }

    openResolveArbitrationModal(id) {
        this.currentProjectId = id;
        const p = this.projects.find(proj => String(proj.id) === String(id));
        const modal = document.getElementById('projects-resolve-arbitration-modal');
        if (modal && p) {
            document.getElementById('proj-resolve-desc').innerText = `Proyecto de ${p.client} - ${p.project}. Se recalculará el presupuesto final según el porcentaje que decida el arbitraje.`;
            document.getElementById('proj-resolve-orig-gross').innerText = this.app.formatCurrency(p.budgetGross || 0);
            document.getElementById('proj-arbitration-pct').value = 70; // 70% por defecto
            
            modal.classList.remove('hidden');
            this.updateArbitrationPreview();
        }
    }

    updateArbitrationPreview() {
        if (!this.currentProjectId) return;
        const p = this.projects.find(proj => String(proj.id) === String(this.currentProjectId));
        if (!p) return;

        let pct = parseFloat(document.getElementById('proj-arbitration-pct').value);
        if (isNaN(pct)) pct = 0;
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;

        const targetGross = p.budgetGross * (pct / 100);
        const targetNet = this.calculateNet(targetGross, p.feeType, p.manualPercent, p.isDelegated, p.isReceived);

        document.getElementById('proj-resolve-new-gross').innerText = this.app.formatCurrency(targetGross);
        document.getElementById('proj-resolve-new-net').innerText = this.app.formatCurrency(targetNet);
    }

    confirmResolveArbitration() {
        if (!this.currentProjectId) return;
        const pIndex = this.projects.findIndex(proj => String(proj.id) === String(this.currentProjectId));
        if (pIndex === -1) return;

        const p = this.projects[pIndex];
        let pct = parseFloat(document.getElementById('proj-arbitration-pct').value);
        if (isNaN(pct)) pct = 0;
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;

        const targetGross = p.budgetGross * (pct / 100);
        const targetNet = this.calculateNet(targetGross, p.feeType, p.manualPercent, p.isDelegated, p.isReceived);

        // Guardar valores resueltos
        p.budgetGross = parseFloat(targetGross.toFixed(2));
        p.budgetNet = parseFloat(targetNet.toFixed(2));
        p.isArbitration = false;
        p.resolvedViaArbitration = true;
        p.arbitrationPercent = pct;
        p.deliveredDate = getLocalISODate();

        // Mover al historial
        this.history.unshift(p);
        this.projects.splice(pIndex, 1);

        this.saveData();
        this.render();
        this.app.finanzas?.render();

        const modal = document.getElementById('projects-resolve-arbitration-modal');
        modal?.classList.add('hidden');
        this.currentProjectId = null;
    }

    renderMonthlyHistory(filterType = 'all') {
        const list = document.getElementById('proj-monthlyHistoryList');
        if (!list) return;
        list.innerHTML = '';

        // Calcular Promedios
        const averages = this.calculateAverages();
        document.getElementById('proj-avgHistorical').innerText = this.app.formatCurrency(averages.historical);
        document.getElementById('proj-avg6Months').innerText = this.app.formatCurrency(averages.last6);
        document.getElementById('proj-avg3Months').innerText = this.app.formatCurrency(averages.last3);

        // Agrupar
        const monthsMap = {};
        this.history.forEach(p => {
            const dateStr = p.deliveredDate || p.deliveredAt;
            const delDate = parseDateLocal(dateStr) || new Date();
            const year = delDate.getFullYear();
            const month = delDate.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;

            if (!monthsMap[key]) {
                monthsMap[key] = {
                    title: delDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' }),
                    projects: [],
                    totalNet: 0
                };
            }
            monthsMap[key].projects.push(p);
            monthsMap[key].totalNet += (p.budgetNet || 0);
        });

        // Ordenar meses descendiente
        const sortedKeys = Object.keys(monthsMap).sort((a, b) => b.localeCompare(a));

        if (sortedKeys.length === 0) {
            list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">Historial vacío.</p>';
            return;
        }

        sortedKeys.forEach(k => {
            const m = monthsMap[k];
            const card = document.createElement('div');
            card.className = 'history-month-card';

            let projItems = '';
            m.projects.forEach(p => {
                const dateVal = p.deliveredDate || p.deliveredAt;
                let dateStr = '-';
                if (dateVal) {
                    if (dateVal.length === 10 && dateVal.includes('-') && !dateVal.includes('T')) {
                        const [y, m, d] = dateVal.split('-');
                        dateStr = `${d}/${m}/${y}`;
                    } else {
                        const d = parseDateLocal(dateVal);
                        if (d) {
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            dateStr = `${day}/${month}/${year}`;
                        }
                    }
                }
                const safeClient = escapeHtml(p.client || '');
                const safeProjectName = escapeHtml(p.project || '');
                const safeDate = escapeHtml(dateStr);
                const safeProjectId = escapeHtml(p.id);
                projItems += `
                    <div class="history-project-item">
                        <div class="history-project-info">
                            <span class="history-project-title">${safeClient} - ${safeProjectName}</span>
                            <span class="history-project-date">Cobrado: ${safeDate}</span>
                        </div>
                        <div class="history-project-actions">
                            <span class="history-project-net">+ ${this.app.formatCurrency(p.budgetNet)}</span>
                            <button type="button" class="btn-delete-history-project" data-id="${safeProjectId}" title="Desconfirmar pago" aria-label="Desconfirmar pago de ${safeProjectName}">&times;</button>
                        </div>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="history-month-header">
                    <h4>${escapeHtml(m.title)}</h4>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <strong style="color:var(--status-green);">+ ${this.app.formatCurrency(m.totalNet)}</strong>
                        <span class="toggle-icon"><i class="ph ph-caret-down"></i></span>
                    </div>
                </div>
                <div class="history-month-details hidden">
                    ${projItems}
                </div>
            `;
            
            card.querySelector('.history-month-header').addEventListener('click', () => {
                card.querySelector('.history-month-details').classList.toggle('hidden');
            });
            
            card.querySelectorAll('.btn-delete-history-project').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.deleteHistoryProject(parseInt(btn.dataset.id), filterType);
                });
            });

            list.appendChild(card);
        });
    }

    deleteHistoryProject(id, filterType) {
        const idStr = String(id);
        const p = this.history.find(proj => String(proj.id) === idStr);
        if (!p) return;

        if (confirm(`¿Desconfirmar el pago del proyecto "${p.project}" de ${p.client}?\n\nEl proyecto se quitará de los ingresos y volverá a la lista de activos.`)) {
            this.history = this.history.filter(proj => String(proj.id) !== idStr);
            p.deliveredDate = null;
            p.isDelivered = false;
            p.deliveredAt = null;
            this.projects.push(p);
            this.saveData();
            this.render();
            this.renderMonthlyHistory(filterType);
            this.app.auth?.syncToCloud(false).catch(() => {});
        }
    }

    calculateAverages() {
        if (this.history.length === 0) return { historical: 0, last6: 0, last3: 0 };

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let earliestDate = now;
        this.history.forEach(p => {
            const dateStr = p.deliveredDate || p.deliveredAt;
            if (dateStr) {
                const d = parseDateLocal(dateStr);
                if (d && d < earliestDate) earliestDate = d;
            }
        });

        const startYear = earliestDate.getFullYear();
        const startMonth = earliestDate.getMonth();
        const totalHistoricalMonths = Math.max(1, (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1);

        let totalUSD = 0;
        this.history.forEach(p => {
            totalUSD += (p.budgetNet || 0);
        });

        const avgHistorical = totalUSD / totalHistoricalMonths;

        let sum3Months = 0;
        let sum6Months = 0;

        const dateLimit3 = new Date(currentYear, currentMonth - 2, 1);
        const dateLimit6 = new Date(currentYear, currentMonth - 5, 1);

        this.history.forEach(p => {
            const dateStr = p.deliveredDate || p.deliveredAt;
            if (!dateStr) return;
            const d = parseDateLocal(dateStr);
            if (!d) return;
            if (d >= dateLimit3) sum3Months += (p.budgetNet || 0);
            if (d >= dateLimit6) sum6Months += (p.budgetNet || 0);
        });

        return {
            historical: avgHistorical,
            last6: sum6Months / 6,
            last3: sum3Months / 3
        };
    }

    startTimersLoop() {
        setInterval(() => {
            const now = new Date();
            this.projects.forEach(p => {
                if (p.timerStart) {
                    const cardEl = document.querySelector(`.card[data-project-id="${p.id}"]`);
                    if (cardEl) {
                        let totalMs = p.timeSpent || 0;
                        totalMs += (now - new Date(p.timerStart));

                        const totalSecs = Math.floor(totalMs / 1000);
                        const hrs = Math.floor(totalSecs / 3600);
                        const mins = Math.floor((totalSecs % 3600) / 60);
                        const secs = totalSecs % 60;

                        const timerDisplay = cardEl.querySelector('.timer-display');
                        if (timerDisplay) {
                            timerDisplay.innerText = `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
                        }

                        // Recalcular valor hora
                        const rateValue = cardEl.querySelector('.rate-value');
                        if (rateValue) {
                            const totalHours = totalMs / (3600 * 1000);
                            if (totalHours > 0) {
                                const rate = (p.budgetNet || 0) / totalHours;
                                rateValue.innerText = `${this.app.formatCurrency(rate)}/h`;

                                let rateColor = 'var(--text-secondary)';
                                if (rate >= 25) rateColor = 'var(--status-green)';
                                else if (rate >= 20) rateColor = 'var(--primary-color)';
                                else if (rate >= 10) rateColor = 'var(--status-yellow)';
                                else rateColor = 'var(--status-red)';
                                rateValue.style.color = rateColor;
                            }
                        }
                    }
                }
            });
        }, 1000);
    }
}
