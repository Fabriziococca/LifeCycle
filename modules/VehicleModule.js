import { DateUtils, getLocalISODate } from '../utils.js';

export class VehicleModule {
    constructor(controller) {
        this.controller = controller;
        window.vehicle = this;

        this.odometerInput = document.getElementById('vehicle-odometer-input');
        
        this.oilRemainingTime = document.getElementById('oil-remaining-time');
        this.oilRemainingTimeLabel = document.getElementById('oil-remaining-time-label');
        this.oilRemainingKmInfo = document.getElementById('oil-remaining-km-info');
        this.oilLastService = document.getElementById('oil-last-service');
        this.oilNextService = document.getElementById('oil-next-service');
        
        this.btnNewOil = document.getElementById('btn-add-oil-service');
        this.oilForm = document.getElementById('oil-service-form');
        this.oilFormDate = document.getElementById('oil-form-date');
        this.oilFormKm = document.getElementById('oil-form-km');
        this.oilFormCancel = document.getElementById('oil-form-cancel');
        this.oilFormSave = document.getElementById('oil-form-save');
        this.btnToggleOilHist = document.getElementById('btn-toggle-oil-history');
        this.oilHistoryLog = document.getElementById('oil-service-history');

        this.alignLast = document.getElementById('align-last');
        this.alignRemaining = document.getElementById('align-remaining');
        this.btnRecordAlign = document.getElementById('btn-record-align');

        this.rotLast = document.getElementById('rot-last');
        this.rotRemaining = document.getElementById('rot-remaining');
        this.btnRecordRot = document.getElementById('btn-record-rot');

        this.replaceLast = document.getElementById('replace-last');
        this.replaceRemaining = document.getElementById('replace-remaining');
        
        this.btnNewReplace = document.getElementById('btn-add-replace-service');
        this.replaceForm = document.getElementById('replace-service-form');
        this.replaceFormDate = document.getElementById('replace-form-date');
        this.replaceFormKm = document.getElementById('replace-form-km');
        this.replaceFormPos = document.getElementById('replace-form-pos');
        this.replaceFormCancel = document.getElementById('replace-form-cancel');
        this.replaceFormSave = document.getElementById('replace-form-save');
        this.btnToggleTiresHist = document.getElementById('btn-toggle-tires-history');
        this.tiresHistoryLog = document.getElementById('tires-service-history');

        // Fluids UI Elements
        this.refrigeranteElapsed = document.getElementById('fluid-refrigerante-elapsed');
        this.refrigeranteBadge = document.getElementById('fluid-refrigerante-badge');
        this.btnCheckRefrigerante = document.getElementById('btn-check-refrigerante');

        this.sapitoElapsed = document.getElementById('fluid-sapito-elapsed');
        this.sapitoBadge = document.getElementById('fluid-sapito-badge');
        this.btnCheckSapito = document.getElementById('btn-check-sapito');

        this.extintorExpDate = document.getElementById('extintor-exp-date');
        this.extintorRemaining = document.getElementById('extintor-remaining');
        this.extintorDateInput = document.getElementById('extintor-date-input');
        this.btnSaveExtintor = document.getElementById('btn-save-extintor');

        // Docs UI Elements
        this.docDniDate = document.getElementById('doc-dni-date');
        this.docDniDays = document.getElementById('doc-dni-days');
        this.docDniInput = document.getElementById('doc-dni-input');

        this.docLicenseDate = document.getElementById('doc-license-date');
        this.docLicenseDays = document.getElementById('doc-license-days');
        this.docLicenseInput = document.getElementById('doc-license-input');

        this.docInsuranceDate = document.getElementById('doc-insurance-date');
        this.docInsuranceDays = document.getElementById('doc-insurance-days');
        this.docInsuranceInput = document.getElementById('doc-insurance-input');

        this.docVtvDate = document.getElementById('doc-vtv-date');
        this.docVtvDays = document.getElementById('doc-vtv-days');
        this.docVtvInput = document.getElementById('doc-vtv-input');

        // Issues UI Elements
        this.addIssueForm = document.getElementById('vehicle-add-issue-form');
        this.issueTitleInput = document.getElementById('issue-title-input');
        this.issueUrgencySelect = document.getElementById('issue-urgency-select');
        this.issuesListContainer = document.getElementById('vehicle-issues-list');

        // Load data
        this.odometer = Number(localStorage.getItem('vehicle_odometer')) || 0;
        try {
            const rawLog = localStorage.getItem('vehicle_maintenance_log');
            this.maintenanceLog = rawLog ? JSON.parse(rawLog) : null;
        } catch (e) {
            console.error("Error parsing vehicle_maintenance_log:", e);
        }
        this.maintenanceLog = this.maintenanceLog || [];

        // Load documents tracker data
        try {
            const rawTracker = localStorage.getItem('vehicle_tracker_data');
            this.trackerData = rawTracker ? JSON.parse(rawTracker) : {};
        } catch (e) {
            console.error("Error parsing vehicle_tracker_data:", e);
            this.trackerData = {};
        }
        this.trackerData = Object.assign({
            dniExpDate: "",
            licenseExpDate: "",
            insuranceExpDate: "",
            vtvExpDate: "",
            extintorDate: "",
            refrigeranteDate: "",
            sapitoDate: ""
        }, this.trackerData);

        // Load issues checklist
        try {
            const rawIssues = localStorage.getItem('vehicle_issues');
            this.issues = rawIssues ? JSON.parse(rawIssues) : [];
        } catch (e) {
            console.error("Error parsing vehicle_issues:", e);
            this.issues = [];
        }
        
        this.init();
    }

    saveOdometer() {
        localStorage.setItem('vehicle_odometer', this.odometer.toString());
    }

    saveMaintenanceLog() {
        localStorage.setItem('vehicle_maintenance_log', JSON.stringify(this.maintenanceLog));
    }

    init() {
        // Navigation (sub-tabs)
        const tabsContainer = document.getElementById('vehicle-tabs-container');
        if (tabsContainer) {
            tabsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (!btn) return;
                tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetTab = btn.dataset.vehicleTab;
                document.querySelectorAll('.vehicle-tab-content').forEach(content => {
                    content.classList.toggle('hidden', content.id !== `vehicle-${targetTab}-content`);
                });
                this.render();
            });
        }

        if (this.odometerInput) {
            this.odometerInput.value = this.odometer;
            this.odometerInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value) || 0;
                this.odometer = val;
                this.saveOdometer();
                this.render();
            });
        }

        this.btnNewOil?.addEventListener('click', () => {
            if (this.oilForm) this.oilForm.classList.remove('hidden');
            if (this.oilFormDate) this.oilFormDate.value = getLocalISODate();
            if (this.oilFormKm) this.oilFormKm.value = this.odometer;
        });
        
        this.oilFormCancel?.addEventListener('click', () => {
            this.clearOilForm();
        });

        this.oilFormSave?.addEventListener('click', () => {
            this.saveOilService();
        });

        this.btnToggleOilHist?.addEventListener('click', () => {
            if (this.oilHistoryLog) {
                if (this.oilHistoryLog.classList.contains('hidden')) {
                    this.oilHistoryLog.classList.remove('hidden');
                    this.btnToggleOilHist.innerText = 'Ocultar historial de servicios';
                } else {
                    this.oilHistoryLog.classList.add('hidden');
                    this.btnToggleOilHist.innerText = 'Ver historial de servicios';
                }
            }
        });

        this.btnRecordAlign?.addEventListener('click', () => {
            this.recordQuickGeometry('Alineación & Balanceo');
        });

        this.btnRecordRot?.addEventListener('click', () => {
            this.recordQuickGeometry('Rotación de Neumáticos');
        });

        this.btnNewReplace?.addEventListener('click', () => {
            if (this.replaceForm) this.replaceForm.classList.remove('hidden');
            if (this.replaceFormDate) this.replaceFormDate.value = getLocalISODate();
            if (this.replaceFormKm) this.replaceFormKm.value = this.odometer;
        });

        this.replaceFormCancel?.addEventListener('click', () => {
            this.clearReplaceForm();
        });

        this.replaceFormSave?.addEventListener('click', () => {
            this.saveReplaceService();
        });

        this.btnToggleTiresHist?.addEventListener('click', () => {
            if (this.tiresHistoryLog) {
                if (this.tiresHistoryLog.classList.contains('hidden')) {
                    this.tiresHistoryLog.classList.remove('hidden');
                    this.btnToggleTiresHist.innerText = 'Ocultar historial mecánico';
                } else {
                    this.tiresHistoryLog.classList.add('hidden');
                    this.btnToggleTiresHist.innerText = 'Ver historial mecánico';
                }
            }
        });

        // Fluidos
        this.btnCheckRefrigerante?.addEventListener('click', () => {
            this.updateFluidCheck('refrigeranteDate');
        });

        this.btnCheckSapito?.addEventListener('click', () => {
            this.updateFluidCheck('sapitoDate');
        });

        this.btnSaveExtintor?.addEventListener('click', () => {
            const dateVal = this.extintorDateInput?.value;
            if (!dateVal) {
                alert('Por favor selecciona una fecha de vencimiento.');
                return;
            }
            this.updateDocDate('extintorDate', dateVal);
        });

        // Documentos
        document.querySelectorAll('.btn-save-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docType = btn.getAttribute('data-doc');
                let inputEl = null;
                let key = '';

                if (docType === 'dni') {
                    inputEl = this.docDniInput;
                    key = 'dniExpDate';
                } else if (docType === 'license') {
                    inputEl = this.docLicenseInput;
                    key = 'licenseExpDate';
                } else if (docType === 'insurance') {
                    inputEl = this.docInsuranceInput;
                    key = 'insuranceExpDate';
                } else if (docType === 'vtv') {
                    inputEl = this.docVtvInput;
                    key = 'vtvExpDate';
                }

                if (inputEl && inputEl.value) {
                    this.updateDocDate(key, inputEl.value);
                } else {
                    alert('Por favor selecciona una fecha válida.');
                }
            });
        });

        // Fallas
        this.addIssueForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = this.issueTitleInput?.value.trim();
            const urgency = this.issueUrgencySelect?.value || 'baja';
            if (title) {
                this.addIssue(title, urgency);
                if (this.issueTitleInput) this.issueTitleInput.value = '';
            }
        });

        this.render();
    }

    clearOilForm() {
        this.oilForm?.classList.add('hidden');
        if (this.oilFormDate) this.oilFormDate.value = '';
        if (this.oilFormKm) this.oilFormKm.value = '';
    }

    clearReplaceForm() {
        this.replaceForm?.classList.add('hidden');
        if (this.replaceFormDate) this.replaceFormDate.value = '';
        if (this.replaceFormKm) this.replaceFormKm.value = '';
    }

    saveOilService() {
        const dateVal = this.oilFormDate?.value;
        const kmVal = parseInt(this.oilFormKm?.value) || 0;

        if (!dateVal) {
            alert('Por favor selecciona la fecha del servicio.');
            return;
        }

        if (kmVal <= 0) {
            alert('Por favor ingresa un kilometraje válido.');
            return;
        }

        const chkOil = document.getElementById('oil-chk-oil')?.checked || false;
        const chkFilOil = document.getElementById('oil-chk-fil-oil')?.checked || false;
        const chkFilAir = document.getElementById('oil-chk-fil-air')?.checked || false;
        const chkFilCab = document.getElementById('oil-chk-fil-cab')?.checked || false;

        const entry = {
            id: 'maint_' + Date.now(),
            type: 'Aceite y Filtros',
            date: dateVal,
            km: kmVal,
            details: {
                oil: chkOil,
                filterOil: chkFilOil,
                filterAir: chkFilAir,
                filterCabin: chkFilCab
            }
        };

        this.maintenanceLog.push(entry);
        this.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));

        if (kmVal > this.odometer) {
            this.odometer = kmVal;
            this.saveOdometer();
            if (this.odometerInput) this.odometerInput.value = this.odometer;
        }

        this.saveMaintenanceLog();
        this.clearOilForm();
        this.render();
    }

    recordQuickGeometry(type) {
        const dateVal = getLocalISODate();
        const kmVal = this.odometer;

        const entry = {
            id: 'maint_' + Date.now(),
            type: type,
            date: dateVal,
            km: kmVal,
            details: {}
        };

        this.maintenanceLog.push(entry);
        this.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));
        this.saveMaintenanceLog();
        this.render();
    }

    saveReplaceService() {
        const dateVal = this.replaceFormDate?.value;
        const kmVal = parseInt(this.replaceFormKm?.value) || 0;
        const posVal = this.replaceFormPos?.value || '4';

        if (!dateVal) {
            alert('Por favor selecciona la fecha del servicio.');
            return;
        }

        if (kmVal <= 0) {
            alert('Por favor ingresa un kilometraje válido.');
            return;
        }

        let posText = 'Las 4 Ruedas';
        if (posVal === '2-del') posText = 'Las 2 Delanteras';
        else if (posVal === '2-tras') posText = 'Las 2 Traseras';

        const entry = {
            id: 'maint_' + Date.now(),
            type: 'Reemplazo de Neumáticos',
            date: dateVal,
            km: kmVal,
            details: {
                position: posText
            }
        };

        this.maintenanceLog.push(entry);
        this.maintenanceLog.sort((a, b) => b.km - a.km || new Date(b.date) - new Date(a.date));

        if (kmVal > this.odometer) {
            this.odometer = kmVal;
            this.saveOdometer();
            if (this.odometerInput) this.odometerInput.value = this.odometer;
        }

        this.saveMaintenanceLog();
        this.clearReplaceForm();
        this.render();
    }

    deleteMaintenance(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este registro de servicio?')) {
            this.maintenanceLog = this.maintenanceLog.filter(m => m.id !== id);
            this.saveMaintenanceLog();
            this.render();
        }
    }

    formatDate(dateStr) {
        return DateUtils.formatInputDate(dateStr);
    }

    calculateDaysElapsed(dateStr) {
        return DateUtils.getDaysElapsed(dateStr);
    }

    calculateDaysUntil(dateStr) {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        const today = new Date();
        target.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = target - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    render() {
        const activeBtn = document.querySelector('#vehicle-tabs-container .tab-btn.active');
        const tab = activeBtn ? activeBtn.dataset.vehicleTab : 'maint';

        if (tab === 'maint') {
            this.renderOilCard();
            this.renderTiresCard();
            this.renderFluidsCard();
            this.renderHistories();
        } else if (tab === 'docs') {
            this.renderDocs();
        } else if (tab === 'issues') {
            this.renderIssues();
        }

        this.controller.notificationsCenter?.updateBadge();
    }

    renderFluidsCard() {
        const elCard = document.getElementById('vehicle-fluids-card');
        if (!elCard) return;

        // Get limits from rulesConfig
        const fRules = this.controller.auth?.config?.rulesConfig?.vehicle?.fluids || {
            refrigerante: { days: 90 },
            sapito: { days: 45 },
            extintor: { days_until_expiry: 30 }
        };

        // Refrigerante
        const refDate = this.trackerData.refrigeranteDate;
        const refDays = refDate ? this.calculateDaysElapsed(refDate) : null;
        const cardRef = document.getElementById('fluid-card-refrigerante');
        if (this.refrigeranteElapsed) {
            this.refrigeranteElapsed.innerText = refDays !== null ? `${refDays} días desde última revisión` : 'Sin registros de revisión';
        }
        if (this.refrigeranteBadge) {
            this.refrigeranteBadge.className = 'badge';
            const limit = fRules.refrigerante.days;
            if (refDays === null) {
                this.refrigeranteBadge.innerText = 'N/A';
                this.refrigeranteBadge.classList.add('gray');
                if (cardRef) cardRef.style.borderLeftColor = 'var(--surface-border)';
            } else if (refDays >= limit) {
                this.refrigeranteBadge.innerText = 'REVISAR';
                this.refrigeranteBadge.classList.add('red');
                if (cardRef) cardRef.style.borderLeftColor = 'var(--status-red)';
            } else if (refDays >= limit * 0.83) {
                this.refrigeranteBadge.innerText = 'PRONTO';
                this.refrigeranteBadge.classList.add('orange');
                if (cardRef) cardRef.style.borderLeftColor = 'var(--status-orange)';
            } else {
                this.refrigeranteBadge.innerText = 'OK';
                this.refrigeranteBadge.classList.add('green');
                if (cardRef) cardRef.style.borderLeftColor = 'var(--status-green)';
            }
        }

        // Sapito
        const sapDate = this.trackerData.sapitoDate;
        const sapDays = sapDate ? this.calculateDaysElapsed(sapDate) : null;
        const cardSap = document.getElementById('fluid-card-sapito');
        if (this.sapitoElapsed) {
            this.sapitoElapsed.innerText = sapDays !== null ? `${sapDays} días desde última revisión` : 'Sin registros de revisión';
        }
        if (this.sapitoBadge) {
            this.sapitoBadge.className = 'badge';
            const limit = fRules.sapito.days;
            if (sapDays === null) {
                this.sapitoBadge.innerText = 'N/A';
                this.sapitoBadge.classList.add('gray');
                if (cardSap) cardSap.style.borderLeftColor = 'var(--surface-border)';
            } else if (sapDays >= limit) {
                this.sapitoBadge.innerText = 'REVISAR';
                this.sapitoBadge.classList.add('red');
                if (cardSap) cardSap.style.borderLeftColor = 'var(--status-red)';
            } else if (sapDays >= limit * 0.77) {
                this.sapitoBadge.innerText = 'PRONTO';
                this.sapitoBadge.classList.add('orange');
                if (cardSap) cardSap.style.borderLeftColor = 'var(--status-orange)';
            } else {
                this.sapitoBadge.innerText = 'OK';
                this.sapitoBadge.classList.add('green');
                if (cardSap) cardSap.style.borderLeftColor = 'var(--status-green)';
            }
        }

        // Extintor
        const extDate = this.trackerData.extintorDate;
        const extRemaining = extDate ? this.calculateDaysUntil(extDate) : null;
        const cardExt = document.getElementById('fluid-card-extintor');
        if (this.extintorExpDate) {
            this.extintorExpDate.innerText = extDate ? this.formatDate(extDate) : 'No registrado';
        }
        if (this.extintorRemaining) {
            const limit = fRules.extintor.days_until_expiry;
            if (extRemaining === null) {
                this.extintorRemaining.innerText = '--';
                this.extintorRemaining.style.color = 'var(--text-secondary)';
                if (cardExt) cardExt.style.borderLeftColor = 'var(--surface-border)';
            } else if (extRemaining <= 0) {
                this.extintorRemaining.innerText = `⚠️ Vencido (hace ${Math.abs(extRemaining)} días)`;
                this.extintorRemaining.style.color = 'var(--status-red)';
                if (cardExt) cardExt.style.borderLeftColor = 'var(--status-red)';
            } else if (extRemaining <= limit) {
                this.extintorRemaining.innerText = `⚠️ Vence en ${extRemaining} días`;
                this.extintorRemaining.style.color = 'var(--status-orange)';
                if (cardExt) cardExt.style.borderLeftColor = 'var(--status-orange)';
            } else {
                this.extintorRemaining.innerText = `${extRemaining} días restantes`;
                this.extintorRemaining.style.color = 'var(--status-green)';
                if (cardExt) cardExt.style.borderLeftColor = 'var(--status-green)';
            }
        }
        if (this.extintorDateInput) {
            this.extintorDateInput.value = extDate || '';
        }
    }

    renderDocs() {
        const docs = [
            { key: 'dniExpDate', dateEl: this.docDniDate, daysEl: this.docDniDays, inputEl: this.docDniInput, label: 'DNI', cardId: 'doc-card-dni' },
            { key: 'licenseExpDate', dateEl: this.docLicenseDate, daysEl: this.docLicenseDays, inputEl: this.docLicenseInput, label: 'Registro de Conducir', cardId: 'doc-card-license' },
            { key: 'insuranceExpDate', dateEl: this.docInsuranceDate, daysEl: this.docInsuranceDays, inputEl: this.docInsuranceInput, label: 'Seguro', cardId: 'doc-card-insurance' },
            { key: 'vtvExpDate', dateEl: this.docVtvDate, daysEl: this.docVtvDays, inputEl: this.docVtvInput, label: 'VTV', cardId: 'doc-card-vtv' }
        ];

        docs.forEach(d => {
            const expDate = this.trackerData[d.key];
            const remaining = expDate ? this.calculateDaysUntil(expDate) : null;
            const cardEl = document.getElementById(d.cardId);

            if (d.dateEl) {
                d.dateEl.innerText = expDate ? this.formatDate(expDate) : 'No registrado';
            }
            if (d.inputEl) {
                d.inputEl.value = expDate || '';
            }

            if (d.daysEl) {
                if (remaining === null) {
                    d.daysEl.innerText = 'Sin registrar fecha de vencimiento.';
                    d.daysEl.style.color = 'var(--text-secondary)';
                    if (cardEl) cardEl.style.borderLeftColor = 'var(--surface-border)';
                } else if (remaining <= 0) {
                    d.daysEl.innerText = `⚠️ VENCIDO (hace ${Math.abs(remaining)} días). Renovar urgente.`;
                    d.daysEl.style.color = 'var(--status-red)';
                    if (cardEl) cardEl.style.borderLeftColor = 'var(--status-red)';
                } else if (remaining <= 30) {
                    d.daysEl.innerText = `⚠️ Vence en ${remaining} días. Recordar renovar.`;
                    d.daysEl.style.color = 'var(--status-red)';
                    if (cardEl) cardEl.style.borderLeftColor = 'var(--status-red)';
                } else if (remaining <= 90) {
                    d.daysEl.innerText = `Vence en ${remaining} días.`;
                    d.daysEl.style.color = 'var(--status-orange)';
                    if (cardEl) cardEl.style.borderLeftColor = 'var(--status-orange)';
                } else {
                    d.daysEl.innerText = `Vence en ${remaining} días. Todo OK.`;
                    d.daysEl.style.color = 'var(--status-green)';
                    if (cardEl) cardEl.style.borderLeftColor = 'var(--status-green)';
                }
            }
        });
    }

    renderIssues() {
        if (!this.issuesListContainer) return;
        this.issuesListContainer.innerHTML = '';

        const activeIssues = this.issues.filter(i => !i.resolvedAt);

        if (activeIssues.length === 0) {
            this.issuesListContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay fallas ni pendientes registrados.</p>';
            return;
        }

        activeIssues.forEach(issue => {
            const div = document.createElement('div');
            div.className = 'vehicle-issue-item';

            const urgencyBadge = issue.urgency === 'alta' 
                ? '<span class="badge red">Urgencia Alta</span>' 
                : '<span class="badge gray">Baja Urgencia</span>';

            const dateStr = this.formatDate(issue.createdAt);

            div.innerHTML = `
                <div class="vehicle-issue-content">
                    <div class="vehicle-issue-title-row">
                        <strong style="color:white; font-size:0.95rem;">${issue.title}</strong>
                        ${urgencyBadge}
                    </div>
                    <div class="vehicle-issue-meta">
                        <span><i class="ph ph-calendar-blank" style="vertical-align: middle; margin-right: 4px;"></i>Reportado el: ${dateStr}</span>
                    </div>
                </div>
                <button class="btn-solve" data-id="${issue.id}">
                    <i class="ph ph-check-circle"></i> Solucionar
                </button>
            `;
            
            div.querySelector('.btn-solve').addEventListener('click', () => {
                this.resolveIssue(issue.id);
            });

            this.issuesListContainer.appendChild(div);
        });
    }

    updateFluidCheck(key) {
        this.trackerData[key] = getLocalISODate();
        this.saveTrackerData();
        this.render();
    }

    updateDocDate(key, value) {
        this.trackerData[key] = value;
        this.saveTrackerData();
        this.render();
    }

    addIssue(title, urgency) {
        const issue = {
            id: 'issue_' + Date.now(),
            title,
            urgency,
            createdAt: getLocalISODate(),
            resolvedAt: null
        };
        this.issues.push(issue);
        this.saveIssues();
        this.render();
    }

    resolveIssue(id) {
        if (confirm('¿Marcar esta falla como solucionada?')) {
            const issue = this.issues.find(i => i.id === id);
            if (issue) {
                issue.resolvedAt = getLocalISODate();
                this.issues = this.issues.filter(i => i.id !== id);
                this.saveIssues();
                this.render();
            }
        }
    }

    saveTrackerData() {
        localStorage.setItem('vehicle_tracker_data', JSON.stringify(this.trackerData));
        this.controller.triggerDataSync('vehicle_tracker_data');
    }

    saveIssues() {
        localStorage.setItem('vehicle_issues', JSON.stringify(this.issues));
        this.controller.triggerDataSync('vehicle_issues');
    }

    renderOilCard() {
        const lastOil = this.maintenanceLog.find(m => m.type === 'Aceite y Filtros');
        const elCard = document.getElementById('vehicle-oil-card');
        
        // Get limits from rulesConfig
        const vRules = this.controller.auth?.config?.rulesConfig?.vehicle?.oil || { km: 10000, days: 365 };

        if (lastOil) {
            const nextKm = lastOil.km + vRules.km;
            const remainingKm = nextKm - this.odometer;
            const daysElapsed = this.calculateDaysElapsed(lastOil.date);
            const remainingDays = vRules.days - (daysElapsed || 0);

            let colorVar = 'var(--status-green)';
            if ((this.odometer > 0 && remainingKm <= 0) || remainingDays <= 0) {
                colorVar = 'var(--status-red)';
            } else if ((this.odometer > 0 && remainingKm <= 1000) || remainingDays <= 30) {
                colorVar = 'var(--status-orange)';
            }

            if (elCard) elCard.style.borderColor = colorVar;

            if (this.oilRemainingTime) {
                this.oilRemainingTime.style.color = colorVar;
                if (remainingDays <= 0) {
                    this.oilRemainingTime.innerText = 'Vencido';
                    if (this.oilRemainingTimeLabel) {
                        this.oilRemainingTimeLabel.innerText = `hace ${Math.abs(remainingDays)} días (1 año máx.)`;
                    }
                } else {
                    this.oilRemainingTime.innerText = `${remainingDays}`;
                    if (this.oilRemainingTimeLabel) {
                        this.oilRemainingTimeLabel.innerText = `días restantes (1 año máx.)`;
                    }
                }
            }

            if (this.oilRemainingKmInfo) {
                if (this.odometer > 0 && remainingKm <= 0) {
                    this.oilRemainingKmInfo.innerHTML = `⚠️ Km excedido por <strong>${Math.abs(remainingKm).toLocaleString('es-AR')} km</strong>`;
                    this.oilRemainingKmInfo.style.color = 'var(--status-red)';
                } else if (this.odometer > 0) {
                    this.oilRemainingKmInfo.innerHTML = `Equivale a <strong>${remainingKm.toLocaleString('es-AR')} km</strong> restantes (límite ${vRules.km.toLocaleString('es-AR')} km)`;
                    this.oilRemainingKmInfo.style.color = 'var(--text-secondary)';
                } else {
                    this.oilRemainingKmInfo.innerHTML = `Próximo cambio a los <strong>${nextKm.toLocaleString('es-AR')} km</strong> (límite ${vRules.km.toLocaleString('es-AR')} km)`;
                    this.oilRemainingKmInfo.style.color = 'var(--text-secondary)';
                }
            }

            if (this.oilLastService) {
                this.oilLastService.innerText = `${lastOil.km.toLocaleString('es-AR')} km (${this.formatDate(lastOil.date)})`;
            }

            if (this.oilNextService) {
                this.oilNextService.innerText = `${nextKm.toLocaleString('es-AR')} km`;
            }
        } else {
            if (elCard) elCard.style.borderColor = 'var(--surface-border)';
            if (this.oilRemainingTime) {
                this.oilRemainingTime.innerText = '--';
                this.oilRemainingTime.style.color = 'var(--status-green)';
            }
            if (this.oilRemainingTimeLabel) this.oilRemainingTimeLabel.innerText = 'días restantes';
            if (this.oilRemainingKmInfo) {
                this.oilRemainingKmInfo.innerText = '-- km restantes';
                this.oilRemainingKmInfo.style.color = 'var(--text-secondary)';
            }
            if (this.oilLastService) this.oilLastService.innerText = 'Nunca';
            if (this.oilNextService) this.oilNextService.innerText = 'N/A';
        }
    }

    renderTiresCard() {
        const lastAlign = this.maintenanceLog.find(m => m.type === 'Alineación & Balanceo');
        const lastRot = this.maintenanceLog.find(m => m.type === 'Rotación de Neumáticos');
        const lastReplace = this.maintenanceLog.find(m => m.type === 'Reemplazo de Neumáticos');

        let worstColor = 'var(--status-green)';
        let hasAnyRecord = false;

        // Get limits from rulesConfig
        const vRules = this.controller.auth?.config?.rulesConfig?.vehicle || {
            align: { km: 10000 },
            rot: { km: 10000 },
            replace: { km: 60000 }
        };

        const checkStatus = (lastRecord, limit) => {
            if (!lastRecord) return;
            hasAnyRecord = true;
            const remaining = (lastRecord.km + limit) - this.odometer;
            if (remaining <= 0) {
                worstColor = 'var(--status-red)';
            } else if (remaining <= 1000 && worstColor !== 'var(--status-red)') {
                worstColor = 'var(--status-orange)';
            }
        };

        checkStatus(lastAlign, vRules.align.km);
        checkStatus(lastRot, vRules.rot.km);
        checkStatus(lastReplace, vRules.replace.km);

        const elTiresCard = document.getElementById('vehicle-tires-card');
        if (elTiresCard) {
            elTiresCard.style.borderColor = hasAnyRecord ? worstColor : 'var(--surface-border)';
        }

        if (lastAlign) {
            const nextKm = lastAlign.km + vRules.align.km;
            const remaining = nextKm - this.odometer;
            if (this.alignLast) this.alignLast.innerText = `${lastAlign.km.toLocaleString('es-AR')} km (${this.formatDate(lastAlign.date)})`;
            if (this.alignRemaining) {
                this.alignRemaining.innerText = remaining <= 0 ? 'Vencido' : `${remaining.toLocaleString('es-AR')} km rest.`;
                this.alignRemaining.style.color = remaining <= 0 ? 'var(--status-red)' : 'var(--text-secondary)';
            }
        } else {
            if (this.alignLast) this.alignLast.innerText = 'Nunca';
            if (this.alignRemaining) this.alignRemaining.innerText = '-- km rest.';
        }

        if (lastRot) {
            const nextKm = lastRot.km + vRules.rot.km;
            const remaining = nextKm - this.odometer;
            if (this.rotLast) this.rotLast.innerText = `${lastRot.km.toLocaleString('es-AR')} km (${this.formatDate(lastRot.date)})`;
            if (this.rotRemaining) {
                this.rotRemaining.innerText = remaining <= 0 ? 'Vencido' : `${remaining.toLocaleString('es-AR')} km rest.`;
                this.rotRemaining.style.color = remaining <= 0 ? 'var(--status-red)' : 'var(--text-secondary)';
            }
        } else {
            if (this.rotLast) this.rotLast.innerText = 'Nunca';
            if (this.rotRemaining) this.rotRemaining.innerText = '-- km rest.';
        }

        if (lastReplace) {
            const nextKm = lastReplace.km + vRules.replace.km;
            const remaining = nextKm - this.odometer;
            if (this.replaceLast) this.replaceLast.innerText = `${lastReplace.km.toLocaleString('es-AR')} km (${this.formatDate(lastReplace.date)})`;
            if (this.replaceRemaining) {
                this.replaceRemaining.innerText = remaining <= 0 ? 'Vencido' : `${remaining.toLocaleString('es-AR')} km rest.`;
                this.replaceRemaining.style.color = remaining <= 0 ? 'var(--status-red)' : 'var(--text-secondary)';
            }
        } else {
            if (this.replaceLast) this.replaceLast.innerText = 'Nunca';
            if (this.replaceRemaining) this.replaceRemaining.innerText = '-- km rest.';
        }
    }

    renderHistories() {
        if (this.oilHistoryLog) {
            this.oilHistoryLog.innerHTML = '';
            const oilEntries = this.maintenanceLog.filter(m => m.type === 'Aceite y Filtros');
            if (oilEntries.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'history-list';
                ul.style.paddingLeft = '0';
                ul.style.listStyle = 'none';

                oilEntries.forEach(entry => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.flexDirection = 'column';
                    li.style.alignItems = 'stretch';
                    li.style.padding = '0.75rem';
                    li.style.gap = '8px';

                    const details = entry.details || {};
                    const components = [];
                    if (details.oil) components.push('Aceite');
                    if (details.filterOil) components.push('F. Aceite');
                    if (details.filterAir) components.push('F. Aire');
                    if (details.filterCabin) components.push('F. Habitáculo');

                    li.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:600; margin-bottom: 0.25rem;">
                            <span>${entry.km.toLocaleString('es-AR')} km</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">${this.formatDate(entry.date)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.8rem; color:var(--text-secondary);">Cambio: ${components.join(', ') || 'Ninguno'}</span>
                            <button class="btn-delete-maint" data-id="${entry.id}" style="border:none; background:transparent; cursor:pointer;" title="Eliminar registro">❌</button>
                        </div>
                    `;

                    li.querySelector('.btn-delete-maint').addEventListener('click', (e) => {
                        this.deleteMaintenance(e.currentTarget.dataset.id);
                    });

                    ul.appendChild(li);
                });
                this.oilHistoryLog.appendChild(ul);
            } else {
                this.oilHistoryLog.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; padding: 1rem 0;">No hay servicios de aceite registrados.</p>';
            }
        }

        if (this.tiresHistoryLog) {
            this.tiresHistoryLog.innerHTML = '';
            const tiresEntries = this.maintenanceLog.filter(m => m.type !== 'Aceite y Filtros');
            if (tiresEntries.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'history-list';
                ul.style.paddingLeft = '0';
                ul.style.listStyle = 'none';

                tiresEntries.forEach(entry => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.flexDirection = 'column';
                    li.style.alignItems = 'stretch';
                    li.style.padding = '0.75rem';
                    li.style.gap = '8px';

                    let extraDetails = '';
                    if (entry.type === 'Reemplazo de Neumáticos' && entry.details && entry.details.position) {
                        extraDetails = ` (${entry.details.position})`;
                    }

                    li.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:600; margin-bottom: 0.25rem;">
                            <span>${entry.type}${extraDetails}</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">${this.formatDate(entry.date)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.8rem; color:var(--text-secondary);">A los ${entry.km.toLocaleString('es-AR')} km</span>
                            <button class="btn-delete-maint" data-id="${entry.id}" style="border:none; background:transparent; cursor:pointer;" title="Eliminar registro">❌</button>
                        </div>
                    `;

                    li.querySelector('.btn-delete-maint').addEventListener('click', (e) => {
                        this.deleteMaintenance(e.currentTarget.dataset.id);
                    });

                    ul.appendChild(li);
                });
                this.tiresHistoryLog.appendChild(ul);
            } else {
                this.tiresHistoryLog.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; padding: 1rem 0;">No hay historial mecánico de ruedas registrado.</p>';
            }
        }
    }
}
