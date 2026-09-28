import { createBackupPayload } from '../backup-utils.mjs';
import { CLOUD_SYNC_KEYS } from '../sync-config.mjs';
import { createRecoveryVault, encryptRecoverySnapshot, readRecoveryVault, saveRecoveryVault } from '../recovery-vault.mjs';

export class RecoveryModule {
    constructor(app) {
        this.app = app;
        this.status = document.getElementById('recovery-status');
        this.form = document.getElementById('recovery-setup');
        this.lastFingerprint = null;
        this.timer = null;
        this.form?.addEventListener('submit', event => { event.preventDefault(); void this.enable(); });
        window.addEventListener('lifecycle:auth-ready', () => {
            this.lastFingerprint = null;
            void this.refresh().then(() => this.scheduleSnapshot());
        });
    }

    setStatus(message) { if (this.status) this.status.textContent = message; }

    async refresh() {
        const ownerId = this.app.auth?.readyUserId;
        if (!ownerId) return;
        try {
            const vault = await readRecoveryVault(ownerId);
            if (ownerId !== this.app.auth?.readyUserId) return;
            this.form?.classList.toggle('hidden', Boolean(vault));
            this.setStatus(vault?.snapshots[0]
                ? `Copia cifrada local: ${new Date(vault.snapshots[0].createdAt).toLocaleString()}. Se actualiza al usar este dispositivo.`
                : 'Todavía no hay copia de consulta en este dispositivo.');
        } catch { this.setStatus('Este navegador no permite guardar la copia. Usá Descargar Backup Unificado.'); }
    }

    payload(ownerId) {
        return { ...createBackupPayload(key => localStorage.getItem(key)), ownerId,
            pendingCloudChanges: Boolean(this.app.auth.pendingSyncKeys.size || this.app.auth.isSyncing) };
    }

    async enable() {
        const ownerId = this.app.auth?.readyUserId;
        if (!ownerId) return;
        const password = document.getElementById('recovery-password');
        const confirm = document.getElementById('recovery-password-confirm');
        if (password.value !== confirm.value) { this.setStatus('Las claves no coinciden.'); return; }
        const button = this.form.querySelector('button');
        button.disabled = true;
        try {
            this.setStatus('Creando copia cifrada en este dispositivo…');
            const vault = await createRecoveryVault(ownerId, password.value);
            password.value = confirm.value = '';
            if (ownerId !== this.app.auth?.readyUserId) return;
            const snapshot = await encryptRecoverySnapshot(vault, this.payload(ownerId));
            if (ownerId !== this.app.auth?.readyUserId) return;
            await saveRecoveryVault(vault, snapshot, { initial: true });
            await this.refresh();
            this.scheduleSnapshot();
        } catch (error) { this.setStatus(`No se pudo crear la copia: ${error.message}`); }
        finally { password.value = confirm.value = ''; button.disabled = false; }
    }

    scheduleSnapshot() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.capture(), 1200);
    }

    async capture() {
        const ownerId = this.app.auth?.readyUserId;
        if (!ownerId) return;
        try {
            const fingerprint = JSON.stringify([ownerId, this.app.auth.pendingSyncKeys.size, this.app.auth.isSyncing,
                CLOUD_SYNC_KEYS.map(key => localStorage.getItem(key))]);
            if (fingerprint === this.lastFingerprint) return;
            const vault = await readRecoveryVault(ownerId);
            if (!vault || ownerId !== this.app.auth?.readyUserId) return;
            const snapshot = await encryptRecoverySnapshot(vault, this.payload(ownerId));
            if (ownerId !== this.app.auth?.readyUserId) return;
            await saveRecoveryVault(vault, snapshot);
            this.lastFingerprint = fingerprint;
            await this.refresh();
        } catch {
            this.setStatus('No se pudo actualizar la copia local. La anterior se conserva. Exportá un backup y revisá el espacio del dispositivo.');
        }
    }
}
