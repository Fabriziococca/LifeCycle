/**
 * transcription-utils.mjs
 * Utilidades para modelo de datos de transcripciones, carpetas,
 * búsqueda, edición, exportación y limpieza.
 * Fase E (Tandas 19, 22, 23, 25).
 */

export const TRANSCRIPTION_STORAGE_KEY = 'lifecycle_transcriptions';
export const TRANSCRIPTION_SCHEMA_VERSION = 1;
export const MAX_STORED_TRANSCRIPTIONS = 100;

export const DEFAULT_TRANSCRIPTION_FOLDERS = Object.freeze([
    { id: 'folder_general', name: 'General', icon: 'ph-folder' },
    { id: 'folder_reuniones', name: 'Reuniones', icon: 'ph-users' },
    { id: 'folder_ideas', name: 'Ideas y Notas', icon: 'ph-lightbulb' },
    { id: 'folder_trabajo', name: 'Trabajo Freelance', icon: 'ph-briefcase' }
]);

export const SUPPORTED_AUDIO_EXTENSIONS = Object.freeze([
    '.webm', '.ogg', '.mp3', '.wav', '.m4a', '.mp4', '.aac'
]);

/**
 * Normaliza una transcripción garantizando integridad de campos.
 *
 * @param {Object} raw
 * @param {Date} [now=new Date()]
 * @returns {Object|null}
 */
export function normalizeTranscription(raw, now = new Date()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const id = String(raw.id || '').trim() || `trans_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const title = String(raw.title || '').trim() || 'Nota de voz sin título';
    const folderId = String(raw.folderId || 'folder_general').trim();
    const createdAt = raw.createdAt || new Date(now).toISOString();
    const durationSeconds = Math.max(0, parseInt(raw.durationSeconds, 10) || 0);
    const sizeBytes = Math.max(0, parseInt(raw.sizeBytes, 10) || 0);
    const mimeType = String(raw.mimeType || 'audio/webm').trim();
    const status = ['completed', 'processing', 'failed', 'recording'].includes(raw.status)
        ? raw.status
        : 'completed';

    const rawText = String(raw.rawText || '').trim();
    const editedText = raw.editedText ? String(raw.editedText).trim() : null;
    const summary = raw.summary ? String(raw.summary).trim() : null;
    const language = String(raw.language || 'es-AR').trim();
    const tags = Array.isArray(raw.tags) ? raw.tags.map(t => String(t).trim()).filter(Boolean) : [];

    return {
        id,
        title,
        folderId,
        createdAt,
        updatedAt: raw.updatedAt || createdAt,
        durationSeconds,
        sizeBytes,
        mimeType,
        status,
        rawText,
        editedText,
        summary,
        language,
        tags
    };
}

/**
 * Normaliza el registro completo de transcripciones y carpetas.
 *
 * @param {Object} value
 * @returns {{ version: number, folders: Object[], transcriptions: Object[] }}
 */
export function normalizeTranscriptionRegistry(value) {
    const hasRegistry = value && typeof value === 'object' && !Array.isArray(value);
    const rawFolders = hasRegistry && Array.isArray(value.folders)
        ? value.folders
        : DEFAULT_TRANSCRIPTION_FOLDERS;

    const rawItems = hasRegistry && Array.isArray(value.transcriptions)
        ? value.transcriptions
        : (Array.isArray(value) ? value : []);

    const transcriptions = [];
    const seenIds = new Set();

    for (const raw of rawItems) {
        const item = normalizeTranscription(raw);
        if (item && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            transcriptions.push(item);
        }
    }

    // Ordenar de más reciente a más antiguo
    transcriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Aplicar límite máximo para proteger localStorage
    if (transcriptions.length > MAX_STORED_TRANSCRIPTIONS) {
        transcriptions.length = MAX_STORED_TRANSCRIPTIONS;
    }

    return {
        version: TRANSCRIPTION_SCHEMA_VERSION,
        folders: rawFolders.map(f => ({
            id: String(f.id || '').trim(),
            name: String(f.name || '').trim(),
            icon: String(f.icon || 'ph-folder').trim()
        })).filter(f => Boolean(f.id && f.name)),
        transcriptions
    };
}

/**
 * Busca transcripciones por texto en título, contenido o resumen.
 *
 * @param {Object[]} transcriptions
 * @param {string} query
 * @returns {Object[]}
 */
export function searchTranscriptions(transcriptions = [], query = '') {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return transcriptions;

    return transcriptions.filter(t => {
        const titleMatch = t.title.toLowerCase().includes(q);
        const textMatch = (t.editedText || t.rawText).toLowerCase().includes(q);
        const summaryMatch = t.summary ? t.summary.toLowerCase().includes(q) : false;
        const tagMatch = t.tags.some(tag => tag.toLowerCase().includes(q));
        return titleMatch || textMatch || summaryMatch || tagMatch;
    });
}

/**
 * Exporta una transcripción en formato texto plano (.txt).
 *
 * @param {Object} transcription
 * @returns {string}
 */
export function exportAsPlainText(transcription) {
    const text = transcription.editedText || transcription.rawText || '(Sin contenido transcripto)';
    const dateStr = new Date(transcription.createdAt).toLocaleString('es-AR');
    const header = [
        `Título: ${transcription.title}`,
        `Fecha: ${dateStr}`,
        `Duración: ${Math.floor(transcription.durationSeconds / 60)}m ${transcription.durationSeconds % 60}s`,
        '----------------------------------------',
        ''
    ].join('\n');

    let output = header + text;
    if (transcription.summary) {
        output += `\n\n----------------------------------------\nRESUMEN Y APUNTES:\n${transcription.summary}`;
    }
    return output;
}

/**
 * Exporta una transcripción en formato Markdown (.md).
 *
 * @param {Object} transcription
 * @returns {string}
 */
export function exportAsMarkdown(transcription) {
    const text = transcription.editedText || transcription.rawText || '(Sin contenido transcripto)';
    const dateStr = new Date(transcription.createdAt).toLocaleString('es-AR');

    let md = [
        `# ${transcription.title}`,
        '',
        `* **Fecha:** ${dateStr}`,
        `* **Duración:** ${Math.floor(transcription.durationSeconds / 60)}m ${transcription.durationSeconds % 60}s`,
        `* **Idioma:** ${transcription.language}`,
        '',
        '## Transcripción Completa',
        '',
        text,
        ''
    ].join('\n');

    if (transcription.summary) {
        md += `## Resumen y Puntos Clave\n\n${transcription.summary}\n`;
    }

    return md;
}

/**
 * Formatea duración en segundos a minutos y segundos legibles (ej: 03:25).
 *
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds = 0) {
    const totalSec = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
