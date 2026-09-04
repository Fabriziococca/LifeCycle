export const TRANSCRIPTION_PROVIDER = Object.freeze({
    transcriptionModel: 'gemini-3.5-transcribe',
    summaryModel: 'gemini-2.5-flash',
    mode: 'google-ai-studio-free',
    hardDailyJobLimit: 100,
    costPerMonthUSD: 0
});

export const AUDIO_CONSTRAINTS = Object.freeze({
    preferredMimeType: 'audio/webm;codecs=opus',
    fallbackMimeTypes: Object.freeze([
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
    ]),
    targetBitrate: 48_000,
    sampleRate: 48_000,
    channels: 1,
    segmentDurationSeconds: 5 * 60,
    maxDurationSeconds: 3 * 60 * 60,
    maxChunkSizeBytes: 50 * 1024 * 1024,
    maxImportedFileBytes: 50 * 1024 * 1024,
    maxPendingAudioBytes: 750 * 1024 * 1024,
    successfulAudioRetentionHours: 24,
    failedAudioRetentionDays: 7
});

export const TRANSCRIPTION_PRIVACY_NOTICE = Object.freeze({
    title: 'Privacidad de las transcripciones',
    text: [
        'El audio se guarda temporalmente en el Storage privado de LifeCycle y se envía a Google Gemini para transcribirlo.',
        'La modalidad gratuita de Google puede utilizar el contenido conforme a sus condiciones para mejorar sus productos; no cargues material confidencial si no aceptás ese tratamiento.',
        'LifeCycle intenta eliminar la copia de Gemini al terminar y elimina su audio cloud 24 horas después de una transcripción correcta. Podés descargarlo antes.'
    ].join(' '),
    consentStorageKey: 'lifecycle_transcription_consent_v2',
    required: true
});

export function evaluateQuotaUsage(completedJobs = 0, dailyLimit = TRANSCRIPTION_PROVIDER.hardDailyJobLimit) {
    const safeLimit = Math.max(1, Math.trunc(Number(dailyLimit) || 1));
    const percent = Math.max(0, Number(completedJobs) || 0) / safeLimit * 100;
    if (percent >= 100) {
        return {
            level: 'paused',
            allowed: false,
            percent,
            message: 'Pausa diaria de seguridad activa. Los audios quedan guardados para continuar mañana.'
        };
    }
    if (percent >= 80) {
        return {
            level: 'warning',
            allowed: true,
            percent,
            message: 'El procesamiento se acerca al límite diario de seguridad.'
        };
    }
    return {
        level: 'ok',
        allowed: true,
        percent,
        message: 'Procesamiento disponible.'
    };
}

export function buildTranscriptionPrompt({ language = 'es-AR', context = '', sequenceNumber = 0 } = {}) {
    const safeContext = String(context || '').trim().slice(0, 2000);
    return [
        'Transcribí este fragmento de audio de forma completa, fiel y en el orden original.',
        `Idioma principal esperado: ${language}. Fragmento: ${Number(sequenceNumber) + 1}.`,
        'No resumas, no completes ideas, no corrijas el contenido y no inventes palabras.',
        'Conservá nombres propios, cifras, tecnicismos y modismos. Usá puntuación legible.',
        'Marcá [inaudible] cuando no puedas determinar una parte y [hablan a la vez] si corresponde.',
        'Devolvé solamente la transcripción, sin encabezado, explicación ni bloque Markdown.',
        safeContext ? `Contexto aportado por el usuario (sólo para desambiguar): ${safeContext}` : ''
    ].filter(Boolean).join('\n');
}

export function buildArtifactPrompt(kind, transcript) {
    const source = String(transcript || '').trim();
    if (kind === 'summary') {
        return [
            'Creá un resumen fiel en español de la transcripción incluida debajo.',
            'Separá: Resumen, Puntos clave y Decisiones. No modifiques la transcripción fuente.',
            '',
            source
        ].join('\n');
    }
    if (kind === 'notes') {
        return [
            'Convertí la transcripción incluida debajo en apuntes ordenados y completos en español.',
            'Separá conceptos, ejemplos, dudas y tareas. No afirmes información que no aparezca en la fuente.',
            '',
            source
        ].join('\n');
    }
    throw new TypeError('Tipo de documento derivado no soportado.');
}
