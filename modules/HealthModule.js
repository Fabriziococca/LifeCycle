import { DateUtils, getLocalISODate, parseDateLocal } from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

export class HealthModule {
    constructor(controller) {
        this.controller = controller;
        this.gridContainer = document.getElementById('salud-grid-section');
        this.bloodDaysCount = document.getElementById('blood-days-count');
        this.bloodLastDate = document.getElementById('blood-last-date');
        this.bloodNextDate = document.getElementById('blood-next-date');
        
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
        this.bloodTests = this.bloodTests || [];

        this.init();
    }

    saveMedicalData() {
        localStorage.setItem('health_medical_data', JSON.stringify(this.medicalData));
    }

    saveBloodTests() {
        localStorage.setItem('health_blood_tests', JSON.stringify(this.bloodTests));
    }

    init() {
        // Carga formulario análisis
        this.btnAddBlood?.addEventListener('click', () => {
            if (this.bloodForm) this.bloodForm.classList.remove('hidden');
            if (this.bloodFormDate) {
                this.bloodFormDate.value = getLocalISODate();
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
                alert('Solo podés adjuntar archivos PDF o imágenes.');
                this.resetAttachedFile();
                return;
            }

            if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
                alert('El archivo debe pesar menos de 15 MB.');
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
            this.clearBloodForm();
        });

        this.bloodFormSave?.addEventListener('click', () => {
            this.saveBloodTestEntry();
        });

        this.render();
    }

    clearBloodForm() {
        if (this.bloodForm) this.bloodForm.classList.add('hidden');
        if (this.bloodFormDate) this.bloodFormDate.value = '';
        if (this.bloodFormPortal) this.bloodFormPortal.value = '';
        this.resetAttachedFile();
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
            alert('Por favor selecciona la fecha del estudio.');
            return;
        }

        let portalUrl = '';
        try {
            portalUrl = this.normalizeExternalUrl(this.bloodFormPortal?.value || '');
        } catch (error) {
            alert(error.message);
            return;
        }

        if (!this.controller.auth?.user) {
            alert('Tu sesión no está disponible. Reintentá luego de volver a iniciar sesión.');
            return;
        }

        this.setBloodFormSaving(true);

        try {
            const entry = {
                id: 'blood_' + Date.now(),
                date: dateVal,
                portalUrl,
                fileName: this.attachedFileName || null
            };

            if (this.attachedFile) {
                this.controller.auth.updateSyncBadge('syncing', "Subiendo archivo...");
                entry.storagePath = await this.controller.auth.uploadMedicalFile(entry.id, this.attachedFile);
                entry.isCloudFile = true;
            }

            this.bloodTests.push(entry);
            this.bloodTests.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.saveBloodTests();
            this.clearBloodForm();
            this.render();
        } catch (error) {
            console.error("Error guardando el análisis de sangre:", error);
            alert(`No se pudo guardar el estudio: ${error.message}`);
        } finally {
            this.setBloodFormSaving(false);
        }
    }

    async deleteBloodTest(id) {
        const test = this.bloodTests.find(item => item.id === id);
        if (!test || !confirm('¿Estás seguro de que querés eliminar este registro y su archivo adjunto?')) {
            return;
        }

        if (test.storagePath) {
            try {
                await this.controller.auth.deleteMedicalFile(test.storagePath);
            } catch (error) {
                console.error('Error eliminando el archivo médico:', error);
                alert(`No se pudo eliminar el archivo de la nube. El registro se conservará para que puedas reintentar: ${error.message}`);
                return;
            }
        }

        this.bloodTests = this.bloodTests.filter(item => item.id !== id);
        this.saveBloodTests();
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
        if (confirm('¿Seguro que quieres borrar este registro de visita?')) {
            this.medicalData[key].history.splice(index, 1);
            this.medicalData[key].lastVisit = this.medicalData[key].history.length > 0 
                ? this.medicalData[key].history[0] 
                : null;
            this.saveMedicalData();
            this.render();
        }
    }

    render() {
        this.renderMedicalCards();
        this.renderBloodTestsCard();
        // renderMedicalCards reemplaza la grilla de controles.
        this.controller.customTrackers?.renderSection('health');
    }

    renderMedicalCards() {
        if (!this.gridContainer) return;
        this.gridContainer.innerHTML = '';

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
            card.className = 'card';
            if (daysElapsed !== null) {
                card.style.borderColor = statusColor;
            }
            
            let historyHtml = '';
            if (Array.isArray(doc.history) && doc.history.length > 0) {
                historyHtml = doc.history.map((dateStr, idx) => `
                    <li style="font-size: 0.85rem; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0, 0, 0, 0.15); border-radius: var(--border-radius-sm);">
                        <span>${escapeHtml(this.formatDate(dateStr))}</span>
                        <button type="button" class="btn-delete-visit-history" data-key="${safeKey}" data-index="${idx}" title="Borrar registro" aria-label="Borrar visita de ${name}" style="border:none; background:transparent; cursor:pointer;">❌</button>
                    </li>
                `).join('');
            } else {
                historyHtml = '<li style="font-size: 0.85rem; padding: 0.5rem; text-align: center; color: var(--text-secondary);">Sin visitas anteriores</li>';
            }

            const badgeClass = statusText === 'Al día' ? 'green' : (statusText === 'Vencido' ? 'red' : (statusText === 'Próximo' ? 'orange' : ''));

            card.innerHTML = `
                <div class="card-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="icon-container">
                            <i class="ph ${key === 'dentista' ? 'ph-first-aid' : 'ph-eye'}"></i>
                        </div>
                        <h3 style="font-size: 1.15rem; font-weight:600; margin:0; display:flex; align-items:center; gap:8px;">
                            ${name}
                            <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 2px 6px; text-transform: uppercase;">${statusText}</span>
                        </h3>
                    </div>
                    <button type="button" class="btn-edit-retro-medical" data-key="${safeKey}" title="Editar fecha de última visita" aria-label="Editar fecha de ${name}" style="background:transparent; border:none; cursor:pointer; color:var(--text-secondary);">
                        <i class="ph ph-pencil-simple" style="font-size: 1.2rem;"></i>
                    </button>
                </div>
                
                <div class="card-body" style="padding: 0;">
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
                    
                    <button type="button" class="btn btn-history btn-toggle-visit-history" style="margin-top: 0.5rem; width:100%;">Ver Historial</button>
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
                    btn.innerText = 'Ocultar Historial';
                } else {
                    log.classList.add('hidden');
                    btn.innerText = 'Ver Historial';
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
            alert(`No se pudo abrir el archivo: ${error.message}`);
        } finally {
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    }

    renderBloodTestsCard() {
        const lastTest = this.bloodTests[0];
        const daysElapsed = this.calculateDaysElapsed(lastTest?.date);
        const elCard = document.getElementById('blood-tests-card');

        let statusColor = 'var(--text-secondary)';
        if (daysElapsed !== null) {
            if (daysElapsed >= 365) statusColor = 'var(--status-red)';
            else if (daysElapsed >= 330) statusColor = 'var(--status-orange)';
            else if (daysElapsed >= 270) statusColor = 'var(--status-yellow)';
            else statusColor = 'var(--status-green)';
        }

        if (elCard) {
            elCard.style.borderColor = daysElapsed !== null ? statusColor : 'var(--surface-border)';
        }

        if (this.bloodDaysCount) {
            this.bloodDaysCount.innerText = daysElapsed !== null ? daysElapsed : '--';
            this.bloodDaysCount.style.color = daysElapsed !== null ? statusColor : 'var(--primary-color)';
        }
        if (this.bloodLastDate) {
            this.bloodLastDate.innerText = this.formatDate(lastTest?.date);
        }
        if (this.bloodNextDate) {
            if (lastTest?.date) {
                const nextDate = parseDateLocal(lastTest.date);
                if (nextDate) {
                    nextDate.setFullYear(nextDate.getFullYear() + 1);
                    const yyyy = nextDate.getFullYear();
                    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(nextDate.getDate()).padStart(2, '0');
                    this.bloodNextDate.innerText = `${dd}/${mm}/${yyyy}`;
                } else {
                    this.bloodNextDate.innerText = 'N/A';
                }
            } else {
                this.bloodNextDate.innerText = 'N/A';
            }
        }

        // Render list
        if (this.bloodList) {
            this.bloodList.replaceChildren();
            if (this.bloodTests.length > 0) {
                this.bloodTests.forEach(test => {
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
                    deleteButton.className = 'btn-delete-blood';
                    deleteButton.style.border = 'none';
                    deleteButton.style.background = 'transparent';
                    deleteButton.style.cursor = 'pointer';
                    deleteButton.title = 'Eliminar registro';
                    deleteButton.textContent = '❌';
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
                emptyState.textContent = 'No tenés análisis de sangre registrados';
                this.bloodList.appendChild(emptyState);
            }
        }
    }
}
