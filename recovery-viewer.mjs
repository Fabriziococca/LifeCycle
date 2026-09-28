import { listRecoveryVaults, decryptRecoverySnapshot } from './recovery-vault.mjs';

const $ = id => document.getElementById(id);
let vaults = [], opened = null, lockTimer, generation = 0;
const titles = {
    hygiene_tracker_data: 'Tarjetas, registros e historial', groomingData_v2: 'Cuidado personal',
    lensDate: 'Lentes · fecha de apertura', lensesHistory: 'Lentes · historial', lensesStartTime: 'Lentes · inicio de uso',
    solutionDate: 'Solución · apertura', caseDate: 'Estuche · cambio', lensStock: 'Lentes · stock',
    tareas_list: 'Tareas (incluidas las completadas)', lifecycle_subscriptions: 'Suscripciones',
    projectPulseData: 'Proyectos activos', projectPulseHistory: 'Historial de proyectos',
    finanzasData: 'Finanzas', alerts_config: 'Configuración de recordatorios', health_medical_data: 'Controles médicos'
};
function message(text) { $('recovery-message').textContent = text; }
function selected() { return vaults[Number($('vault-select').value)]; }
function download(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function lock() {
    generation++;
    opened = null; clearTimeout(lockTimer); $('read-view').hidden = true;
    $('recovery-data').replaceChildren(); $('vault-password').value = ''; $('recovery-search').value = '';
}
function versions() {
    lock(); $('snapshot-select').replaceChildren();
    (selected()?.snapshots || []).forEach((snapshot, index) => {
        const option = new Option(`${new Date(snapshot.createdAt).toLocaleString()}${index === 0 ? ' · más reciente' : ''}`, String(index));
        $('snapshot-select').append(option);
    });
    $('download-encrypted').disabled = !selected();
}
function list() {
    $('vault-select').replaceChildren();
    vaults.forEach((vault, index) => $('vault-select').append(new Option(`Copia ${index + 1} · cuenta …${String(vault.ownerId).slice(-6)}`, String(index))));
    versions();
}
function render() {
    $('recovery-data').replaceChildren();
    const query = $('recovery-search').value.trim().toLocaleLowerCase();
    for (const [key, value] of Object.entries(opened?.data || {})) {
        if (value === null) continue;
        const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        const title = titles[key] || key;
        if (query && !`${title} ${text}`.toLocaleLowerCase().includes(query)) continue;
        const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
        summary.textContent = title; pre.textContent = text; details.open = Boolean(query) || key === 'lensDate';
        details.append(summary, pre); $('recovery-data').append(details);
    }
}
$('vault-select').addEventListener('change', versions);
$('snapshot-select').addEventListener('change', lock);
// Keep the password only for the duration of the decrypt operation.
$('unlock-form').onsubmit = async event => {
    event.preventDefault();
    const password = $('vault-password').value;
    const vault = selected(), version = Number($('snapshot-select').value);
    lock();
    if (!vault) { message('No hay copia local. Primero habilitala en Cuenta, o abrí un archivo cifrado.'); return; }
    const unlockGeneration = generation;
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
        const data = await decryptRecoverySnapshot(vault, password, version);
        if (generation !== unlockGeneration || selected() !== vault || Number($('snapshot-select').value) !== version) return;
        opened = data;
        $('snapshot-info').textContent = `Copia del ${new Date(opened.exportDate).toLocaleString()}. No son datos en vivo.${opened.pendingCloudChanges ? ' Incluye cambios que todavía estaban pendientes de sincronización.' : ''} Los archivos adjuntos externos requieren acceso al proveedor.`;
        $('read-view').hidden = false; render(); message('Copia descifrada localmente. Se bloqueará al salir de la pestaña o tras 10 minutos.');
        lockTimer = setTimeout(lock, 10 * 60_000);
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
};
$('recovery-search').addEventListener('input', render);
$('lock-vault').addEventListener('click', lock);
document.addEventListener('visibilitychange', () => { if (document.hidden) lock(); });
window.addEventListener('pagehide', lock);
$('download-encrypted').addEventListener('click', () => { if (selected()) download(selected(), 'LifeCycle_copia_cifrada.json'); });
$('download-plain').addEventListener('click', () => {
    if (!opened) return;
    const { appName, backupVersion, exportDate, data } = opened;
    download({ appName, backupVersion, exportDate, data }, 'LifeCycle_Backup_recuperado.json');
});
$('vault-file').addEventListener('change', async event => {
    lock();
    try {
        const file = event.target.files[0]; if (!file) return;
        if (file.size > 90 * 1024 * 1024) throw new Error('El archivo supera 90 MB.');
        const vault = JSON.parse(await file.text());
        if (vault.version !== 1 || typeof vault.ownerId !== 'string' || !vault.publicKey || !vault.protectedKey || !Array.isArray(vault.snapshots) || vault.snapshots.length > 3) throw new Error('Archivo cifrado incompatible.');
        vaults = [vault]; list(); message('Archivo abierto para consulta; no se guardó ni se importó en la aplicación.');
    } catch (error) { message(error.message); }
    event.target.value = '';
});
try {
    vaults = await listRecoveryVaults(); list();
    message(vaults.length ? 'Elegí una copia e ingresá tu clave local.' : 'Este navegador todavía no tiene una copia cifrada. Habilitala en Cuenta → Datos y aplicación cuando puedas entrar, o abrí un archivo cifrado.');
} catch { message('El almacenamiento local no está disponible. Podés abrir un archivo cifrado descargado.'); }
