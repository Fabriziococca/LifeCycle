/**
 * TranscriptionsModule.js
 * Módulo de grabación, importación, transcripción y resumen de notas de voz.
 * Fase E (Tandas 19 a 25).
 */

import {
    TRANSCRIPTION_STORAGE_KEY,
    normalizeTranscription,
    normalizeTranscriptionRegistry,
    searchTranscriptions,
    exportAsPlainText,
    exportAsMarkdown,
    formatDuration
} from '../transcription-utils.mjs';

import { TRANSCRIPTION_PRIVACY_NOTICE, AUDIO_CONSTRAINTS } from '../audio-transcription-config.mjs';
import { AudioRecorder } from '../audio-recorder.mjs';
import { validateAudioFile, blobToBase64 } from '../audio-importer.mjs';
import { transcribeAudio, generateSummary } from '../transcription-service.mjs';

export class TranscriptionsModule {
    constructor(app) {
        this.app = app;
        this.registry = normalizeTranscriptionRegistry(null);
        this.activeFolderId = 'all';
        this.searchQuery = '';
        this.activeTranscriptionId = null;
        this.recorder = new AudioRecorder();
        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
    }

    loadData() {
        try {
            const raw = localStorage.getItem(TRANSCRIPTION_STORAGE_KEY);
            this.registry = normalizeTranscriptionRegistry(raw ? JSON.parse(raw) : null);
        } catch (e) {
            console.error('[TranscriptionsModule] Error al cargar transcripciones:', e);
            this.registry = normalizeTranscriptionRegistry(null);
        }
    }

    saveData() {
        localStorage.setItem(TRANSCRIPTION_STORAGE_KEY, JSON.stringify(this.registry));
    }

    bindEvents() {
        // Botón iniciar / detener grabación
        const recordBtn = document.getElementById('btn-toggle-record-voice');
        if (recordBtn && !recordBtn.dataset.bound) {
            recordBtn.dataset.bound = 'true';
            recordBtn.addEventListener('click', () => this.handleToggleRecord());
        }

        // Botón importar archivo de audio
        const importBtn = document.getElementById('btn-import-audio-file');
        const fileInput = document.getElementById('transcription-file-input');
        if (importBtn && fileInput && !importBtn.dataset.bound) {
            importBtn.dataset.bound = 'true';
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileSelected(e));
        }

        // Búsqueda en vivo
        const searchInput = document.getElementById('transcription-search-input');
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = 'true';
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderList();
            });
        }

        // Cerrar modal de detalle
        const closeButtons = document.querySelectorAll('[data-transcription-modal-close]');
        closeButtons.forEach(btn => {
            if (!btn.dataset.bound) {
                btn.dataset.bound = 'true';
                btn.addEventListener('click', () => this.closeDetailModal());
            }
        });

        // Guardar cambios en el modal
        const saveBtn = document.getElementById('btn-save-transcription-detail');
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = 'true';
            saveBtn.addEventListener('click', () => this.saveActiveTranscriptionChanges());
        }

        // Botón generar resumen IA en el modal
        const summaryBtn = document.getElementById('btn-generate-ai-summary');
        if (summaryBtn && !summaryBtn.dataset.bound) {
            summaryBtn.dataset.bound = 'true';
            summaryBtn.addEventListener('click', () => this.requestAiSummary());
        }

        // Botones de exportar
        const exportTxtBtn = document.getElementById('btn-export-transcription-txt');
        if (exportTxtBtn && !exportTxtBtn.dataset.bound) {
            exportTxtBtn.dataset.bound = 'true';
            exportTxtBtn.addEventListener('click', () => this.downloadExport('txt'));
        }

        const exportMdBtn = document.getElementById('btn-export-transcription-md');
        if (exportMdBtn && !exportMdBtn.dataset.bound) {
            exportMdBtn.dataset.bound = 'true';
            exportMdBtn.addEventListener('click', () => this.downloadExport('md'));
        }
    }

    async ensurePrivacyConsent() {
        const hasConsent = localStorage.getItem(TRANSCRIPTION_PRIVACY_NOTICE.consentStorageKey);
        if (hasConsent === 'true') return true;

        const confirmed = await this.app.confirmAction?.({
            title: TRANSCRIPTION_PRIVACY_NOTICE.title,
            message: TRANSCRIPTION_PRIVACY_NOTICE.text,
            confirmLabel: 'Acepto y deseo continuar',
            cancelLabel: 'Cancelar',
            tone: 'primary'
        });

        if (confirmed) {
            localStorage.setItem(TRANSCRIPTION_PRIVACY_NOTICE.consentStorageKey, 'true');
            return true;
        }
        return false;
    }

    async handleToggleRecord() {
        if (this.recorder.state === 'recording') {
            await this.stopAndProcessRecording();
        } else {
            const consentGranted = await this.ensurePrivacyConsent();
            if (!consentGranted) return;

            try {
                const timerEl = document.getElementById('recording-timer');
                const pulseEl = document.getElementById('recording-pulse');
                const btnEl = document.getElementById('btn-toggle-record-voice');

                await this.recorder.start({
                    onTick: (seconds) => {
                        if (timerEl) timerEl.textContent = formatDuration(seconds);
                    }
                });

                if (pulseEl) pulseEl.classList.remove('hidden');
                if (btnEl) {
                    btnEl.innerHTML = '<i class="ph ph-stop-circle" style="color: #ef4444;"></i> Detener y Transcribir';
                    btnEl.classList.add('recording-active');
                }
                this.app.showToast?.('Grabando nota de voz... La pantalla permanecerá encendida.');
            } catch (err) {
                this.app.showToast?.(`No se pudo iniciar la grabación: ${err.message}`);
            }
        }
    }

    async stopAndProcessRecording() {
        const timerEl = document.getElementById('recording-timer');
        const pulseEl = document.getElementById('recording-pulse');
        const btnEl = document.getElementById('btn-toggle-record-voice');

        if (pulseEl) pulseEl.classList.add('hidden');
        if (timerEl) timerEl.textContent = '00:00';
        if (btnEl) {
            btnEl.innerHTML = '<i class="ph ph-microphone"></i> Grabar Nota de Voz';
            btnEl.classList.remove('recording-active');
        }

        const result = await this.recorder.stop();
        if (!result || !result.blob || result.sizeBytes === 0) {
            this.app.showToast?.('La grabación no generó contenido.');
            return;
        }

        this.app.showToast?.('Procesando audio con Gemini gratuito...');

        try {
            const base64 = await blobToBase64(result.blob);
            const transcriptionResult = await transcribeAudio({
                audioBase64: base64,
                mimeType: result.mimeType
            });

            if (!transcriptionResult.success) {
                // Guardar como fallida pero no perder el registro
                this.addTranscriptionRecord({
                    title: `Nota de voz (${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })})`,
                    durationSeconds: result.durationSeconds,
                    sizeBytes: result.sizeBytes,
                    mimeType: result.mimeType,
                    status: 'failed',
                    rawText: `[Error al transcribir]: ${transcriptionResult.error}`
                });
                this.app.showToast?.(transcriptionResult.error || 'Fallo en la transcripción.');
                return;
            }

            this.addTranscriptionRecord({
                title: `Nota de voz (${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })})`,
                durationSeconds: result.durationSeconds,
                sizeBytes: result.sizeBytes,
                mimeType: result.mimeType,
                status: 'completed',
                rawText: transcriptionResult.text
            });

            this.app.showToast?.('¡Nota de voz transcripta con éxito!');
        } catch (err) {
            this.app.showToast?.(`Error al procesar audio: ${err.message}`);
        }
    }

    async handleFileSelected(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const validation = validateAudioFile(file);
        if (!validation.valid) {
            this.app.showToast?.(validation.error);
            event.target.value = '';
            return;
        }

        const consentGranted = await this.ensurePrivacyConsent();
        if (!consentGranted) {
            event.target.value = '';
            return;
        }

        this.app.showToast?.(`Importando y transcribiendo "${file.name}"...`);

        try {
            const base64 = await blobToBase64(file);
            const result = await transcribeAudio({
                audioBase64: base64,
                mimeType: file.type || 'audio/webm'
            });

            if (!result.success) {
                this.app.showToast?.(result.error || 'Error al transcribir archivo importado.');
                return;
            }

            const cleanName = file.name.replace(/\.[^/.]+$/, '');
            this.addTranscriptionRecord({
                title: cleanName,
                durationSeconds: 0,
                sizeBytes: file.size,
                mimeType: file.type || 'audio/webm',
                status: 'completed',
                rawText: result.text
            });

            this.app.showToast?.(`Archivo "${cleanName}" transcripto con éxito.`);
        } catch (err) {
            this.app.showToast?.(`Error: ${err.message}`);
        } finally {
            event.target.value = '';
        }
    }

    addTranscriptionRecord(data) {
        const item = normalizeTranscription({
            ...data,
            folderId: this.activeFolderId === 'all' ? 'folder_general' : this.activeFolderId
        });

        this.registry.transcriptions.unshift(item);
        this.saveData();
        this.render();
    }

    render() {
        this.renderFolders();
        this.renderList();
    }

    renderFolders() {
        const tabsRoot = document.getElementById('transcriptions-folder-tabs');
        if (!tabsRoot) return;

        const allActive = this.activeFolderId === 'all' ? 'active' : '';
        let html = `<button type="button" class="tab-btn ${allActive}" data-transcription-folder="all">Todas</button>`;

        this.registry.folders.forEach(f => {
            const active = this.activeFolderId === f.id ? 'active' : '';
            html += `<button type="button" class="tab-btn ${active}" data-transcription-folder="${f.id}"><i class="ph ${f.icon}"></i> ${f.name}</button>`;
        });

        tabsRoot.innerHTML = html;

        tabsRoot.querySelectorAll('[data-transcription-folder]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeFolderId = btn.dataset.transcriptionFolder;
                this.render();
            });
        });
    }

    getFilteredItems() {
        let items = this.registry.transcriptions;
        if (this.activeFolderId !== 'all') {
            items = items.filter(t => t.folderId === this.activeFolderId);
        }
        if (this.searchQuery) {
            items = searchTranscriptions(items, this.searchQuery);
        }
        return items;
    }

    renderList() {
        const container = document.getElementById('transcriptions-list');
        if (!container) return;

        const items = this.getFilteredItems();
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary); grid-column: 1 / -1;">
                    <i class="ph ph-waveform" style="font-size: 2.5rem; opacity: 0.6; display: block; margin-bottom: 0.75rem;"></i>
                    <p>No hay transcripciones en esta carpeta o búsqueda.</p>
                    <p style="font-size: 0.85rem;">Tocá "Grabar Nota de Voz" o importá un audio para comenzar.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => {
            const textToDisplay = item.editedText || item.rawText;
            const snippet = textToDisplay.length > 140
                ? textToDisplay.slice(0, 140) + '...'
                : (textToDisplay || '(Sin contenido)');
            const dateStr = new Date(item.createdAt).toLocaleDateString('es-AR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            const durationStr = item.durationSeconds > 0 ? formatDuration(item.durationSeconds) : '';

            return `
                <div class="card transcription-card" data-transcription-id="${item.id}" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--surface-inset);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); font-weight: 700;">${item.title}</h3>
                            <span style="font-size: 0.78rem; color: var(--text-secondary);">${dateStr} ${durationStr ? `· ${durationStr}` : ''}</span>
                        </div>
                        ${item.summary ? '<span class="badge green" title="Contiene resumen generado por IA"><i class="ph ph-sparkle"></i> Resumen</span>' : ''}
                    </div>

                    <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45; margin: 0; flex: 1;">
                        ${snippet}
                    </p>

                    <div style="display: flex; justify-content: flex-end; gap: 6px; border-top: 1px solid var(--surface-border); padding-top: 0.75rem;">
                        <button type="button" class="btn btn-secondary" onclick="window.app.transcriptions?.openDetailModal('${item.id}')" style="padding: 4px 10px; font-size: 0.8rem;">
                            <i class="ph ph-eye"></i> Ver / Editar
                        </button>
                        <button type="button" class="btn-icon-danger" onclick="window.app.transcriptions?.deleteTranscription('${item.id}')" title="Eliminar transcripción" style="padding: 4px 8px; font-size: 0.8rem;">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    openDetailModal(transcriptionId) {
        this.activeTranscriptionId = transcriptionId;
        const item = this.registry.transcriptions.find(t => t.id === transcriptionId);
        if (!item) return;

        const modal = document.getElementById('transcription-detail-modal');
        if (!modal) return;

        document.getElementById('trans-detail-title').value = item.title;
        document.getElementById('trans-detail-text').value = item.editedText || item.rawText;

        const summaryContainer = document.getElementById('trans-detail-summary-container');
        const summaryText = document.getElementById('trans-detail-summary-text');
        if (item.summary) {
            summaryContainer?.classList.remove('hidden');
            if (summaryText) summaryText.textContent = item.summary;
        } else {
            summaryContainer?.classList.add('hidden');
        }

        modal.classList.remove('hidden');
    }

    closeDetailModal() {
        const modal = document.getElementById('transcription-detail-modal');
        modal?.classList.add('hidden');
        this.activeTranscriptionId = null;
    }

    saveActiveTranscriptionChanges() {
        if (!this.activeTranscriptionId) return;
        const item = this.registry.transcriptions.find(t => t.id === this.activeTranscriptionId);
        if (!item) return;

        const newTitle = document.getElementById('trans-detail-title')?.value.trim();
        const newText = document.getElementById('trans-detail-text')?.value.trim();

        if (newTitle) item.title = newTitle;
        item.editedText = newText;
        item.updatedAt = new Date().toISOString();

        this.saveData();
        this.closeDetailModal();
        this.render();
        this.app.showToast?.('Transcripción guardada.');
    }

    async requestAiSummary() {
        if (!this.activeTranscriptionId) return;
        const item = this.registry.transcriptions.find(t => t.id === this.activeTranscriptionId);
        if (!item) return;

        const text = item.editedText || item.rawText;
        if (!text || text.length < 20) {
            this.app.showToast?.('El texto es muy corto para generar un resumen.');
            return;
        }

        this.app.showToast?.('Generando resumen con Gemini...');
        const result = await generateSummary({ text });

        if (!result.success) {
            this.app.showToast?.(result.error || 'Error al generar resumen.');
            return;
        }

        item.summary = result.summary;
        this.saveData();

        const summaryContainer = document.getElementById('trans-detail-summary-container');
        const summaryText = document.getElementById('trans-detail-summary-text');
        summaryContainer?.classList.remove('hidden');
        if (summaryText) summaryText.textContent = result.summary;

        this.renderList();
        this.app.showToast?.('¡Resumen generado con éxito!');
    }

    downloadExport(format = 'txt') {
        if (!this.activeTranscriptionId) return;
        const item = this.registry.transcriptions.find(t => t.id === this.activeTranscriptionId);
        if (!item) return;

        const content = format === 'md' ? exportAsMarkdown(item) : exportAsPlainText(item);
        const filename = `${item.title.replace(/[^a-z0-9_-]/gi, '_')}.${format}`;
        const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    async deleteTranscription(transcriptionId) {
        const item = this.registry.transcriptions.find(t => t.id === transcriptionId);
        if (!item) return;

        const confirmed = await this.app.confirmAction?.({
            title: '¿Eliminar transcripción?',
            message: `¿Seguro que deseás eliminar "${item.title}"? Esta acción liberará el espacio local inmediatamente.`,
            tone: 'danger',
            confirmLabel: 'Eliminar'
        });

        if (!confirmed) return;

        this.registry.transcriptions = this.registry.transcriptions.filter(t => t.id !== transcriptionId);
        this.saveData();
        this.render();
        this.app.showToast?.('Transcripción eliminada.');
    }
}
