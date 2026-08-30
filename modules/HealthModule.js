import { DateUtils, getLocalISODate, parseDateLocal } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import {
    DEFAULT_BLOOD_STUDY_TRACKER_ID,
    getCustomTrackerState,
    isUnifiedCustomTrackerRegistry
} from '../custom-tracker-utils.mjs?v=20260829-module-delete';
import {
    RESOURCE_KEYS,
    getBloodTestResourceUsage
} from '../resource-policy.mjs?v=20260829-all-limits';
import {
    appendResourceCapacityNotice,
    checkResourceCreationCapacity
} from '../resource-limit-ui.mjs?v=20260829-all-limits';

export class HealthModule {
    constructor(controller) {
        this.controller = controller;
        this.gridContainer = document.getElementById('salud-grid-section');
        this.bloodCard = document.getElementById('blood-tests-card');
        this.bloodDaysCount = document.getElementById('blood-days-count');
        this.bloodLastDate = document.getElementById('blood-last-date');
        this.bloodNextDate = document.getElementById('blood-next-date');
        this.bloodStatusBadge = document.getElementById('blood-status-badge');
        this.bloodHistoryCount = document.getElementById('blood-history-count');
        this.bloodHistoryDisclosure = document.getElementById('blood-history-disclosure');
        
        this.btnAddBlood = document.getElementById('btn-add-blood-test');
        this.bloodForm = document.getElementById('blood-test-form');
        this.bloodFormDate = document.getElementById('blood-form-date');
        this.bloodFormPortal = document.getElementById('blood-form-portal');
        this.bloodFormCancel = document.getElementById('blood-form-cancel');
        this.bloodFormSave = document.getElementById('blood-form-save');
        this.bloodList = document.getElementById('blood-tests-list');

        // File attachment inputs
        this.bloodFormFile = document.getElementById('blood-form-file');
        this.bloodFormFileName = document.getElementById('blood-form-file-name');
        this.attachedFileName = null;
        this.attachedFile = null;
        this.activeStudyTrackerId = DEFAULT_BLOOD_STUDY_TRACKER_ID;
        this.studyDialogTrigger = null;

        // Configuración médica
        try {
            const rawMed = localStorage.getItem('health_medical_data');
            this.medicalData = rawMed ? JSON.parse(rawMed) : null;
        } catch (e) {
            console.error("Error parsing health_medical_data:", e);
        }
        this.medicalData = this.medicalData || {
            dentista: { lastVisit: null, frequencyMonths: 6, history: [] },
            oculista: { lastVisit: null, frequencyMonths: 6, history: [] }
        };

        try {
            const rawBlood = localStorage.getItem('health_blood_tests');
            this.bloodTests = rawBlood ? JSON.parse(rawBlood) : null;
        } catch (e) {
            console.error("Error parsing health_blood_tests:", e);
        }
        this.bloodTests = Array.isArray(this.bloodTests) ? this.bloodTests : [];

        this.ensureStudyDialog();
        this.init();
    }

    saveMedicalData() {
        localStorage.setItem('health_medical_data', JSON.stringify(this.medicalData));
    }

    saveBloodTests() {
        localStorage.setItem('health_blood_tests', JSON.stringify(this.bloodTests));
    }

    ensureStudyDialog() {
        if (!this.bloodCard) return;
        document.getElementById('medical-study-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'medical-study-dialog';
        dialog.className = 'custom-tracker-dialog medical-study-dialog hidden';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'medical-study-dialog-title');
        this.bloodCard.classList.add('custom-tracker-dialog-card', 'medical-study-dialog-card');
        this.bloodCard.querySelector('h3')?.setAttribute('id', 'medical-study-dialog-title');

        const header = this.bloodCard.querySelector('.health-card-header');
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'icon-btn medical-study-dialog-close';
        closeButton.dataset.medicalStudyDialogAction = 'close';
        closeButton.setAttribute('aria-label', 'Cerrar estudio médico');
        closeButton.dataset.tooltip = 'Cerrar';
        closeButton.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';
        header?.appendChild(closeButton);

        dialog.appendChild(this.bloodCard);
        document.body.appendChild(dialog);
        this.studyDialog = dialog;

        dialog.addEventListener('click', event => {
            if (
                event.target === dialog
                || event.target.closest('[data-medical-study-dialog-action="close"]')
            ) {
                this.closeStudyDialog();
            }
        });
        document.addEventListener('keydown', event => {
            if (
                event.key === 'Escape'
                && this.studyDialog
                && !this.studyDialog.classList.contains('hidden')
            ) {
                event.preventDefault();
                this.closeStudyDialog();
            }
        });
    }

    getStudyEntries(trackerId = this.activeStudyTrackerId) {
        if (!Array.isArray(this.bloodTests)) return [];
        return this.bloodTests
            .filter(entry => {
                const entryTrackerId = entry?.trackerId || DEFAULT_BLOOD_STUDY_TRACKER_ID;
                return entryTrackerId === trackerId;
            })
            .sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
    }

    async deleteStudyEntriesForTracker(trackerId) {
        return this.deleteStudyEntriesForTrackers([trackerId]);
    }

    async deleteStudyEntriesForTrackers(trackerIds) {
        const requestedIds = new Set(
            (Array.isArray(trackerIds) ? trackerIds : [])
                .map(trackerId => typeof trackerId === 'string' ? trackerId.trim() : '')
                .filter(Boolean)
        );
        if (requestedIds.size === 0) {
            return { deletedEntries: 0, deletedFiles: 0 };
        }

        const currentEntries = Array.isArray(this.bloodTests) ? this.bloodTests : [];
        const entries = currentEntries.filter(entry => {
            const entryTrackerId = entry?.trackerId || DEFAULT_BLOOD_STUDY_TRACKER_ID;
            return requestedIds.has(entryTrackerId);
        });
        const storagePaths = [...new Set(entries
            .map(entry => entry?.storagePath)
            .filter(Boolean))];

        if (storagePaths.length > 0) {
            await this.controller.auth.deleteMedicalFiles(storagePaths);
        }

        this.bloodTests = currentEntries.filter(entry => {
            const entryTrackerId = entry?.trackerId || DEFAULT_BLOOD_STUDY_TRACKER_ID;
            return !requestedIds.has(entryTrackerId);
        });
        this.saveBloodTests();
        if (requestedIds.has(this.activeStudyTrackerId)) {
            this.closeStudyDialog({ restoreFocus: false });
            this.activeStudyTrackerId = DEFAULT_BLOOD_STUDY_TRACKER_ID;
        }
        this.render();
        return {
            deletedEntries: entries.length,
            deletedFiles: storagePaths.length
        };
    }

    bindLegacyStudiesToTracker(trackerId = DEFAULT_BLOOD_STUDY_TRACKER_ID) {
        if (!this.controller.customTrackers?.getTracker?.(trackerId)) return false;
        let changed = false;
        this.bloodTests.forEach(entry => {
            if (entry && !entry.trackerId) {
                entry.trackerId = trackerId;
                changed = true;
            }
        });
        if (changed) this.saveBloodTests();
        this.syncStudyHistory(trackerId);
        return true;
    }

    syncStudyHistory(trackerId) {
        const dates = this.getStudyEntries(trackerId)
            .map(entry => {
                const date = parseDateLocal(entry.date);
                if (!date) return null;
                date.setHours(12, 0, 0, 0);
                return date.toISOString();
            })
            .filter(Boolean);
        return this.controller.customTrackers?.replaceTrackerHistory?.(
            trackerId,
            dates,
            { silent: true }
        ) === true;
    }

    openStudyForm(trackerId, trigger = null) {
        const tracker = this.controller.customTrackers?.getTracker?.(trackerId);
        if (!tracker || !this.studyDialog) return false;
        this.activeStudyTrackerId = trackerId;
        this.studyDialogTrigger = trigger instanceof HTMLElement ? trigger : null;
        const title = this.bloodCard?.querySelector('h3');
        if (title) title.textContent = tracker.name;
        this.renderBloodTestsCard();
        this.bloodHistoryDisclosure?.removeAttribute('open');
        if (this.bloodForm) this.bloodForm.classList.remove('hidden');
        this.btnAddBlood?.setAttribute('aria-expanded', 'true');
        if (this.bloodFormDate) this.bloodFormDate.value = getLocalISODate();
        this.studyDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => this.bloodFormDate?.focus());
        return true;
    }

    openStudyHistory(trackerId, trigger = null) {
        const tracker = this.controller.customTrackers?.getTracker?.(trackerId);
        if (!tracker || !this.studyDialog) return false;
        this.activeStudyTrackerId = trackerId;
        this.studyDialogTrigger = trigger instanceof HTMLElement ? trigger : null;
        const title = this.bloodCard?.querySelector('h3');
        if (title) title.textContent = tracker.name;
        this.clearBloodForm();
        this.renderBloodTestsCard();
        if (this.bloodHistoryDisclosure) this.bloodHistoryDisclosure.open = true;
        this.studyDialog.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            this.studyDialog?.querySelector('[data-medical-study-dialog-action="close"]')?.focus();
        });
        return true;
    }

    closeStudyDialog({ restoreFocus = true } = {}) {
        if (!this.studyDialog || this.studyDialog.classList.contains('hidden')) return;
        const trigger = this.studyDialogTrigger;
        this.clearBloodForm();
        this.studyDialog.classList.add('hidden');
        this.studyDialogTrigger = null;
        document.body.classList.remove('modal-open');
        if (restoreFocus) requestAnimationFrame(() => trigger?.focus?.());
    }

    init() {
        // Carga formulario análisis
        this.btnAddBlood?.addEventListener('click', () => {
            if (this.bloodForm) this.bloodForm.classList.remove('hidden');
            this.btnAddBlood.setAttribute('aria-expanded', 'true');
            if (this.bloodFormDate) {
                this.bloodFormDate.value = getLocalISODate();
                requestAnimationFrame(() => this.bloodFormDate.focus());
            }
        });

        // File listener
        this.bloodFormFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                this.resetAttachedFile();
                return;
            }

            if (!this.isAllowedMedicalFile(file)) {
                void this.controller.showMessage({
                    title: 'Formato no permitido',
                    message: 'Solo podés adjuntar archivos PDF o imágenes.',
                    tone: 'warning'
                });
                this.resetAttachedFile();
                return;
            }

            if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
                void this.controller.showMessage({
                    title: 'Archivo demasiado grande',
                    message: 'El archivo debe pesar menos de 15 MB.',
                    tone: 'warning'
                });
                this.resetAttachedFile();
                return;
            }

            this.attachedFile = file;
            this.attachedFileName = file.name;
            if (this.bloodFormFileName) {
                const icon = document.createElement('i');
                icon.className = 'ph ph-file';
                this.bloodFormFileName.replaceChildren(
                    icon,
                    document.createTextNode(` ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
                );
                this.bloodFormFileName.classList.remove('hidden');
            }
        });

        this.bloodFormCancel?.addEventListener('click', () => {
            this.clearBloodForm({ restoreFocus: true });
        });

        this.bloodFormSave?.addEventListener('click', () => {
            this.saveBloodTestEntry();
        });

        this.bloodHistoryDisclosure?.addEventListener('toggle', () => {
            this.bloodHistoryDisclosure.querySelector('summary')?.setAttribute(
                'aria-expanded',
                String(this.bloodHistoryDisclosure.open)
            );
        });

        this.render();
    }

    clearBloodForm({ restoreFocus = false } = {}) {
        if (this.bloodForm) this.bloodForm.classList.add('hidden');
        this.btnAddBlood?.setAttribute('aria-expanded', 'false');
        if (this.bloodFormDate) this.bloodFormDate.value = '';
        if (this.bloodFormPortal) this.bloodFormPortal.value = '';
        this.resetAttachedFile();
        if (restoreFocus) {
            requestAnimationFrame(() => this.btnAddBlood?.focus());
        }
    }

    resetAttachedFile() {
        if (this.bloodFormFile) this.bloodFormFile.value = '';
        if (this.bloodFormFileName) {
            this.bloodFormFileName.classList.add('hidden');
            this.bloodFormFileName.replaceChildren();
        }
        this.attachedFileName = null;
        this.attachedFile = null;
    }

    isAllowedMedicalFile(file) {
        const allowedMimeTypes = new Set([
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif'
        ]);
        return Boolean(file && allowedMimeTypes.has(file.type));
    }

    normalizeExternalUrl(value) {
        const trimmedValue = typeof value === 'string' ? value.trim() : '';
        if (!trimmedValue) return '';

        const parsedUrl = new URL(trimmedValue);
        if (parsedUrl.protocol !== 'https:') {
            throw new Error('Solo se permiten enlaces web seguros (HTTPS).');
        }

        return parsedUrl.href;
    }

    getSafeLegacyAttachmentUrl(value) {
        if (typeof value !== 'string' || !value) return '';
        if (/^data:(application\/pdf|image\/(?:png|jpe?g|webp|gif));base64,/i.test(value)) {
            return value;
        }

        try {
            return this.normalizeExternalUrl(value);
        } catch {
            return '';
        }
    }

    setBloodFormSaving(isSaving) {
        if (!this.bloodFormSave) return;
        this.bloodFormSave.disabled = isSaving;
        this.bloodFormSave.innerHTML = isSaving
            ? '<i class="ph ph-circle-notch" style="animation: spin 1s linear infinite;"></i> Guardando...'
            : 'Guardar';
    }

    async saveBloodTestEntry() {
        const dateVal = this.bloodFormDate?.value;
        if (!dateVal) {
            await this.controller.showMessage({
                title: 'Falta la fecha',
                message: 'Seleccioná la fecha del estudio.',
                tone: 'warning'
            });
            return;
        }

        let portalUrl = '';
        try {
            portalUrl = this.normalizeExternalUrl(this.bloodFormPortal?.value || '');
        } catch (error) {
            await this.controller.showMessage({
                title: 'Enlace inválido',
                message: error.message,
                tone: 'warning'
            });
            return;
        }

        if (!this.controller.auth?.user) {
            await this.controller.showMessage({
                title: 'Sesión no disponible',
                message: 'Reintentá luego de volver a iniciar sesión.',
                tone: 'warning'
            });
            return;
        }

        const attachmentCapacity = this.attachedFile
            ? checkResourceCreationCapacity({
                app: this.controller,
                resourceKey: RESOURCE_KEYS.BLOOD_TEST_FILES,
                currentCount: getBloodTestResourceUsage(this.bloodTests)[
                    RESOURCE_KEYS.BLOOD_TEST_FILES
                ]
            })
            : { allowed: true, limit: null, remaining: null };
        if (!attachmentCapacity) return;

        this.setBloodFormSaving(true);
        let uploadedPath = null;

        try {
            const entry = {
                id: 'blood_' + Date.now(),
                trackerId: this.activeStudyTrackerId,
                date: dateVal,
                portalUrl,
                fileName: this.attachedFileName || null
            };

            if (this.attachedFile) {
                this.controller.auth.updateSyncBadge('syncing', "Subiendo archivo...");
                uploadedPath = await this.controller.auth.uploadMedicalFile(
                    entry.id,
                    this.attachedFile
                );
                entry.storagePath = uploadedPath;
                entry.isCloudFile = true;
            }

            this.bloodTests.push(entry);
            this.bloodTests.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.saveBloodTests();
            this.syncStudyHistory(this.activeStudyTrackerId);
            this.clearBloodForm({ restoreFocus: true });
            this.render();
            this.controller.showToast?.(appendResourceCapacityNotice(
                'Estudio médico guardado.',
                RESOURCE_KEYS.BLOOD_TEST_FILES,
                attachmentCapacity
            ));
        } catch (error) {
            console.error("Error guardando el estudio médico:", error);
            if (uploadedPath) {
                try {
                    await this.controller.auth.deleteMedicalFile(uploadedPath);
                } catch (cleanupError) {
                    console.error('No se pudo limpiar el adjunto incompleto:', cleanupError);
                }
            }
            await this.controller.showMessage({
                title: 'No se pudo guardar el estudio',
                message: error.message,
                tone: 'danger'
            });
        } finally {
            this.setBloodFormSaving(false);
        }
    }

    async deleteBloodTest(id) {
        const test = this.bloodTests.find(item => item.id === id);
        if (!test) {
            return;
        }
        const confirmed = await this.controller.confirmAction({
            title: 'Eliminar estudio médico',
            message: 'Se eliminarán permanentemente el registro y su archivo adjunto. Esta acción no se puede deshacer.',
            tone: 'danger',
            confirmLabel: 'Eliminar estudio',
            closeOnBackdrop: false
        });
        if (!confirmed) return;

        if (test.storagePath) {
            try {
                await this.controller.auth.deleteMedicalFile(test.storagePath);
            } catch (error) {
                console.error('Error eliminando el archivo médico:', error);
                await this.controller.showMessage({
                    title: 'No se pudo eliminar el archivo',
                    message: `El registro se conservará para que puedas reintentar.\n\n${error.message}`,
                    tone: 'danger'
                });
                return;
            }
        }

        const trackerId = test.trackerId || DEFAULT_BLOOD_STUDY_TRACKER_ID;
        this.bloodTests = this.bloodTests.filter(item => item.id !== id);
        this.saveBloodTests();
        this.syncStudyHistory(trackerId);
        this.render();
    }

    calculateDaysElapsed(dateStr) {
        return DateUtils.getDaysElapsed(dateStr);
    }

    formatDate(dateStr) {
        return DateUtils.formatInputDate(dateStr);
    }

    addMonths(date, months) {
        const d = parseDateLocal(date);
        if (!d) return null;
        d.setMonth(d.getMonth() + Number(months));
        return d;
    }

    recordQuickVisit(key) {
        const today = getLocalISODate();
        this.medicalData[key].lastVisit = today;
        
        if (!this.medicalData[key].history) {
            this.medicalData[key].history = [];
        }
        this.medicalData[key].history.unshift(today);
        this.saveMedicalData();
        this.render();
    }

    deleteVisitHistory(key, index) {
        const deletedEntry = this.medicalData[key]?.history?.[index];
        if (deletedEntry === undefined) return;
        this.medicalData[key].history.splice(index, 1);
        this.medicalData[key].lastVisit = this.medicalData[key].history.length > 0
            ? this.medicalData[key].history[0]
            : null;
        this.saveMedicalData();
        this.render();
        this.controller.showUndo('Visita eliminada del historial.', () => {
            this.medicalData[key].history.splice(index, 0, deletedEntry);
            this.medicalData[key].lastVisit = this.medicalData[key].history[0] || null;
            this.saveMedicalData();
            this.render();
        });
    }

    render() {
        this.renderMedicalCards();
        this.renderBloodTestsCard();
    }

    renderMedicalCards() {
        if (!this.gridContainer) return;
        this.gridContainer.innerHTML = '';
        if (isUnifiedCustomTrackerRegistry(this.controller.customTrackers?.registry)) {
            this.controller.customTrackers.renderSection('health');
            return;
        }

        Object.keys(this.medicalData).forEach(key => {
            const doc = this.medicalData[key];
            if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return;

            const name = escapeHtml(key.charAt(0).toUpperCase() + key.slice(1));
            const safeKey = escapeHtml(key);
            const daysElapsed = this.calculateDaysElapsed(doc.lastVisit);
            
            const frequencyMonths = Math.min(60, Math.max(1, Number(doc.frequencyMonths) || 6));
            const frequencyDays = frequencyMonths * 30.5;
            let statusColor = 'var(--status-green)';
            let statusText = 'Al día';
            let shadowColor = 'var(--status-green-glow)';
            
            if (daysElapsed === null) {
                statusColor = 'var(--text-secondary)';
                statusText = 'Sin datos';
                shadowColor = 'transparent';
            } else if (daysElapsed >= frequencyDays) {
                statusColor = 'var(--status-red)';
                statusText = 'Vencido';
                shadowColor = 'var(--status-red-glow)';
            } else if (daysElapsed >= frequencyDays - 30) {
                statusColor = 'var(--status-orange)';
                statusText = 'Próximo';
                shadowColor = 'var(--status-orange-glow)';
            }

            const daysDisplay = daysElapsed !== null ? `${daysElapsed} días` : '--';
            const lastVisitDisplay = escapeHtml(this.formatDate(doc.lastVisit));
            
            let nextVisitDisplay = 'N/A';
            if (doc.lastVisit) {
                const nextDateObj = this.addMonths(doc.lastVisit, frequencyMonths);
                if (nextDateObj) {
                    const yyyy = nextDateObj.getFullYear();
                    const mm = String(nextDateObj.getMonth() + 1).padStart(2, '0');
                    const dd = String(nextDateObj.getDate()).padStart(2, '0');
                    nextVisitDisplay = `${dd}/${mm}/${yyyy}`;
                }
            }

            const card = document.createElement('div');
            card.className = 'card health-control-card health-medical-card';
            if (daysElapsed !== null) {
                card.style.borderColor = statusColor;
            }
            
            let historyHtml = '';
            if (Array.isArray(doc.history) && doc.history.length > 0) {
                historyHtml = doc.history.map((dateStr, idx) => `
                    <li style="font-size: 0.85rem; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; background: var(--surface-inset); border: 1px solid var(--border-subtle); border-radius: var(--border-radius-sm);">
                        <span>${escapeHtml(this.formatDate(dateStr))}</span>
                        <button type="button" class="btn-delete-visit-history icon-btn icon-btn-sm is-danger" data-key="${safeKey}" data-index="${idx}" data-tooltip="Borrar registro" aria-label="Borrar visita de ${name}"><i class="ph ph-trash" aria-hidden="true"></i></button>
                    </li>
                `).join('');
            } else {
                historyHtml = '<li style="font-size: 0.85rem; padding: 0.5rem; text-align: center; color: var(--text-secondary);">Sin visitas anteriores</li>';
            }

            const historyCount = Array.isArray(doc.history) ? doc.history.length : 0;
            const badgeClass = statusText === 'Al día' ? 'green' : (statusText === 'Vencido' ? 'red' : (statusText === 'Próximo' ? 'orange' : 'gray'));

            card.innerHTML = `
                <div class="card-header health-card-header">
                    <div class="health-card-heading">
                        <div class="icon-container">
                            <i class="ph ${key === 'dentista' ? 'ph-first-aid' : 'ph-eye'}"></i>
                        </div>
                        <h3 style="font-size: 1.15rem; font-weight:600; margin:0; display:flex; align-items:center; gap:8px;">
                            ${name}
                            <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 2px 6px; text-transform: uppercase;">${statusText}</span>
                        </h3>
                    </div>
                    <button type="button" class="btn-edit-retro-medical icon-btn icon-btn-sm" data-key="${safeKey}" data-tooltip="Editar fecha" aria-label="Editar fecha de ${name}">
                        <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                    </button>
                </div>
                
                <div class="card-body health-control-card-body" style="padding: 0;">
                    <div class="frequency-control">
                        <i class="ph ph-calendar-blank"></i>
                        <span>Frecuencia:</span>
                        <input type="number" class="frequency-input" data-key="${safeKey}" value="${frequencyMonths}" min="1" max="60" aria-label="Frecuencia en meses para ${name}">
                        <span>meses</span>
                    </div>

                    <div class="time-display" style="margin-bottom: 0.5rem; display: flex; align-items: baseline; gap: 0.4rem;">
                        <span class="days-count" style="color: ${statusColor}; text-shadow: 0 0 20px ${shadowColor};">${daysDisplay}</span>
                        ${daysElapsed !== null ? '<span class="days-label">desde última visita</span>' : ''}
                    </div>

                    <div class="date-info-container" style="margin-bottom: 1rem; display:flex; flex-direction:column; gap:0.4rem;">
                        <div class="date-info" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
                            <i class="ph ph-clock-counter-clockwise"></i>
                            <span>Último control: <strong>${lastVisitDisplay}</strong></span>
                        </div>
                        <div class="date-info" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
                            <i class="ph ph-calendar"></i>
                            <span>Próximo control: <strong>${nextVisitDisplay}</strong></span>
                        </div>
                    </div>

                    <button type="button" class="btn btn-record btn-quick-visit" data-key="${safeKey}" style="width: 100%;">✓ Registrar Visita Hoy</button>
                    
                    <button type="button" class="btn btn-history btn-toggle-visit-history" style="margin-top: 0.5rem; width:100%;">Ver historial (${historyCount})</button>
                    <div class="history-log hidden" style="margin-top: 0.75rem;">
                        <ul style="padding-left: 0; display:flex; flex-direction:column; gap:0.4rem; list-style:none; margin:0;">
                            ${historyHtml}
                        </ul>
                    </div>
                </div>
            `;

            // Attach event listeners
            card.querySelector('.frequency-input').addEventListener('change', (e) => {
                const k = e.target.dataset.key;
                const val = parseInt(e.target.value) || 6;
                this.medicalData[k].frequencyMonths = val;
                this.saveMedicalData();
                this.render();
            });

            card.querySelector('.btn-quick-visit').addEventListener('click', (e) => {
                const k = e.currentTarget.dataset.key;
                this.recordQuickVisit(k);
            });

            card.querySelector('.btn-toggle-visit-history').addEventListener('click', (e) => {
                const log = card.querySelector('.history-log');
                const btn = e.currentTarget;
                if (log.classList.contains('hidden')) {
                    log.classList.remove('hidden');
                    btn.innerText = `Ocultar historial (${historyCount})`;
                } else {
                    log.classList.add('hidden');
                    btn.innerText = `Ver historial (${historyCount})`;
                }
            });

            card.querySelectorAll('.btn-delete-visit-history').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const k = e.currentTarget.dataset.key;
                    const idx = parseInt(e.currentTarget.dataset.index);
                    this.deleteVisitHistory(k, idx);
                });
            });

            card.querySelector('.btn-edit-retro-medical').addEventListener('click', (e) => {
                const k = e.currentTarget.dataset.key;
                const displayName = k === 'dentista' ? 'Dentista' : 'Oculista';
                this.controller.openEditModal('medical', k, displayName, this.medicalData[k].lastVisit);
            });

            this.gridContainer.appendChild(card);
        });
    }

    createBloodTestLink({ url, iconClass, label, title, downloadName = '' }) {
        if (!url) return null;

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'btn-text';
        link.style.color = 'var(--primary-color)';
        link.style.display = 'flex';
        link.style.alignItems = 'center';
        link.style.gap = '0.25rem';
        link.title = title || label;
        if (downloadName) {
            link.download = downloadName;
        }

        const icon = document.createElement('i');
        icon.className = iconClass;
        link.append(icon, document.createTextNode(` ${label}`));
        return link;
    }

    async openPrivateMedicalFile(test, button) {
        if (!test.storagePath) return;

        const originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="ph ph-circle-notch" style="animation: spin 1s linear infinite;"></i> Abriendo...';

        const previewWindow = window.open('about:blank', '_blank');
        if (previewWindow) {
            previewWindow.opener = null;
            previewWindow.document.title = 'Abriendo archivo seguro...';
        }

        try {
            const signedUrl = await this.controller.auth.createSignedMedicalFileUrl(test.storagePath);
            if (previewWindow && !previewWindow.closed) {
                previewWindow.location.replace(signedUrl);
            } else {
                window.location.assign(signedUrl);
            }
        } catch (error) {
            if (previewWindow && !previewWindow.closed) {
                previewWindow.close();
            }
            console.error('Error abriendo el archivo médico privado:', error);
            await this.controller.showMessage({
                title: 'No se pudo abrir el archivo',
                message: error.message,
                tone: 'danger'
            });
        } finally {
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    }

    renderBloodTestsCard() {
        const trackerId = this.activeStudyTrackerId || DEFAULT_BLOOD_STUDY_TRACKER_ID;
        const tracker = this.controller.customTrackers?.getTracker?.(trackerId) || null;
        const studyEntries = this.getStudyEntries(trackerId);
        const lastTest = studyEntries[0] || null;
        const trackerHistory = tracker
            ? this.controller.customTrackers.getHistory(trackerId)
            : [];
        const state = tracker
            ? getCustomTrackerState(tracker, trackerHistory)
            : {
                elapsedDays: null,
                nextDate: null,
                status: 'new'
            };
        const statusPresentation = {
            red: {
                color: 'var(--status-red)',
                text: 'Vencido',
                tone: 'red'
            },
            orange: {
                color: 'var(--status-orange)',
                text: 'Atención',
                tone: 'orange'
            },
            yellow: {
                color: 'var(--status-yellow)',
                text: 'Próximo',
                tone: 'yellow'
            },
            green: {
                color: 'var(--status-green)',
                text: 'Al día',
                tone: 'green'
            },
            new: {
                color: 'var(--text-secondary)',
                text: 'Sin datos',
                tone: 'gray'
            }
        }[state.status] || {
            color: 'var(--text-secondary)',
            text: 'Sin datos',
            tone: 'gray'
        };

        if (this.bloodCard) {
            this.bloodCard.style.borderColor = state.elapsedDays !== null
                ? statusPresentation.color
                : 'var(--surface-border)';
            this.bloodCard.dataset.tone = statusPresentation.tone;
        }
        if (this.bloodStatusBadge) {
            this.bloodStatusBadge.className = `badge ${statusPresentation.tone}`;
            this.bloodStatusBadge.textContent = statusPresentation.text;
        }
        if (this.bloodHistoryCount) {
            this.bloodHistoryCount.textContent = String(studyEntries.length);
        }

        if (this.bloodDaysCount) {
            this.bloodDaysCount.innerText = state.elapsedDays !== null ? state.elapsedDays : '--';
            this.bloodDaysCount.style.color = state.elapsedDays !== null
                ? statusPresentation.color
                : 'var(--primary-color)';
        }
        if (this.bloodLastDate) {
            this.bloodLastDate.innerText = this.formatDate(lastTest?.date);
        }
        if (this.bloodNextDate) {
            this.bloodNextDate.innerText = state.nextDate
                ? DateUtils.formatFriendlyDate(state.nextDate, 'N/A')
                : 'Después del primer registro';
        }

        // Render list
        if (this.bloodList) {
            this.bloodList.replaceChildren();
            if (studyEntries.length > 0) {
                studyEntries.forEach(test => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.justifyContent = 'space-between';
                    li.style.alignItems = 'center';
                    li.style.gap = '15px';
                    li.style.padding = '0.75rem 1rem';
                    li.style.flexWrap = 'wrap';

                    const dateContainer = document.createElement('div');
                    dateContainer.style.display = 'flex';
                    dateContainer.style.alignItems = 'center';
                    dateContainer.style.gap = '0.5rem';

                    const date = document.createElement('span');
                    date.className = 'hist-date';
                    date.textContent = this.formatDate(test.date);
                    dateContainer.appendChild(date);

                    const actionsContainer = document.createElement('div');
                    actionsContainer.style.display = 'flex';
                    actionsContainer.style.alignItems = 'center';
                    actionsContainer.style.gap = '1rem';
                    actionsContainer.style.flexWrap = 'wrap';
                    actionsContainer.style.justifyContent = 'flex-end';
                    actionsContainer.style.marginLeft = 'auto';

                    const linksContainer = document.createElement('div');
                    linksContainer.style.display = 'flex';
                    linksContainer.style.gap = '0.5rem';
                    linksContainer.style.flexWrap = 'wrap';

                    if (test.storagePath) {
                        const privateFileButton = document.createElement('button');
                        privateFileButton.type = 'button';
                        privateFileButton.className = 'btn-text';
                        privateFileButton.style.color = 'var(--primary-color)';
                        privateFileButton.style.display = 'flex';
                        privateFileButton.style.alignItems = 'center';
                        privateFileButton.style.gap = '0.25rem';
                        privateFileButton.title = test.fileName || 'Abrir archivo médico';
                        privateFileButton.innerHTML = '<i class="ph ph-lock-key"></i> Archivo';
                        privateFileButton.addEventListener('click', () => {
                            this.openPrivateMedicalFile(test, privateFileButton);
                        });
                        linksContainer.appendChild(privateFileButton);
                    } else {
                        const legacyFileUrl = this.getSafeLegacyAttachmentUrl(test.fileData || test.pdfUrl);
                        const legacyFileLink = this.createBloodTestLink({
                            url: legacyFileUrl,
                            iconClass: 'ph ph-file',
                            label: 'Archivo',
                            title: test.fileName || 'Archivo del estudio',
                            downloadName: legacyFileUrl.startsWith('data:')
                                ? (test.fileName || 'analisis')
                                : ''
                        });
                        if (legacyFileLink) {
                            linksContainer.appendChild(legacyFileLink);
                        }
                    }

                    let safePortalUrl = '';
                    try {
                        safePortalUrl = this.normalizeExternalUrl(test.portalUrl);
                    } catch {
                        safePortalUrl = '';
                    }

                    const portalLink = this.createBloodTestLink({
                        url: safePortalUrl,
                        iconClass: 'ph ph-globe',
                        label: 'Web',
                        title: 'Abrir portal del laboratorio'
                    });
                    if (portalLink) {
                        linksContainer.appendChild(portalLink);
                    }

                    if (linksContainer.childElementCount === 0) {
                        const emptyLinks = document.createElement('span');
                        emptyLinks.style.color = 'var(--text-secondary)';
                        emptyLinks.style.fontSize = '0.8rem';
                        emptyLinks.textContent = 'Sin enlaces';
                        linksContainer.appendChild(emptyLinks);
                    }

                    const deleteButton = document.createElement('button');
                    deleteButton.type = 'button';
                    deleteButton.className = 'btn-delete-blood icon-btn icon-btn-sm is-danger';
                    deleteButton.dataset.tooltip = 'Eliminar registro';
                    deleteButton.setAttribute('aria-label', 'Eliminar estudio médico');
                    deleteButton.innerHTML = '<i class="ph ph-trash" aria-hidden="true"></i>';
                    deleteButton.addEventListener('click', async () => {
                        deleteButton.disabled = true;
                        await this.deleteBloodTest(test.id);
                        deleteButton.disabled = false;
                    });

                    actionsContainer.append(linksContainer, deleteButton);
                    li.append(dateContainer, actionsContainer);
                    this.bloodList.appendChild(li);
                });
            } else {
                const emptyState = document.createElement('li');
                emptyState.style.justifyContent = 'center';
                emptyState.style.color = 'var(--text-secondary)';
                emptyState.style.fontSize = '0.85rem';
                emptyState.style.padding = '1rem';
                emptyState.textContent = 'No tenés estudios registrados en esta tarjeta';
                this.bloodList.appendChild(emptyState);
            }
        }
    }
}
