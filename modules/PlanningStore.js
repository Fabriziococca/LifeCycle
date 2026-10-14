import { readPlanning, validatePlanning, PLANNING_KEYS } from '../planning-utils.mjs';

// This store writes only its document through a revision-checked RPC. It never
// queues an unconfirmed snapshot through the generic, whole-key sync path.
export class PlanningStore {
    constructor(app, key) { this.app = app; this.key = key; this.busy = false; }
    get value() { return readPlanning(localStorage.getItem(this.key), this.key); }
    async save(value, expectedRevision = this.value.revision) {
        if (this.busy) throw new Error('Esperá a que termine el guardado.');
        const auth = this.app.auth, user = auth?.user?.id;
        if (!user || auth.readyUserId !== user || !auth.supabase) throw new Error('Conectate e iniciá sesión para guardar.');
        if (this.value.revision !== expectedRevision) throw new Error('Este seguimiento cambió en otra pantalla. Volvé a abrir el formulario.');
        const next = validatePlanning({ ...structuredClone(value), revision: expectedRevision + 1 }, this.key);
        this.busy = true;
        let writing = false;
        const generation = auth.syncGeneration;
        const release = () => {
            if (!writing) return;
            writing = false;
            if (auth.syncGeneration !== generation) return;
            auth.planningWriteCount = Math.max(0, (auth.planningWriteCount || 0) - 1);
            auth.localEditGeneration = (auth.localEditGeneration || 0) + 1;
        };
        try {
            if (!await auth.flushPendingKeySync()) throw new Error('Primero deben sincronizarse los cambios pendientes de la aplicación.');
            if (auth.user?.id !== user || auth.readyUserId !== user) throw new Error('La sesión cambió.');
            auth.planningWriteCount = (auth.planningWriteCount || 0) + 1;
            auth.localEditGeneration = (auth.localEditGeneration || 0) + 1;
            writing = true;
            const { data, error } = await auth.supabase.rpc('save_lifecycle_planning', {
                p_key: this.key, p_expected_revision: expectedRevision, p_value: next
            });
            if (error) {
                release();
                if (String(error.code) === '40001') {
                    await auth.checkAndSyncData({ force: true });
                    throw new Error('Hay una versión más reciente en la nube. Actualizamos la pantalla; revisá los datos antes de volver a guardar.');
                }
                throw new Error('No se confirmó el guardado. Conservá este formulario y verificá la conexión antes de reintentar.');
            }
            if (auth.user?.id !== user || auth.readyUserId !== user) throw new Error('La sesión cambió durante el guardado.');
            if (!data?.workspace) throw new Error('El servidor no confirmó el seguimiento. Recargá antes de reintentar.');
            const confirmed = validatePlanning(data.workspace, this.key);
            const cloudRevision = Number(data.documentRevision);
            if (!Number.isSafeInteger(cloudRevision) || cloudRevision < 1) throw new Error('No se confirmó la revisión de la nube. Recargá antes de reintentar.');
            auth.minimumCloudRevision = Math.max(auth.minimumCloudRevision || 0, cloudRevision);
            const restoring = auth.isRestoring;
            auth.isRestoring = true;
            try { localStorage.setItem(this.key, JSON.stringify(confirmed)); }
            finally { auth.isRestoring = restoring; }
            auth.cloudRevision = null; auth.appliedCloudRevision = null;
            this.app.recovery?.scheduleSnapshot();
            this.app.saylor?.render(); this.app.faculty?.render();
            this.app.finanzas?.render(); this.app.notificationsCenter?.updateBadge();
            return confirmed;
        } finally { release(); this.busy = false; }
    }
}

export function planningDialog(app, title, html, onSave) {
    const existing = document.getElementById('planning-dialog');
    if (existing) return; // Do not discard another unsaved form.
    const previous = document.activeElement, user = app.auth?.user?.id;
    const layer = document.createElement('div');
    layer.id = 'planning-dialog'; layer.className = 'custom-tracker-dialog planning-dialog';
    layer.innerHTML = `<div class="custom-tracker-dialog-card" role="dialog" aria-modal="true" aria-labelledby="planning-dialog-title">
        <header class="planning-heading"><h2 id="planning-dialog-title"></h2><button type="button" class="btn btn-secondary" data-close aria-label="Cerrar">×</button></header>
        <form>${html}<p class="planning-error" role="alert"></p><footer class="planning-actions"><button type="button" class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></footer></form></div>`;
    layer.querySelector('h2').textContent = title;
    document.body.append(layer); document.body.classList.add('modal-open');
    let saving = false;
    const close = () => { if (saving) return; layer.remove(); document.body.classList.remove('modal-open'); previous?.isConnected && previous.focus(); };
    layer.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
    layer.addEventListener('keydown',e=>{
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key !== 'Tab') return;
        const elements = [...layer.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled && x.offsetParent !== null);
        const first = elements[0], last = elements.at(-1);
        if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first?.focus(); }
    });
    layer.querySelector('form').addEventListener('submit',async e=>{
        e.preventDefault(); if(saving) return;
        const error = layer.querySelector('[role=alert]'); error.textContent='';
        if (!user || app.auth?.user?.id !== user) { error.textContent='La sesión cambió. Cerrá el formulario.'; return; }
        saving = true;
        layer.querySelectorAll('button').forEach(b=>b.disabled=true);
        try { await onSave(new FormData(e.target)); saving=false; close(); app.showToast?.('Guardado y sincronizado.'); }
        catch(err) { error.textContent=err.message; }
        finally { saving=false; layer.querySelectorAll('button').forEach(b=>b.disabled=false); }
    });
    layer.querySelector('input,select,textarea,button').focus();
    return layer;
}

export function planningRead(key) {
    if (!PLANNING_KEYS.includes(key)) throw new Error('Seguimiento no válido.');
    return readPlanning(localStorage.getItem(key),key);
}
