import {
    AUDIO_CONSTRAINTS,
    TRANSCRIPTION_PRIVACY_NOTICE
} from '../audio-transcription-config.mjs';
import { AudioRecorder } from '../audio-recorder.mjs';
import { readMediaDuration, validateMediaFile } from '../audio-importer.mjs';
import { NativeAudioRecorder, isNativeAudioRecorderAvailable } from '../native-audio-recorder.mjs';
import { TranscriptionCache } from '../transcription-cache.mjs';
import { TranscriptionCloudService } from '../transcription-service.mjs';
import {
    createDownloadFilename,
    exportAsMarkdown,
    exportAsPlainText,
    formatBytes,
    formatDuration,
    getTranscriptionStatusLabel,
    searchTranscriptions,
    sha256Blob
} from '../transcription-utils.mjs';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

const PROCESSING_STATUSES = new Set(['queued', 'processing']);
const RETRYABLE_STATUSES = new Set(['uploaded', 'partial', 'failed']);

function defaultRecordingTitle() {
    return `Grabación ${new Date().toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
}

function errorMessage(error) {
    return String(error?.message || error || 'Error desconocido').slice(0, 500);
}

export class TranscriptionsModule {
    constructor(app) {
        this.app = app;
        this.cloud = new TranscriptionCloudService(app);
        this.cache = new TranscriptionCache();
        this.webRecorder = new AudioRecorder();
        this.nativeRecorder = new NativeAudioRecorder();
        this.folders = [];
        this.sessions = [];
        this.activeFolderId = 'all';
        this.searchQuery = '';
        this.activeSessionId = null;
        this.recordingSession = null;
        this.recordingMode = null;
        this.recordingStartedAt = 0;
        this.nativeTimer = null;
        this.uploadChain = Promise.resolve();
        this.finishingRecording = false;
        this.loading = false;
        this.available = null;
        this.lastAvailabilityMessage = '';
        this.pollTimer = null;
        this.bindEvents();
        this.bindNativeEvents();
        queueMicrotask(() => void this.handleAuthenticated());
        void this.recoverNativeRecording();
    }

    bindEvents() {
        document.getElementById('btn-toggle-record-voice')?.addEventListener('click', () => {
            void this.handleToggleRecord();
        });
        const input = document.getElementById('transcription-file-input');
        document.getElementById('btn-import-audio-file')?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', event => void this.handleFileSelected(event));
        document.getElementById('transcription-search-input')?.addEventListener('input', event => {
            this.searchQuery = event.currentTarget.value;
            this.renderList();
        });
        document.getElementById('btn-new-transcription-folder')?.addEventListener('click', () => {
            void this.createFolder();
        });
        document.getElementById('transcriptions-folder-tabs')?.addEventListener('click', event => {
            const button = event.target.closest('[data-transcription-folder]');
            if (!button) return;
            this.activeFolderId = button.dataset.transcriptionFolder;
            this.renderFolders();
            this.renderList();
        });
        document.getElementById('transcriptions-list')?.addEventListener('click', event => {
            const button = event.target.closest('[data-transcription-action]');
            if (!button) return;
            const sessionId = button.closest('[data-transcription-id]')?.dataset.transcriptionId;
            const action = button.dataset.transcriptionAction;
            if (action === 'open') this.openDetailModal(sessionId);
            else if (action === 'delete') void this.deleteTranscription(sessionId);
            else if (action === 'process') void this.enqueueSession(sessionId);
            else if (action === 'audio') void this.downloadAudio(sessionId);
        });
        document.querySelectorAll('[data-transcription-modal-close]').forEach(button => {
            button.addEventListener('click', () => this.closeDetailModal());
        });
        const modal = document.getElementById('transcription-detail-modal');
        modal?.addEventListener('click', event => {
            if (event.target === modal) this.closeDetailModal();
        });
        modal?.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.closeDetailModal();
        });
        document.getElementById('btn-save-transcription-detail')?.addEventListener('click', () => {
            void this.saveActiveTranscriptionChanges();
        });
        document.getElementById('btn-generate-ai-summary')?.addEventListener('click', () => {
            void this.requestArtifact('summary');
        });
        document.getElementById('btn-generate-ai-notes')?.addEventListener('click', () => {
            void this.requestArtifact('notes');
        });
        document.getElementById('btn-copy-transcription')?.addEventListener('click', () => {
            void this.copyActiveTranscript();
        });
        document.getElementById('btn-export-transcription-txt')?.addEventListener('click', () => this.downloadExport('txt'));
        document.getElementById('btn-export-transcription-md')?.addEventListener('click', () => this.downloadExport('md'));
        document.getElementById('btn-download-transcription-audio')?.addEventListener('click', () => {
            if (this.activeSessionId) void this.downloadAudio(this.activeSessionId);
        });
        document.getElementById('btn-retry-transcription')?.addEventListener('click', () => {
            if (this.activeSessionId) void this.enqueueSession(this.activeSessionId);
        });
        window.addEventListener('online', () => void this.resumePendingUploads());
        window.addEventListener('lifecycle:auth-ready', event => {
            if (event.detail?.user) void this.handleAuthenticated();
            else this.handleSignedOut();
        });
    }

    bindNativeEvents() {
        if (!isNativeAudioRecorderAvailable()) return;
        this.nativeRecorder.addListener('recordingInterrupted', event => {
            this.app.showToast?.(event?.message || 'La grabación se interrumpió. Abrí Transcripciones para revisarla.');
            void this.finishNativeRecording({ interrupted: true });
        });
        this.nativeRecorder.addListener('recordingStopped', event => {
            if (event?.automatic) void this.finishNativeRecording({ automatic: true });
        });
    }

    async handleAuthenticated() {
        if (!this.app.auth?.user || !this.app.auth?.supabase) {
            this.updateAvailability(false, 'Iniciá sesión para acceder a tu biblioteca privada.');
            return;
        }
        await this.loadLibrary();
        if (this.available) await this.resumePendingUploads();
    }

    handleSignedOut() {
        this.sessions = [];
        this.folders = [];
        this.cloud.workerWakeWarning = '';
        this.available = false;
        clearInterval(this.pollTimer);
        this.pollTimer = null;
        this.render();
    }

    async loadLibrary({ quiet = false } = {}) {
        if (this.loading || !this.app.auth?.user) return false;
        this.loading = true;
        try {
            const library = await this.cloud.listLibrary();
            this.folders = library.folders;
            this.sessions = library.sessions;
            this.updateAvailability(
                true,
                isNativeAudioRecorderAvailable()
                    ? 'Grabador Android listo: puede continuar con la pantalla apagada mediante una notificación persistente.'
                    : 'Modo web listo. Para grabar con la pantalla apagada se necesita la instalación Android de LifeCycle.'
            );
            void this.cleanupCompletedLocalCache().catch(error => {
                console.warn('[Transcripciones] No se pudo limpiar la caché completada:', errorMessage(error));
            });
            this.ensurePolling();
            this.render();
            return true;
        } catch (error) {
            const message = errorMessage(error);
            const missingMigration = /transcription_|schema cache|does not exist|PGRST20/i.test(message);
            const forbidden = /row-level security|permission denied|42501|not enabled/i.test(message);
            this.updateAvailability(false, missingMigration
                ? 'Transcripciones está preparada, pero falta aplicar su migración de Supabase.'
                : (forbidden
                    ? 'Transcripciones está habilitada sólo para la cuenta principal.'
                    : 'No se pudo abrir la biblioteca. Se conservarán los audios locales pendientes.'));
            if (!quiet) console.warn('[Transcripciones] Biblioteca no disponible:', message);
            this.render();
            return false;
        } finally {
            this.loading = false;
        }
    }

    updateAvailability(available, message) {
        this.available = available;
        this.lastAvailabilityMessage = message;
        const root = document.getElementById('transcription-availability');
        if (root) {
            root.classList.toggle('is-error', available === false);
            const span = root.querySelector('span');
            const pendingConfiguration = this.app.auth?.config?.transcriptionConfigured === false
                ? 'La grabación está disponible; la transcripción quedará en cola hasta configurar Gemini en el servidor.'
                : '';
            if (span) span.textContent = [message, this.cloud.workerWakeWarning || pendingConfiguration].filter(Boolean).join(' ');
        }
        ['btn-toggle-record-voice', 'btn-import-audio-file', 'btn-new-transcription-folder']
            .forEach(id => {
                const button = document.getElementById(id);
                if (button && this.recordingMode === null) button.disabled = available !== true;
            });
    }

    ensurePolling() {
        const hasProcessing = this.sessions.some(session => PROCESSING_STATUSES.has(session.status));
        if (hasProcessing && !this.pollTimer) {
            this.pollTimer = setInterval(() => void this.loadLibrary({ quiet: true }), 15_000);
        } else if (!hasProcessing && this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    async ensurePrivacyConsent() {
        if (localStorage.getItem(TRANSCRIPTION_PRIVACY_NOTICE.consentStorageKey) === 'true') return true;
        const confirmed = await this.app.confirmAction?.({
            title: TRANSCRIPTION_PRIVACY_NOTICE.title,
            message: TRANSCRIPTION_PRIVACY_NOTICE.text,
            confirmLabel: 'Acepto y continuar',
            cancelLabel: 'Cancelar',
            tone: 'warning'
        });
        if (confirmed) localStorage.setItem(TRANSCRIPTION_PRIVACY_NOTICE.consentStorageKey, 'true');
        return confirmed === true;
    }

    async handleToggleRecord() {
        if (this.recordingMode) {
            await this.stopRecording();
            return;
        }
        if (!this.available || !(await this.ensurePrivacyConsent())) return;
        await this.startRecording();
    }

    getCaptureSettings() {
        return {
            title: document.getElementById('transcription-new-title')?.value.trim() || defaultRecordingTitle(),
            folderId: document.getElementById('transcription-new-folder')?.value || null,
            autoProcess: document.getElementById('transcription-auto-process')?.checked !== false
        };
    }

    async startRecording() {
        const settings = this.getCaptureSettings();
        if (!isNativeAudioRecorderAvailable()) {
            const accepted = await this.app.confirmAction?.({
                title: 'Grabación web en primer plano',
                message: 'El navegador puede pausar el micrófono al bloquear la pantalla o cerrar esta pestaña. Los fragmentos ya cerrados quedan recuperables. Para grabar con pantalla apagada usá la instalación Android de LifeCycle.',
                confirmLabel: 'Grabar en primer plano',
                cancelLabel: 'Cancelar',
                tone: 'warning'
            });
            if (!accepted) return;
        }
        let sessionId = null;
        try {
            sessionId = globalThis.crypto?.randomUUID?.();
            if (!sessionId) throw new Error('Este dispositivo no pudo generar una identidad segura para la grabación.');
            const session = await this.cloud.createSession({
                id: sessionId,
                ...settings,
                sourceType: 'recording',
                status: 'recording',
                mimeType: isNativeAudioRecorderAvailable() ? 'audio/aac' : AudioRecorder.getBestMimeType()
            });
            this.recordingSession = { ...session, ...settings };
            await this.cache.putSession({
                id: sessionId,
                ...settings,
                sourceType: 'recording',
                cloudCreated: true
            });
            this.uploadChain = Promise.resolve();
            this.recordingStartedAt = Date.now();
            if (isNativeAudioRecorderAvailable()) {
                await this.nativeRecorder.start({
                    sessionId,
                    title: settings.title,
                    maxDurationSeconds: AUDIO_CONSTRAINTS.maxDurationSeconds,
                    segmentDurationSeconds: AUDIO_CONSTRAINTS.segmentDurationSeconds
                });
                this.recordingMode = 'native';
                this.startNativeTimer();
            } else {
                this.recordingMode = 'web';
                await this.webRecorder.start({
                    onTick: seconds => this.updateRecordingTimer(seconds),
                    onSegment: segment => this.queueSegmentUpload(sessionId, segment),
                    onBackgroundRisk: () => this.app.showToast?.('La grabación web puede interrumpirse en segundo plano. Los fragmentos cerrados siguen guardados.'),
                    onInterrupted: result => void this.finishWebRecording(result),
                    onAutomaticStop: result => void this.finishWebRecording(result),
                    onError: error => this.app.showToast?.(`Problema con el micrófono: ${errorMessage(error)}`)
                });
            }
            this.setRecordingUi(true);
        } catch (error) {
            if (sessionId) {
                await this.cache.deleteSession(sessionId).catch(() => {});
                await this.cloud.deleteSession(sessionId).catch(() => {});
            }
            this.recordingMode = null;
            this.recordingSession = null;
            this.setRecordingUi(false);
            this.app.showToast?.(`No se pudo iniciar: ${errorMessage(error)}`);
        }
    }

    queueSegmentUpload(sessionId, segment) {
        this.uploadChain = this.uploadChain.then(async () => {
            const checksum = await sha256Blob(segment.blob);
            await this.cache.putChunk({
                sessionId,
                sequenceNumber: segment.sequenceNumber,
                blob: segment.blob,
                durationMs: segment.durationMs,
                mimeType: segment.mimeType,
                sha256: checksum
            });
            try {
                const cloudChunk = await this.cloud.uploadChunk(sessionId, { ...segment, sha256: checksum });
                await this.cache.markChunkUploaded(
                    sessionId,
                    segment.sequenceNumber,
                    cloudChunk.id,
                    cloudChunk.storage_path
                );
            } catch (error) {
                console.warn('[Transcripciones] Fragmento guardado localmente, pendiente de subir:', errorMessage(error));
            }
        });
        return this.uploadChain;
    }

    async stopRecording() {
        if (this.recordingMode === 'native') {
            await this.nativeRecorder.stop().catch(error => {
                this.app.showToast?.(`No se pudo detener limpiamente: ${errorMessage(error)}`);
            });
            await this.finishNativeRecording();
        } else if (this.recordingMode === 'web') {
            const result = await this.webRecorder.stop();
            await this.finishWebRecording(result);
        }
    }

    async finishWebRecording(result = {}) {
        if (this.finishingRecording || !this.recordingSession) return;
        this.finishingRecording = true;
        const session = this.recordingSession;
        try {
            await this.uploadChain;
            await this.finishUploadedSession(session.id, session.autoProcess);
            if (result.interrupted) this.app.showToast?.('La grabación se interrumpió; se conservaron los fragmentos disponibles.');
        } finally {
            this.finishRecordingUi();
        }
    }

    async finishNativeRecording({ interrupted = false } = {}) {
        if (this.finishingRecording || !this.recordingSession) return;
        this.finishingRecording = true;
        const session = this.recordingSession;
        try {
            const chunks = await this.nativeRecorder.listChunks(session.id);
            for (const chunk of chunks) {
                const blob = await this.nativeRecorder.readChunk(chunk.path, chunk.mimeType || 'audio/mp4');
                await this.queueSegmentUpload(session.id, {
                    sequenceNumber: Number(chunk.sequenceNumber),
                    blob,
                    mimeType: chunk.mimeType || 'audio/mp4',
                    durationMs: Number(chunk.durationMs) || 0
                });
            }
            await this.uploadChain;
            await this.finishUploadedSession(session.id, session.autoProcess);
            await this.nativeRecorder.deleteSessionAudio(session.id).catch(() => {});
            if (interrupted) this.app.showToast?.('La grabación nativa se interrumpió. Se recuperó todo fragmento que había quedado cerrado.');
        } catch (error) {
            await this.showRecoveryState(session.id, error);
        } finally {
            this.finishRecordingUi();
        }
    }

    async finishUploadedSession(sessionId, autoProcess) {
        try {
            const localChunks = await this.cache.listChunks(sessionId);
            if (
                localChunks.length === 0
                || localChunks.some(chunk => chunk.uploadStatus !== 'uploaded')
            ) {
                throw new Error('Todavía quedan fragmentos locales pendientes de subir.');
            }
            await this.cloud.finalizeUpload(sessionId);
            await this.cache.updateSession(sessionId, { finalized: true }).catch(() => {});
            if (autoProcess) {
                await this.cloud.enqueueSession(sessionId);
                await this.cache.updateSession(sessionId, { enqueued: true }).catch(() => {});
            }
            await this.loadLibrary({ quiet: true });
            this.app.showToast?.(autoProcess ? 'Grabación guardada y enviada a la cola.' : 'Grabación guardada. Podés transcribirla cuando quieras.');
        } catch (error) {
            await this.showRecoveryState(sessionId, error);
        }
    }

    async showRecoveryState(sessionId, error) {
        const panel = document.getElementById('transcription-recovery-panel');
        if (panel) {
            panel.classList.remove('hidden');
            panel.textContent = `La grabación ${sessionId.slice(0, 8)} quedó guardada localmente. Reintentaremos al recuperar conexión. ${errorMessage(error)}`;
        }
        this.app.showToast?.('El audio quedó guardado localmente y pendiente de subir.');
    }

    finishRecordingUi() {
        clearInterval(this.nativeTimer);
        this.nativeTimer = null;
        this.recordingMode = null;
        this.recordingSession = null;
        this.recordingStartedAt = 0;
        this.finishingRecording = false;
        this.setRecordingUi(false);
        void this.resumePendingUploads();
    }

    startNativeTimer() {
        clearInterval(this.nativeTimer);
        this.nativeTimer = setInterval(() => {
            this.updateRecordingTimer(Math.floor((Date.now() - this.recordingStartedAt) / 1000));
        }, 1000);
    }

    updateRecordingTimer(seconds) {
        const timer = document.getElementById('recording-timer');
        if (timer) timer.textContent = formatDuration(seconds);
    }

    setRecordingUi(active) {
        document.getElementById('recording-pulse')?.classList.toggle('hidden', !active);
        const button = document.getElementById('btn-toggle-record-voice');
        if (button) {
            button.disabled = false;
            button.innerHTML = active
                ? '<i class="ph ph-stop-circle"></i> Detener grabación'
                : '<i class="ph ph-microphone"></i> Grabar audio';
            button.classList.toggle('recording-active', active);
        }
        const hint = document.getElementById('recording-mode-hint');
        if (hint) hint.textContent = active
            ? (this.recordingMode === 'native'
                ? 'Podés bloquear la pantalla; Android mostrará una notificación persistente.'
                : 'Mantené esta pestaña visible y el dispositivo desbloqueado.')
            : '';
        ['btn-import-audio-file', 'btn-new-transcription-folder'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.disabled = active || this.available !== true;
        });
    }

    async recoverNativeRecording() {
        if (!isNativeAudioRecorderAvailable()) return;
        try {
            const status = await this.nativeRecorder.getStatus();
            if (!status?.sessionId || (!status.active && !status.recoverable)) return;
            const cached = await this.cache.getSession(status.sessionId);
            this.recordingSession = {
                id: status.sessionId,
                title: cached?.title || status.title || defaultRecordingTitle(),
                autoProcess: cached?.autoProcess !== false
            };
            if (!status.active && status.recoverable) {
                await this.finishNativeRecording({ interrupted: true });
                return;
            }
            this.recordingMode = 'native';
            this.recordingStartedAt = Number(status.startedAt) || Date.now();
            this.startNativeTimer();
            this.setRecordingUi(true);
        } catch (error) {
            console.warn('[Transcripciones] No se pudo recuperar el estado nativo:', errorMessage(error));
        }
    }

    async resumePendingUploads(targetSessionId = null) {
        if (!navigator.onLine || !this.available || !this.cache.isSupported() || this.recordingMode) return;
        try {
            const sessions = await this.cache.listSessions();
            for (const session of sessions) {
                if (targetSessionId && session.id !== targetSessionId) continue;
                const chunks = await this.cache.listChunks(session.id);
                const pending = chunks.filter(chunk => chunk.uploadStatus !== 'uploaded');
                for (const chunk of pending) {
                    let blob = chunk.blob;
                    if (!blob && chunk.nativePath && isNativeAudioRecorderAvailable()) {
                        blob = await this.nativeRecorder.readChunk(chunk.nativePath, chunk.mimeType);
                    }
                    if (!blob) continue;
                    const uploaded = await this.cloud.uploadChunk(session.id, {
                        sequenceNumber: chunk.sequenceNumber,
                        blob,
                        mimeType: chunk.mimeType,
                        mediaRole: chunk.mediaRole,
                        durationMs: chunk.durationMs,
                        sha256: chunk.sha256
                    });
                    await this.cache.markChunkUploaded(session.id, chunk.sequenceNumber, uploaded.id, uploaded.storage_path);
                }
                if (chunks.length > 0) {
                    const refreshed = await this.cache.listChunks(session.id);
                    if (refreshed.every(chunk => chunk.uploadStatus === 'uploaded')) {
                        const remote = this.sessions.find(item => item.id === session.id);
                        const alreadyQueued = ['queued', 'processing', 'completed'].includes(remote?.status);
                        if (!session.finalized && !alreadyQueued) {
                            await this.cloud.finalizeUpload(session.id);
                            await this.cache.updateSession(session.id, { finalized: true });
                        }
                        if (session.autoProcess !== false && !session.enqueued && !alreadyQueued) {
                            await this.cloud.enqueueSession(session.id);
                            await this.cache.updateSession(session.id, { enqueued: true, finalized: true });
                        } else if (alreadyQueued && (!session.enqueued || !session.finalized)) {
                            await this.cache.updateSession(session.id, { enqueued: true, finalized: true });
                        }
                    }
                }
            }
            const panel = document.getElementById('transcription-recovery-panel');
            panel?.classList.add('hidden');
            await this.loadLibrary({ quiet: true });
        } catch (error) {
            console.warn('[Transcripciones] La recuperación seguirá pendiente:', errorMessage(error));
        }
    }

    async cleanupCompletedLocalCache() {
        if (!this.cache.isSupported()) return;
        const completedIds = new Set(this.sessions.filter(session => session.status === 'completed').map(session => session.id));
        const localSessions = await this.cache.listSessions().catch(() => []);
        for (const local of localSessions) {
            if (completedIds.has(local.id)) await this.cache.deleteSession(local.id).catch(() => {});
        }
    }

    async handleFileSelected(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file || !this.available) return;
        const validation = validateMediaFile(file);
        if (!validation.valid) {
            this.app.showToast?.(validation.error);
            return;
        }
        if (!(await this.ensurePrivacyConsent())) return;
        let sessionId = null;
        try {
            const durationMs = await readMediaDuration(file).catch(() => 0);
            if (durationMs > AUDIO_CONSTRAINTS.maxDurationSeconds * 1000) {
                throw new Error('El archivo supera el límite de tres horas.');
            }
            const settings = this.getCaptureSettings();
            const title = document.getElementById('transcription-new-title')?.value.trim()
                || file.name.replace(/\.[^.]+$/, '').slice(0, 160);
            sessionId = globalThis.crypto?.randomUUID?.();
            if (!sessionId) throw new Error('Este dispositivo no pudo generar una identidad segura para el archivo.');
            const session = await this.cloud.createSession({
                id: sessionId,
                ...settings,
                title,
                sourceType: 'import',
                status: 'uploading',
                mimeType: validation.mimeType
            });
            await this.cache.putSession({
                id: session.id,
                ...settings,
                title,
                sourceType: 'import',
                cloudCreated: true
            });
            const checksum = await sha256Blob(file);
            await this.cache.putChunk({
                sessionId: session.id,
                sequenceNumber: 0,
                blob: file,
                durationMs,
                mimeType: validation.mimeType,
                mediaRole: 'import_source',
                sha256: checksum
            });
            const chunk = await this.cloud.uploadChunk(session.id, {
                sequenceNumber: 0,
                blob: file,
                durationMs,
                mimeType: validation.mimeType,
                mediaRole: 'import_source',
                sha256: checksum
            }, { filename: file.name });
            await this.cache.markChunkUploaded(session.id, 0, chunk.id, chunk.storage_path);
            await this.finishUploadedSession(session.id, settings.autoProcess);
        } catch (error) {
            const cached = sessionId ? await this.cache.getSession(sessionId).catch(() => null) : null;
            if (cached) await this.showRecoveryState(sessionId, error);
            this.app.showToast?.(`No se pudo importar el archivo: ${errorMessage(error)}`);
        }
    }

    async createFolder() {
        const name = globalThis.prompt?.('Nombre de la nueva carpeta:')?.trim();
        if (!name) return;
        try {
            const folder = await this.cloud.createFolder(name);
            this.folders.push(folder);
            this.folders.sort((a, b) => a.name.localeCompare(b.name, 'es'));
            this.renderFolders();
            this.renderFolderSelects();
        } catch (error) {
            this.app.showToast?.(`No se pudo crear la carpeta: ${errorMessage(error)}`);
        }
    }

    async enqueueSession(sessionId) {
        try {
            await this.cloud.enqueueSession(sessionId);
            await this.cache.updateSession(sessionId, { enqueued: true, finalized: true }).catch(() => {});
            this.closeDetailModal();
            await this.loadLibrary({ quiet: true });
            this.app.showToast?.('Transcripción agregada a la cola.');
        } catch (error) {
            this.app.showToast?.(`No se pudo iniciar el procesamiento: ${errorMessage(error)}`);
        }
    }

    async requestArtifact(kind) {
        if (!this.activeSessionId) return;
        try {
            await this.cloud.enqueueArtifact(this.activeSessionId, kind);
            this.app.showToast?.(kind === 'summary' ? 'Resumen agregado a la cola.' : 'Apuntes agregados a la cola.');
            this.ensurePolling();
        } catch (error) {
            this.app.showToast?.(`No se pudo generar el resultado: ${errorMessage(error)}`);
        }
    }

    render() {
        this.renderFolders();
        this.renderFolderSelects();
        this.renderList();
        this.updateAvailability(this.available, this.lastAvailabilityMessage || 'Comprobando acceso...');
    }

    renderFolders() {
        const root = document.getElementById('transcriptions-folder-tabs');
        if (!root) return;
        const buttons = [
            { id: 'all', name: 'Todas', icon: 'ph-squares-four' },
            { id: 'inbox', name: 'Bandeja', icon: 'ph-tray' },
            ...this.folders.map(folder => ({ id: folder.id, name: folder.name, icon: 'ph-folder' }))
        ];
        root.innerHTML = buttons.map(folder => `
            <button type="button" class="tab-btn ${this.activeFolderId === folder.id ? 'active' : ''}" data-transcription-folder="${escapeHtml(folder.id)}">
                <i class="ph ${folder.icon}"></i> ${escapeHtml(folder.name)}
            </button>`).join('');
    }

    renderFolderSelects() {
        const options = [
            '<option value="">Bandeja de entrada</option>',
            ...this.folders.map(folder => `<option value="${escapeHtml(folder.id)}">${escapeHtml(folder.name)}</option>`)
        ].join('');
        const creationSelect = document.getElementById('transcription-new-folder');
        if (creationSelect) {
            const selected = creationSelect.value;
            creationSelect.innerHTML = options;
            if ([...creationSelect.options].some(option => option.value === selected)) creationSelect.value = selected;
        }
        const detailSelect = document.getElementById('trans-detail-folder');
        if (detailSelect) detailSelect.innerHTML = options;
    }

    getFilteredSessions() {
        let sessions = this.sessions;
        if (this.activeFolderId === 'inbox') sessions = sessions.filter(session => !session.folderId);
        else if (this.activeFolderId !== 'all') sessions = sessions.filter(session => session.folderId === this.activeFolderId);
        return searchTranscriptions(sessions, this.searchQuery);
    }

    renderList() {
        const root = document.getElementById('transcriptions-list');
        if (!root) return;
        if (!this.available) {
            root.innerHTML = '<div class="empty-state transcription-empty"><i class="ph ph-lock-key"></i><p>La biblioteca privada todavía no está disponible.</p></div>';
            return;
        }
        const sessions = this.getFilteredSessions();
        if (sessions.length === 0) {
            root.innerHTML = '<div class="empty-state transcription-empty"><i class="ph ph-waveform"></i><p>No hay transcripciones en esta vista.</p></div>';
            return;
        }
        root.innerHTML = sessions.map(session => {
            const snippet = String(session.transcript || session.errorMessage || 'Audio guardado; todavía no hay texto.').slice(0, 180);
            const progress = session.expectedChunks > 0
                ? `${session.completedChunks}/${session.expectedChunks} fragmentos`
                : formatBytes(session.totalBytes);
            const retry = RETRYABLE_STATUSES.has(session.status)
                ? '<button type="button" class="btn btn-secondary" data-transcription-action="process"><i class="ph ph-play"></i> Procesar</button>'
                : '';
            return `
                <article class="card transcription-card" data-transcription-id="${escapeHtml(session.id)}">
                    <div class="transcription-card-heading">
                        <div><small>${session.sourceType === 'import' ? 'Archivo importado' : 'Grabación'}</small><h3>${escapeHtml(session.title)}</h3></div>
                        <span class="badge ${session.status === 'completed' ? 'green' : (session.status === 'failed' || session.status === 'partial' ? 'red' : 'yellow')}">${escapeHtml(getTranscriptionStatusLabel(session.status))}</span>
                    </div>
                    <p>${escapeHtml(snippet)}</p>
                    <div class="transcription-card-meta"><span>${escapeHtml(progress)}</span><span>${formatDuration(session.durationSeconds)}</span></div>
                    <div class="transcription-card-actions">
                        <button type="button" class="btn btn-secondary" data-transcription-action="open"><i class="ph ph-eye"></i> Ver</button>
                        ${retry}
                        ${session.audioDeletedAt ? '' : '<button type="button" class="btn btn-secondary" data-transcription-action="audio"><i class="ph ph-download-simple"></i> Audio</button>'}
                        <button type="button" class="icon-btn is-danger" data-transcription-action="delete" aria-label="Eliminar ${escapeHtml(session.title)}"><i class="ph ph-trash"></i></button>
                    </div>
                </article>`;
        }).join('');
    }

    openDetailModal(sessionId) {
        const session = this.sessions.find(item => item.id === sessionId);
        const modal = document.getElementById('transcription-detail-modal');
        if (!session || !modal) return;
        this.activeSessionId = sessionId;
        document.getElementById('trans-detail-title').value = session.title;
        document.getElementById('trans-detail-folder').value = session.folderId || '';
        document.getElementById('trans-detail-text').value = session.transcript || '';
        const status = document.getElementById('trans-detail-status');
        if (status) status.textContent = `${getTranscriptionStatusLabel(session.status)} · ${session.completedChunks}/${session.expectedChunks || 0} fragmentos · ${formatBytes(session.totalBytes)}`;
        const summaryContainer = document.getElementById('trans-detail-summary-container');
        summaryContainer?.classList.toggle('hidden', !session.summary);
        const summary = document.getElementById('trans-detail-summary-text');
        if (summary) summary.textContent = session.summary || '';
        const notesContainer = document.getElementById('trans-detail-notes-container');
        notesContainer?.classList.toggle('hidden', !session.notes);
        const notes = document.getElementById('trans-detail-notes-text');
        if (notes) notes.textContent = session.notes || '';
        document.getElementById('btn-retry-transcription')?.classList.toggle('hidden', !RETRYABLE_STATUSES.has(session.status));
        const download = document.getElementById('btn-download-transcription-audio');
        if (download) download.disabled = Boolean(session.audioDeletedAt);
        const hasTranscript = Boolean(session.transcript);
        ['btn-generate-ai-summary', 'btn-generate-ai-notes', 'btn-copy-transcription']
            .forEach(id => {
                const button = document.getElementById(id);
                if (button) button.disabled = !hasTranscript;
            });
        modal.classList.remove('hidden');
    }

    closeDetailModal() {
        document.getElementById('transcription-detail-modal')?.classList.add('hidden');
        this.activeSessionId = null;
    }

    async saveActiveTranscriptionChanges() {
        const session = this.sessions.find(item => item.id === this.activeSessionId);
        if (!session) return;
        const title = document.getElementById('trans-detail-title')?.value.trim();
        const folderId = document.getElementById('trans-detail-folder')?.value || null;
        const transcript = document.getElementById('trans-detail-text')?.value || '';
        if (!title) {
            this.app.showToast?.('El título no puede quedar vacío.');
            return;
        }
        try {
            await this.cloud.updateSession(session.id, { title, folderId });
            if (transcript !== session.transcript) await this.cloud.saveTranscript(session.id, transcript);
            this.closeDetailModal();
            await this.loadLibrary({ quiet: true });
            this.app.showToast?.('Cambios guardados.');
        } catch (error) {
            this.app.showToast?.(`No se pudieron guardar los cambios: ${errorMessage(error)}`);
        }
    }

    async copyActiveTranscript() {
        const session = this.sessions.find(item => item.id === this.activeSessionId);
        if (!session?.transcript) return;
        try {
            await navigator.clipboard.writeText(session.transcript);
            this.app.showToast?.('Transcripción copiada.');
        } catch {
            this.app.showToast?.('El navegador no permitió copiar el texto.');
        }
    }

    downloadExport(format) {
        const session = this.sessions.find(item => item.id === this.activeSessionId);
        if (!session) return;
        const content = format === 'md' ? exportAsMarkdown(session) : exportAsPlainText(session);
        const blob = new Blob([content], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = createDownloadFilename(session.title, format);
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async downloadAudio(sessionId) {
        const session = this.sessions.find(item => item.id === sessionId);
        if (!session || session.audioDeletedAt) {
            this.app.showToast?.('El audio temporal ya fue eliminado.');
            return;
        }
        try {
            const files = await this.cloud.getAudioDownloadUrls(sessionId);
            if (files.length === 0) throw new Error('No quedan fragmentos de audio disponibles.');
            for (const file of files) {
                const response = await fetch(file.signedUrl);
                if (!response.ok) throw new Error(`No se pudo descargar el fragmento ${file.sequenceNumber + 1}.`);
                const blob = await response.blob();
                const extension = file.path.split('.').pop() || 'audio';
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${createDownloadFilename(session.title, '')}_parte_${String(file.sequenceNumber + 1).padStart(2, '0')}.${extension}`;
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            this.app.showToast?.(files.length === 1 ? 'Audio descargado.' : `Se descargaron ${files.length} fragmentos ordenados.`);
        } catch (error) {
            this.app.showToast?.(`No se pudo descargar el audio: ${errorMessage(error)}`);
        }
    }

    async deleteTranscription(sessionId) {
        const session = this.sessions.find(item => item.id === sessionId);
        if (!session) return;
        const confirmed = await this.app.confirmAction?.({
            title: 'Eliminar transcripción',
            message: `Se eliminarán “${session.title}”, su texto y cualquier audio temporal. Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar definitivamente',
            tone: 'danger'
        });
        if (!confirmed) return;
        try {
            await this.cloud.deleteSession(sessionId);
            await this.cache.deleteSession(sessionId).catch(() => {});
            this.sessions = this.sessions.filter(item => item.id !== sessionId);
            this.renderList();
            this.app.showToast?.('Transcripción eliminada.');
        } catch (error) {
            this.app.showToast?.(`No se pudo eliminar: ${errorMessage(error)}`);
        }
    }
}
