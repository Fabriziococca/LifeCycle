import { createPrivacyLock, parsePrivacyLock, privacyLockKey, verifyPrivacyLock } from '../privacy-lock.mjs';

export class PrivacyLockModule {
    constructor(app) {
        this.app = app;
        this.ownerId = null;
        this.authenticated = false;
        this.locked = false;
        this.busy = false;
        this.confirmingLock = false;
        this.record = null;
        this.closedDialogs = [];
        this.gate = document.getElementById('privacy-lock-gate');
        this.settings = document.getElementById('privacy-lock-settings');
        this.password = document.getElementById('privacy-unlock-password');
        document.getElementById('privacy-lock-btn')?.addEventListener('click', () => this.requestLock());
        document.getElementById('privacy-lock-configure')?.addEventListener('click', () => this.configure());
        document.getElementById('privacy-lock-cancel')?.addEventListener('click', () => this.settings.close());
        this.settings?.addEventListener('close', () => this.clearSettings());
        this.settings?.addEventListener('cancel', event => { if (this.busy) event.preventDefault(); });
        document.getElementById('privacy-lock-form')?.addEventListener('submit', event => {
            event.preventDefault(); void this.saveSettings();
        });
        document.getElementById('privacy-unlock-form')?.addEventListener('submit', event => {
            event.preventDefault(); void this.unlock();
        });
        document.getElementById('privacy-lock-signout')?.addEventListener('click', () => void this.signOut());
        this.gate?.addEventListener('keydown', event => {
            // Keep global search/task shortcuts from opening content behind the screen.
            event.stopPropagation();
            if (event.key === 'Escape') event.preventDefault();
            if (event.key === 'Tab') {
                const controls = [...this.gate.querySelectorAll('input:not(:disabled),button:not(:disabled)')];
                const first = controls[0], last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        });
        window.addEventListener('keydown', event => {
            if (this.locked && this.authenticated && !this.gate.contains(event.target)) {
                event.preventDefault(); event.stopImmediatePropagation(); this.password?.focus();
            }
        }, true);
        window.addEventListener('storage', event => {
            if (this.ownerId && (event.key === privacyLockKey(this.ownerId) || event.key === null)) {
                this.readRecord(); this.render();
            }
        });
    }

    readRecord() {
        try { this.record = parsePrivacyLock(localStorage.getItem(privacyLockKey(this.ownerId))); }
        catch { this.record = { invalid: true, locked: true }; }
    }

    onAccessState(authenticated, ownerId) {
        this.authenticated = authenticated;
        if (ownerId && this.ownerId !== ownerId) {
            this.closedDialogs = [];
            this.settings?.close();
        }
        this.ownerId = ownerId || null;
        if (this.ownerId) this.readRecord();
        else this.record = null;
        this.render();
    }

    // Only an explicit, successful account-password login can reset a forgotten
    // local lock. TOKEN_REFRESHED / SIGNED_IN session reconfirmations cannot.
    accountLogin(ownerId) {
        if (!ownerId) return;
        let raw;
        try { raw = localStorage.getItem(privacyLockKey(ownerId)); }
        catch { return; }
        if (raw !== null) {
            try {
                const record = parsePrivacyLock(raw);
                if (!record.locked) return;
            } catch { /* A fresh account login also repairs a corrupt local record. */ }
            try { localStorage.removeItem(privacyLockKey(ownerId)); } catch { return; }
        }
        if (this.ownerId === ownerId) { this.record = null; this.render(); }
    }

    render() {
        const shouldLock = this.authenticated && this.record?.locked === true;
        if (shouldLock && !this.locked) {
            this.previousFocus = document.activeElement;
            this.closedDialogs = [...document.querySelectorAll('dialog[open]')];
            this.closedDialogs.forEach(dialog => dialog.close());
        }
        const wasLocked = this.locked;
        this.locked = shouldLock;
        this.gate?.classList.toggle('hidden', !shouldLock);
        document.body.classList.toggle('privacy-locked', shouldLock);
        const main = document.querySelector('main.container');
        if (main) main.inert = shouldLock;
        if (shouldLock) {
            document.getElementById('privacy-unlock-submit').disabled = Boolean(this.record.invalid) || this.busy;
            if (this.record.invalid) this.error('No se pudo leer la configuración local. Cerrá sesión y volvé a ingresar con tu cuenta.');
            if (!wasLocked) requestAnimationFrame(() => this.password?.focus());
        } else if (wasLocked && this.authenticated) {
            this.closedDialogs.filter(dialog => dialog.isConnected).forEach(dialog => dialog.showModal());
            this.closedDialogs = [];
            if (this.previousFocus?.isConnected) this.previousFocus.focus();
        }
        document.getElementById('privacy-lock-configure').textContent = this.record ? 'Cambiar clave de bloqueo' : 'Configurar bloqueo';
    }

    error(message = '', settings = false) {
        const target = document.getElementById(settings ? 'privacy-lock-error' : 'privacy-unlock-error');
        target.textContent = message; target.classList.toggle('hidden', !message);
    }

    async requestLock() {
        if (!this.authenticated || this.busy || this.locked || this.confirmingLock) return;
        this.readRecord();
        if (!this.record) return this.configure();
        const ownerId = this.ownerId;
        this.confirmingLock = true;
        try {
            if (!await this.app.confirmAction({
                title: 'Bloquear LifeCycle',
                message: '¿Seguro que querés bloquear la aplicación? Necesitarás tu clave para volver a entrar. Las notificaciones seguirán activas.',
                confirmLabel: 'Bloquear',
                cancelLabel: 'Cancelar',
                tone: 'info',
                icon: 'ph-lock-key'
            })) return;
            // A queued confirmation must not affect another account or restore
            // a lock configuration changed in a second tab while it was open.
            if (!this.authenticated || this.busy || this.locked || this.ownerId !== ownerId) return;
            this.readRecord();
            if (!this.record) return;
            if (!this.record.invalid) localStorage.setItem(privacyLockKey(ownerId), JSON.stringify({ ...this.record, locked: true }));
            this.readRecord(); this.error(); this.render();
        } catch { void this.app.showMessage({ title: 'No se pudo guardar el bloqueo',
            message: 'El navegador no permite guardar la configuración local. Revisá el almacenamiento antes de dejar la app abierta.', tone: 'warning' }); }
        finally { this.confirmingLock = false; }
    }

    configure() {
        if (!this.authenticated || this.locked || this.busy) return;
        this.clearSettings();
        document.getElementById('privacy-lock-current-group').classList.toggle('hidden', !this.record);
        document.getElementById('privacy-lock-current').required = Boolean(this.record);
        document.getElementById('privacy-lock-save').textContent = this.record ? 'Guardar nueva clave' : 'Habilitar y bloquear';
        this.settings.showModal();
        document.getElementById(this.record ? 'privacy-lock-current' : 'privacy-lock-new').focus();
    }

    clearSettings() {
        document.getElementById('privacy-lock-form')?.reset(); this.error('', true);
    }

    setBusy(busy) {
        this.busy = busy;
        this.gate.querySelectorAll('button,input').forEach(control => { control.disabled = busy; });
        this.settings.querySelectorAll('button,input').forEach(control => { control.disabled = busy; });
    }

    async saveSettings() {
        if (this.busy || !this.authenticated) return;
        const ownerId = this.ownerId;
        const next = document.getElementById('privacy-lock-new').value;
        const confirm = document.getElementById('privacy-lock-confirm').value;
        if (next !== confirm) return this.error('Las claves no coinciden.', true);
        this.setBusy(true); this.error('', true);
        try {
            const previousVerifier = this.record?.verifier;
            if (this.record && !await verifyPrivacyLock(ownerId, document.getElementById('privacy-lock-current').value, this.record)) {
                return this.error('La clave actual no es correcta.', true);
            }
            const record = await createPrivacyLock(ownerId, next);
            if (ownerId !== this.ownerId || !this.authenticated) return;
            this.readRecord();
            if (previousVerifier !== this.record?.verifier) return this.error('La clave cambió en otra pestaña. Cerrá este formulario y reintentá.', true);
            const initial = !this.record;
            localStorage.setItem(privacyLockKey(ownerId), JSON.stringify({ ...record, locked: initial || this.record?.locked === true }));
            this.readRecord(); this.settings.close(); this.render();
        } catch (error) { this.error(error.message || 'No se pudo guardar la clave local.', true); }
        finally { this.setBusy(false); }
    }

    async unlock() {
        if (this.busy || !this.record || this.record.invalid) return;
        const ownerId = this.ownerId, record = this.record;
        this.setBusy(true); this.error();
        try {
            if (!await verifyPrivacyLock(ownerId, this.password.value, record)) return this.error('Clave de bloqueo incorrecta.');
            if (ownerId !== this.ownerId || !this.authenticated) return;
            // Do not overwrite a password changed in a second tab during PBKDF2.
            this.readRecord();
            if (this.record?.verifier !== record.verifier) return this.error('La clave cambió en otra pestaña. Usá la nueva.');
            localStorage.setItem(privacyLockKey(ownerId), JSON.stringify({ ...record, locked: false }));
            this.readRecord(); this.render();
        } catch { this.error('No se pudo desbloquear. Revisá el almacenamiento del navegador.'); }
        finally { this.password.value = ''; this.setBusy(false); }
    }

    async signOut() {
        if (this.busy) return;
        this.setBusy(true); this.error();
        try {
            const auth = this.app.auth;
            if ((auth.pendingSyncKeys.size || auth.activeSyncPromise) && !await auth.flushPendingKeySync(true)) {
                return this.error('Hay cambios pendientes de sincronizar. Conectate a internet y reintentá, o desbloqueá para descargar un backup.');
            }
            const { error } = await auth.supabase.auth.signOut();
            if (error) throw error;
            auth.clearLocalUserData();
            location.reload();
        } catch { this.error('No se pudo cerrar la sesión. Reintentá con conexión.'); }
        finally { this.setBusy(false); }
    }
}
