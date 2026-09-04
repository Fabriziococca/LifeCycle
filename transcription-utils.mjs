export const TRANSCRIPTION_BUCKET = 'transcription-audio';
export const TRANSCRIPTION_CACHE_DB = 'lifecycle_transcription_cache_v2';
export const TRANSCRIPTION_CACHE_VERSION = 1;

export const DEFAULT_TRANSCRIPTION_FOLDERS = Object.freeze([
    { id: null, name: 'Bandeja de entrada', icon: 'ph-tray' }
]);

export const SUPPORTED_AUDIO_EXTENSIONS = Object.freeze([
    '.webm', '.ogg', '.opus', '.mp3', '.wav', '.m4a', '.aac', '.flac', '.aiff'
]);

export const SUPPORTED_VIDEO_EXTENSIONS = Object.freeze([
    '.mp4', '.mov', '.mkv', '.webm', '.mpeg', '.mpg', '.m4v'
]);

export const SUPPORTED_MEDIA_EXTENSIONS = Object.freeze([
    ...new Set([...SUPPORTED_AUDIO_EXTENSIONS, ...SUPPORTED_VIDEO_EXTENSIONS])
]);

export const SUPPORTED_AUDIO_MIME_TYPES = Object.freeze([
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
    'audio/aac', 'audio/flac', 'audio/aiff', 'audio/opus'
]);

export const SUPPORTED_VIDEO_MIME_TYPES = Object.freeze([
    'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm',
    'video/mpeg', 'video/x-m4v'
]);

export const SUPPORTED_MEDIA_MIME_TYPES = Object.freeze([
    ...SUPPORTED_AUDIO_MIME_TYPES,
    ...SUPPORTED_VIDEO_MIME_TYPES
]);

const AUDIO_MIME_ALIASES = Object.freeze({
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'audio/mp3': 'audio/mpeg',
    'application/ogg': 'audio/ogg',
    'video/x-m4v': 'video/x-m4v'
});

const STATUS_LABELS = Object.freeze({
    draft: 'Preparando',
    recording: 'Grabando',
    uploading: 'Subiendo',
    uploaded: 'Listo para transcribir',
    queued: 'En cola',
    processing: 'Transcribiendo',
    completed: 'Completada',
    partial: 'Incompleta',
    failed: 'Requiere atención',
    canceled: 'Cancelada'
});

export function formatDuration(seconds = 0) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remaining = total % 60;
    return hours > 0
        ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

export function formatBytes(bytes = 0) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${Math.round(value)} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

export function getTranscriptionStatusLabel(status) {
    return STATUS_LABELS[status] || 'Desconocido';
}

export function getFileExtension(name = '', mimeType = '') {
    const match = String(name).toLowerCase().match(/\.([a-z0-9]{2,5})$/);
    if (match && SUPPORTED_MEDIA_EXTENSIONS.includes(`.${match[1]}`)) return match[1];
    return ({
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/aac': 'aac',
        'audio/flac': 'flac',
        'audio/aiff': 'aiff',
        'audio/opus': 'opus',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/x-matroska': 'mkv',
        'video/webm': 'webm',
        'video/mpeg': 'mpeg',
        'video/x-m4v': 'm4v'
    })[String(mimeType).split(';')[0].toLowerCase()] || 'bin';
}

export function normalizeMimeType(value = '') {
    const rawMimeType = String(value).split(';')[0].trim().toLowerCase();
    const mimeType = AUDIO_MIME_ALIASES[rawMimeType] || rawMimeType;
    return SUPPORTED_MEDIA_MIME_TYPES.includes(mimeType) ? mimeType : null;
}

export function isVideoMimeType(value = '') {
    return SUPPORTED_VIDEO_MIME_TYPES.includes(String(value).split(';')[0].trim().toLowerCase());
}

export async function sha256Blob(blob) {
    if (!blob || typeof blob.arrayBuffer !== 'function' || !globalThis.crypto?.subtle) {
        throw new TypeError('No se puede calcular la integridad del fragmento.');
    }
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(digest)]
        .map(value => value.toString(16).padStart(2, '0'))
        .join('');
}

export function normalizeSessionRow(row, documents = []) {
    if (!row || typeof row !== 'object') return null;
    const byKind = Object.fromEntries(
        (documents || [])
            .filter(document => document?.session_id === row.id)
            .map(document => [document.kind, document])
    );
    return {
        id: String(row.id || ''),
        folderId: row.folder_id || null,
        title: String(row.title || 'Transcripción sin título'),
        sourceType: row.source_type === 'import' ? 'import' : 'recording',
        status: String(row.status || 'draft'),
        language: String(row.language || 'es-AR'),
        context: String(row.context || ''),
        autoProcess: row.auto_process !== false,
        mimeType: row.mime_type || null,
        durationSeconds: Math.max(0, Math.round((Number(row.duration_ms) || 0) / 1000)),
        totalBytes: Math.max(0, Number(row.total_bytes) || 0),
        expectedChunks: Math.max(0, Number(row.expected_chunks) || 0),
        completedChunks: Math.max(0, Number(row.completed_chunks) || 0),
        errorCode: row.error_code || null,
        errorMessage: row.error_message || null,
        audioDeleteAfter: row.audio_delete_after || null,
        audioDeletedAt: row.audio_deleted_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        completedAt: row.completed_at || null,
        transcript: byKind.transcript?.content || '',
        transcriptEdited: byKind.transcript?.user_edited === true,
        summary: byKind.summary?.content || '',
        notes: byKind.notes?.content || ''
    };
}

export function combineChunkTranscripts(chunks = []) {
    return [...chunks]
        .sort((a, b) => Number(a.sequence_number) - Number(b.sequence_number))
        .map(chunk => String(chunk.transcript_text || '').trim())
        .filter(Boolean)
        .join('\n\n');
}

export function searchTranscriptions(sessions = [], query = '') {
    const term = String(query || '').trim().toLocaleLowerCase('es');
    if (!term) return sessions;
    return sessions.filter(session => [
        session.title,
        session.transcript,
        session.summary,
        session.notes
    ].some(value => String(value || '').toLocaleLowerCase('es').includes(term)));
}

function safeDateLabel(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-AR');
}

export function exportAsPlainText(session) {
    const body = session.transcript || '(Sin transcripción completa)';
    return [
        `Título: ${session.title}`,
        `Fecha: ${safeDateLabel(session.createdAt)}`,
        `Duración: ${formatDuration(session.durationSeconds)}`,
        '',
        body,
        session.summary ? `\n\nRESUMEN\n${session.summary}` : '',
        session.notes ? `\n\nAPUNTES\n${session.notes}` : ''
    ].filter(value => value !== '').join('\n');
}

export function exportAsMarkdown(session) {
    const body = session.transcript || '(Sin transcripción completa)';
    return [
        `# ${session.title}`,
        '',
        `- **Fecha:** ${safeDateLabel(session.createdAt)}`,
        `- **Duración:** ${formatDuration(session.durationSeconds)}`,
        `- **Idioma:** ${session.language}`,
        '',
        '## Transcripción completa',
        '',
        body,
        session.summary ? `\n## Resumen\n\n${session.summary}` : '',
        session.notes ? `\n## Apuntes\n\n${session.notes}` : ''
    ].filter(value => value !== '').join('\n');
}

export function createDownloadFilename(title, extension) {
    const base = String(title || 'transcripcion')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'transcripcion';
    const safeExtension = String(extension || '').replace(/^\.+/, '');
    return safeExtension ? `${base}.${safeExtension}` : base;
}
