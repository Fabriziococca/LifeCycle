import { AUDIO_CONSTRAINTS } from './audio-transcription-config.mjs';
import {
    SUPPORTED_MEDIA_EXTENSIONS,
    normalizeMimeType
} from './transcription-utils.mjs';

export function validateMediaFile(file) {
    if (!file) return { valid: false, error: 'No se seleccionó ningún archivo.' };
    const name = String(file.name || '').toLowerCase();
    const extensionAllowed = SUPPORTED_MEDIA_EXTENSIONS.some(extension => name.endsWith(extension));
    const mimeType = normalizeMimeType(file.type);
    if (!extensionAllowed || !mimeType) {
        return {
            valid: false,
            error: `Formato no admitido. Usá ${SUPPORTED_MEDIA_EXTENSIONS.join(', ')}.`
        };
    }
    if (!Number.isFinite(file.size) || file.size < 1) {
        return { valid: false, error: 'El archivo está vacío o no puede leerse.' };
    }
    if (file.size > AUDIO_CONSTRAINTS.maxImportedFileBytes) {
        return {
            valid: false,
            error: 'El archivo supera 50 MB. Las grabaciones largas deben realizarse desde LifeCycle para guardarlas en fragmentos recuperables.'
        };
    }
    return { valid: true, mimeType };
}

// Backwards-compatible name for callers outside the Transcriptions module.
export const validateAudioFile = validateMediaFile;

export async function readMediaDuration(file) {
    if (!file || typeof document === 'undefined') return 0;
    const element = document.createElement(file.type?.startsWith('video/') ? 'video' : 'audio');
    element.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    try {
        const duration = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('No se pudo leer la duración.')), 10_000);
            element.onloadedmetadata = () => {
                clearTimeout(timeout);
                resolve(Number.isFinite(element.duration) ? element.duration : 0);
            };
            element.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('El formato multimedia no pudo analizarse.'));
            };
            element.src = objectUrl;
        });
        return Math.max(0, Math.round(duration * 1000));
    } finally {
        element.removeAttribute('src');
        element.load?.();
        URL.revokeObjectURL(objectUrl);
    }
}
