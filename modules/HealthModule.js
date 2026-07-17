import { DateUtils, getLocalISODate } from '../utils.js';

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
        this.attachedFileData = null;
        this.attachedFileName = null;

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
            if (file) {
                // If logged in, skip the local 1.5MB constraint (only apply 15MB limit)
                const isLoggedIn = this.controller.auth && this.controller.auth.user;
                const maxSize = isLoggedIn ? 15 * 1024 * 1024 : 1.5 * 1024 * 1024;
                if (file.size > maxSize) {
                    if (isLoggedIn) {
                        alert('El archivo es demasiado grande (máximo 15MB para subidas a la nube).');
                    } else {
                        alert('El archivo es demasiado grande (máximo 1.5MB en modo offline para evitar saturar el navegador). Inicia sesión para subir archivos de hasta 15MB.');
                    }
                    this.bloodFormFile.value = '';
                    this.attachedFileData = null;
                    this.attachedFileName = null;
                    this.attachedFile = null;
                    if (this.bloodFormFileName) {
                        this.bloodFormFileName.classList.add('hidden');
                        this.bloodFormFileName.innerText = '';
                    }
                    return;
                }

                this.attachedFile = file;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.attachedFileData = event.target.result;
                    this.attachedFileName = file.name;
                    if (this.bloodFormFileName) {
                        this.bloodFormFileName.classList.remove('hidden');
                        this.bloodFormFileName.innerHTML = `<i class="ph ph-file-pdf"></i> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                    }
                };
                reader.readAsDataURL(file);
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
        if (this.bloodFormFile) this.bloodFormFile.value = '';
        if (this.bloodFormFileName) {
            this.bloodFormFileName.classList.add('hidden');
            this.bloodFormFileName.innerText = '';
        }
        this.attachedFileData = null;
        this.attachedFileName = null;
        this.attachedFile = null;
    }

    async saveBloodTestEntry() {
        const dateVal = this.bloodFormDate?.value;
        if (!dateVal) {
            alert('Por favor selecciona la fecha del estudio.');
            return;
        }
        
        const entry = {
            id: 'blood_' + Date.now(),
            date: dateVal,
            portalUrl: this.bloodFormPortal?.value || '',
            fileName: this.attachedFileName || null,
            fileData: this.attachedFileData || null
        };

        // If authenticated and file is attached, upload to Supabase Storage
        if (this.controller.auth && this.controller.auth.user && this.attachedFile) {
            try {
                this.controller.auth.updateSyncBadge('syncing', "Subiendo archivo...");
                const publicUrl = await this.controller.auth.uploadFile(entry.id, this.attachedFile);
                entry.fileData = publicUrl;
                entry.isCloudFile = true;
            } catch (err) {
                console.error("Error uploading file to storage:", err);
                alert("Error al subir archivo a la nube. Se guardará de forma local temporalmente.");
            }
        }

        this.bloodTests.push(entry);
        this.bloodTests.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.saveBloodTests();
        this.clearBloodForm();
        this.render();
    }

    deleteBloodTest(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este registro de análisis de sangre?')) {
            this.bloodTests = this.bloodTests.filter(t => t.id !== id);
            this.saveBloodTests();
            this.render();
        }
    }

    calculateDaysElapsed(dateStr) {
        return DateUtils.getDaysElapsed(dateStr);
    }

    formatDate(dateStr) {
        return DateUtils.formatInputDate(dateStr);
    }

    addMonths(date, months) {
        const d = new Date(date);
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
    }

    renderMedicalCards() {
        if (!this.gridContainer) return;
        this.gridContainer.innerHTML = '';

        Object.keys(this.medicalData).forEach(key => {
            const doc = this.medicalData[key];
            const name = key.charAt(0).toUpperCase() + key.slice(1);
            const daysElapsed = this.calculateDaysElapsed(doc.lastVisit);
            
            const frequencyDays = doc.frequencyMonths * 30.5;
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
            const lastVisitDisplay = this.formatDate(doc.lastVisit);
            
            let nextVisitDisplay = 'N/A';
            if (doc.lastVisit) {
                const nextDateObj = this.addMonths(doc.lastVisit, doc.frequencyMonths);
                const yyyy = nextDateObj.getFullYear();
                const mm = String(nextDateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(nextDateObj.getDate()).padStart(2, '0');
                nextVisitDisplay = `${dd}/${mm}/${yyyy}`;
            }

            const card = document.createElement('div');
            card.className = 'card';
            if (daysElapsed !== null) {
                card.style.borderColor = statusColor;
            }
            
            let historyHtml = '';
            if (doc.history && doc.history.length > 0) {
                historyHtml = doc.history.map((dateStr, idx) => `
                    <li style="font-size: 0.85rem; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0, 0, 0, 0.15); border-radius: var(--border-radius-sm);">
                        <span>${this.formatDate(dateStr)}</span>
                        <button class="btn-delete-visit-history" data-key="${key}" data-index="${idx}" title="Borrar registro" style="border:none; background:transparent; cursor:pointer;">❌</button>
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
                    <button class="btn-edit-retro-medical" data-key="${key}" title="Editar fecha de última visita" style="background:transparent; border:none; cursor:pointer; color:var(--text-secondary);">
                        <i class="ph ph-pencil-simple" style="font-size: 1.2rem;"></i>
                    </button>
                </div>
                
                <div class="card-body" style="padding: 0;">
                    <div class="frequency-control">
                        <i class="ph ph-calendar-blank"></i>
                        <span>Frecuencia:</span>
                        <input type="number" class="frequency-input" data-key="${key}" value="${doc.frequencyMonths}" min="1" max="60">
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

                    <button class="btn btn-record btn-quick-visit" data-key="${key}" style="width: 100%;">✓ Registrar Visita Hoy</button>
                    
                    <button class="btn btn-history btn-toggle-visit-history" style="margin-top: 0.5rem; width:100%;">Ver Historial</button>
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
                const nextDate = new Date(lastTest.date);
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                const yyyy = nextDate.getFullYear();
                const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
                const dd = String(nextDate.getDate()).padStart(2, '0');
                this.bloodNextDate.innerText = `${dd}/${mm}/${yyyy}`;
            } else {
                this.bloodNextDate.innerText = 'N/A';
            }
        }

        // Render list
        if (this.bloodList) {
            this.bloodList.innerHTML = '';
            if (this.bloodTests.length > 0) {
                this.bloodTests.forEach(test => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.justifyContent = 'space-between';
                    li.style.alignItems = 'center';
                    li.style.gap = '15px';
                    li.style.padding = '0.75rem 1rem';

                    let linksHtml = '';
                    if (test.fileData) {
                        const target = test.isCloudFile ? 'target="_blank"' : `download="${test.fileName || 'analisis.pdf'}"`;
                        linksHtml += `<a href="${test.fileData}" ${target} class="btn-text" style="color: var(--primary-color); display:flex; align-items:center; gap:0.25rem;" title="${test.fileName || 'PDF'}"><i class="ph ph-file-pdf"></i> PDF</a>`;
                    } else if (test.pdfUrl) {
                        linksHtml += `<a href="${test.pdfUrl}" target="_blank" class="btn-text" style="color: var(--primary-color); display:flex; align-items:center; gap:0.25rem;"><i class="ph ph-file-pdf"></i> PDF</a>`;
                    }
                    if (test.portalUrl) {
                        linksHtml += `<a href="${test.portalUrl}" target="_blank" class="btn-text" style="color: var(--primary-color); display:flex; align-items:center; gap:0.25rem;"><i class="ph ph-globe"></i> Web</a>`;
                    }

                    li.innerHTML = `
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="hist-date">${this.formatDate(test.date)}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div style="display:flex; gap:0.50rem;">
                                ${linksHtml || '<span style="color:var(--text-secondary); font-size:0.8rem;">Sin enlaces</span>'}
                            </div>
                            <button class="btn-delete-blood" data-id="${test.id}" style="border:none; background:transparent; cursor:pointer;" title="Eliminar registro">❌</button>
                        </div>
                    `;

                    li.querySelector('.btn-delete-blood').addEventListener('click', (e) => {
                        this.deleteBloodTest(e.currentTarget.dataset.id);
                    });

                    this.bloodList.appendChild(li);
                });
            } else {
                this.bloodList.innerHTML = '<li style="justify-content:center; color:var(--text-secondary); font-size:0.85rem; padding:1rem;">No tienes análisis de sangre registrados</li>';
            }
        }
    }
}
