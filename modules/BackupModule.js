import { getLocalISODate } from '../utils.js';
import {
    applyBackupEntries,
    BackupValidationError,
    createBackupPayload,
    getBackupCategories,
    MAX_BACKUP_BYTES,
    parseAndValidateBackupText
} from '../backup-utils.mjs?v=20260729-project-templates';

export class BackupModule {
    constructor(appController) {
        this.app = appController;
        this.btnExport = document.getElementById('btnExportUnified');
        this.btnImport = document.getElementById('btnImportUnified');
        this.importFile = document.getElementById('importFileUnified');
        this.status = document.getElementById('backup-status');
        this.init();
    }

    setStatus(message = '', state = 'neutral') {
        if (!this.status) return;
        this.status.textContent = message;
        this.status.dataset.state = state;
        this.status.classList.toggle('hidden', !message);
    }

    setImportBusy(isBusy) {
        if (this.btnImport) {
            this.btnImport.disabled = isBusy;
            this.btnImport.setAttribute('aria-busy', String(isBusy));
        }
        if (this.btnExport) {
            this.btnExport.disabled = isBusy;
        }
    }

    exportUnifiedData() {
        try {
            const unifiedData = createBackupPayload(
                key => localStorage.getItem(key)
            );
            const serializedBackup = JSON.stringify(unifiedData, null, 2);
            const blob = new Blob(
                [serializedBackup],
                { type: 'application/json' }
            );
            if (blob.size > MAX_BACKUP_BYTES) {
                throw new BackupValidationError(
                    'El contenido actual supera el límite de 64 MB. Eliminá adjuntos médicos antiguos muy pesados antes de exportar.'
                );
            }
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `LifeCycle_Backup_${getLocalISODate()}.json`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
            this.setStatus('Backup validado y descargado correctamente.', 'success');
        } catch (error) {
            console.error('[Backup] No se pudo generar el respaldo:', error);
            this.setStatus(
                `No se pudo generar el backup: ${error.message}`,
                'error'
            );
            alert(`No se pudo generar el backup: ${error.message}`);
        }
    }

    validateSelectedFile(file) {
        const hasJsonExtension = file.name.toLowerCase().endsWith('.json');
        const allowedMimeTypes = new Set([
            '',
            'application/json',
            'text/json',
            'text/plain'
        ]);

        if (!hasJsonExtension || !allowedMimeTypes.has(file.type || '')) {
            throw new BackupValidationError('Seleccioná un archivo de backup con extensión .json.');
        }
        if (file.size <= 0) {
            throw new BackupValidationError('El archivo seleccionado está vacío.');
        }
        if (file.size > MAX_BACKUP_BYTES) {
            throw new BackupValidationError('El backup supera el límite permitido de 64 MB.');
        }
    }

    buildConfirmationMessage(plan) {
        const categoryList = plan.categories.map(category => `• ${category}`).join('\n');
        const scopeMessage = plan.mode === 'full'
            ? 'Este backup completo reemplazará los datos actuales. Las secciones vacías del archivo también se vaciarán.'
            : 'Este es un backup anterior. Solo se actualizarán las secciones presentes en el archivo.';

        return [
            'El backup fue validado correctamente.',
            '',
            scopeMessage,
            '',
            'Secciones detectadas:',
            categoryList,
            '',
            '¿Querés continuar con la restauración?'
        ].join('\n');
    }

    applyPlanAtomically(plan) {
        const auth = this.app.auth;
        const previousRestoringState = auth?.isRestoring ?? false;

        if (auth) auth.isRestoring = true;
        try {
            return applyBackupEntries(localStorage, plan.entries);
        } finally {
            if (auth) auth.isRestoring = previousRestoringState;
        }
    }

    async queueCloudSync(changedKeys) {
        const auth = this.app.auth;
        if (!auth?.user || changedKeys.length === 0) return true;

        changedKeys.forEach(key => auth.queueKeySync(key));
        try {
            return await auth.syncToCloud(false);
        } catch (error) {
            console.error('[Backup] La restauración quedó pendiente de sincronización:', error);
            return false;
        }
    }

    async importData(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        this.setImportBusy(true);
        this.setStatus('Validando el archivo antes de modificar tus datos...', 'working');

        try {
            this.validateSelectedFile(file);
            const fileText = await file.text();
            const plan = parseAndValidateBackupText(fileText);

            if (!confirm(this.buildConfirmationMessage(plan))) {
                this.setStatus('Importación cancelada. No se modificó ningún dato.', 'neutral');
                return;
            }

            this.setStatus('Restaurando el backup de forma segura...', 'working');
            const changedKeys = this.applyPlanAtomically(plan);

            if (changedKeys.length === 0) {
                this.setStatus('El backup ya coincide con los datos actuales.', 'success');
                alert('El backup es válido, pero sus datos ya coinciden con LifeCycle.');
                return;
            }

            this.setStatus('Datos restaurados. Sincronizando con la nube...', 'working');
            const cloudSynced = await this.queueCloudSync(changedKeys);
            const changedCategories = getBackupCategories(changedKeys);
            const categoryList = changedCategories.map(category => `- ${category}`).join('\n');

            if (cloudSynced) {
                this.setStatus('Backup restaurado y sincronizado correctamente.', 'success');
                alert(`Backup restaurado correctamente.\n\nSecciones actualizadas:\n${categoryList}`);
            } else {
                this.setStatus(
                    'Backup restaurado localmente. La sincronización cloud quedó pendiente y se reintentará automáticamente.',
                    'warning'
                );
                alert(
                    `El backup se restauró correctamente, pero la sincronización cloud quedó pendiente.\n\n`
                    + `LifeCycle volverá a intentarlo automáticamente.\n\nSecciones actualizadas:\n${categoryList}`
                );
            }

            location.reload();
        } catch (error) {
            console.error('[Backup] Error procesando el archivo:', error);
            const message = error instanceof BackupValidationError
                ? error.message
                : 'No se pudo procesar el archivo sin arriesgar tus datos.';
            this.setStatus(message, 'error');
            alert(`No se importó ningún dato.\n\n${message}`);
        } finally {
            if (this.importFile) this.importFile.value = '';
            this.setImportBusy(false);
        }
    }

    init() {
        this.btnExport?.addEventListener('click', () => this.exportUnifiedData());
        this.btnImport?.addEventListener('click', () => this.importFile?.click());
        this.importFile?.addEventListener('change', event => this.importData(event));
    }
}
