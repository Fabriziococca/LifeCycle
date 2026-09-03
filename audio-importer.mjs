/**
 * audio-importer.mjs
 * Validador e importador de archivos de audio/video existentes para transcripción.
 * Fase E (Tanda 20B).
 */

import { AUDIO_CONSTRAINTS } from './audio-transcription-config.mjs';
import { SUPPORTED_AUDIO_EXTENSIONS } from './transcription-utils.mjs';

/**
 * Valida si un archivo de audio/video cumple con las restricciones de tamaño y formato.
 *
 * @param {File|{ name: string, size: number, type: string }} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAudioFile(file) {
    if (!file) {
        return { valid: false, error: 'No se seleccionó ningún archivo.' };
    }

    const name = String(file.name || '').toLowerCase();
    const hasValidExt = SUPPORTED_AUDIO_EXTENSIONS.some(ext => name.endsWith(ext));
    const isAudioOrVideoType = file.type?.startsWith('audio/') || file.type?.startsWith('video/');

    if (!hasValidExt && !isAudioOrVideoType) {
        return {
            valid: false,
            error: `Formato no soportado. Formatos admitidos: ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}`
        };
    }

    if (file.size > AUDIO_CONSTRAINTS.maxFileSizeBytes) {
        const maxMB = Math.round(AUDIO_CONSTRAINTS.maxFileSizeBytes / (1024 * 1024));
        const fileMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `El archivo (${fileMB} MB) supera el límite máximo permitido de ${maxMB} MB.`
        };
    }

    return { valid: true };
}

/**
 * Convierte un Blob o File a base64 para envío a la API de Gemini.
 *
 * @param {Blob|File} blob
 * @returns {Promise<string>} base64 data string (sin encabezado data:mime;base64,)
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                const base64 = result.split(',')[1] || result;
                resolve(base64);
            } else {
                reject(new Error('Error al convertir audio a base64.'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
