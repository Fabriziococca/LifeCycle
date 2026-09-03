/**
 * audio-transcription-config.mjs
 * Configuración de límites operativos de Gemini Free Tier, privacidad,
 * formatos de audio y cuotas para LifeCycle.
 * Fase D (Tandas 16A, 16B, 18A).
 */

export const GEMINI_CONFIG = Object.freeze({
    model: 'gemini-1.5-flash',
    tier: 'free',
    maxRPM: 15,            // Solicitudes por minuto
    maxRPD: 1500,          // Solicitudes por día
    maxTPM: 1000000,       // Tokens por minuto
    costPerMonthUSD: 0.00  // Política estricta costo $0
});

export const AUDIO_CONSTRAINTS = Object.freeze({
    preferredMimeType: 'audio/webm;codecs=opus',
    fallbackMimeTypes: Object.freeze([
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
    ]),
    targetBitrate: 32000,          // 32 kbps mono (voz óptima)
    sampleRate: 16000,             // 16 kHz
    channels: 1,                   // Mono
    maxDurationSeconds: 1800,      // 30 minutos máximo por nota
    maxFileSizeBytes: 25 * 1024 * 1024, // 25 MB techo estricto
    chunkSizeBytes: 1024 * 1024,   // 1 MB por fragmento en subidas por partes
    ephemeralRetentionHours: 24    // Purgar audio del servidor en 24h tras transcribir
});

export const TRANSCRIPTION_PRIVACY_NOTICE = Object.freeze({
    title: 'Privacidad y Procesamiento de Voz',
    text: 'Las notas de voz se envían a la API gratuita de Google Gemini exclusivamente para generar el texto transcripto. El archivo de audio se elimina del servidor tras la transcripción y no se comercializa ni se utiliza para fines externos.',
    consentStorageKey: 'lifecycle_transcription_consent',
    required: true
});

/**
 * Evalúa el nivel de alerta según el uso acumulado de la cuota gratuita de Gemini.
 *
 * @param {number} dailyRequests
 * @param {number} minuteRequests
 * @returns {{ level: 'ok'|'warning_70'|'restricted_85'|'paused_95', allowed: boolean, message: string }}
 */
export function evaluateQuotaUsage(dailyRequests = 0, minuteRequests = 0) {
    const dailyPct = (dailyRequests / GEMINI_CONFIG.maxRPD) * 100;
    const minutePct = (minuteRequests / GEMINI_CONFIG.maxRPM) * 100;

    if (dailyPct >= 95 || minutePct >= 95) {
        return {
            level: 'paused_95',
            allowed: false,
            message: 'Se ha alcanzado el 95% de la cuota gratuita de transcripción. Pausa de seguridad activa para evitar costos.'
        };
    }
    if (dailyPct >= 85 || minutePct >= 85) {
        return {
            level: 'restricted_85',
            allowed: true,
            message: 'Cuota al 85%. Se limita la duración de notas y se espacian las solicitudes a Gemini.'
        };
    }
    if (dailyPct >= 70 || minutePct >= 70) {
        return {
            level: 'warning_70',
            allowed: true,
            message: 'Consumo al 70% de la capacidad diaria de Gemini.'
        };
    }
    return {
        level: 'ok',
        allowed: true,
        message: 'Cuota en estado óptimo.'
    };
}

/**
 * Genera el prompt estructurado para la transcripción en Gemini.
 *
 * @param {Object} options
 * @param {string} [options.language='es-AR']
 * @param {string} [options.context='']
 * @returns {string}
 */
export function buildTranscriptionPrompt({ language = 'es-AR', context = '' } = {}) {
    return [
        'Actuá como transcriptor profesional de audio.',
        `Idioma principal: ${language}.`,
        'Instrucciones estrictas:',
        '1. Transcribí palabra por palabra de forma fiel (verbatim) lo que se dice en el audio.',
        '2. Puntuá correctamente con puntos, comas, signos de interrogación y exclamación.',
        '3. Conservá tecnicismos, nombres propios y modismos locales (español rioplatense si aplica).',
        '4. Si hay partes inaudibles, indicalas como [inaudible].',
        '5. Devolvé ÚNICAMENTE el texto transcripto, sin comentarios adicionales, sin introducción ni despedida.',
        context ? `Contexto temático o términos frecuentes: ${context}` : ''
    ].filter(Boolean).join('\n');
}