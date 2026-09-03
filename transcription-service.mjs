/**
 * transcription-service.mjs
 * Servicio de comunicación con la API de Google Gemini (Free Tier)
 * para transcripción de audio y generación de resúmenes estructurados.
 * Fase E (Tandas 21, 22, 25).
 */

import { GEMINI_CONFIG, buildTranscriptionPrompt } from './audio-transcription-config.mjs';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Transcribe un archivo de audio en base64 utilizando Gemini 1.5 Flash.
 *
 * @param {Object} options
 * @param {string} options.audioBase64 - Datos del audio en base64
 * @param {string} [options.mimeType='audio/webm']
 * @param {string} [options.language='es-AR']
 * @param {string} [options.context='']
 * @param {string} [options.apiKey='']
 * @param {number} [options.maxRetries=3]
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
export async function transcribeAudio({
    audioBase64,
    mimeType = 'audio/webm',
    language = 'es-AR',
    context = '',
    apiKey = '',
    maxRetries = 3
}) {
    if (!audioBase64) {
        return { success: false, error: 'No se suministró contenido de audio.' };
    }

    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
    if (!key) {
        return {
            success: false,
            error: 'Clave de API de Gemini no configurada (GEMINI_API_KEY). Podés configurarla en el backend o en variables de entorno.'
        };
    }

    const promptText = buildTranscriptionPrompt({ language, context });
    const url = `${GEMINI_API_BASE}/${GEMINI_CONFIG.model}:generateContent?key=${key}`;

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            mimeType: mimeType.split(';')[0],
                            data: audioBase64
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
        }
    };

    let attempt = 0;
    let delay = 2000;

    while (attempt <= maxRetries) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429) {
                // Rate limit (15 RPM)
                attempt++;
                if (attempt > maxRetries) {
                    return {
                        success: false,
                        error: 'Límite de solicitudes por minuto alcanzado (15 RPM). Por favor esperá unos segundos antes de reintentar.'
                    };
                }
                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
                continue;
            }

            if (!response.ok) {
                const errText = await response.text();
                return {
                    success: false,
                    error: `Error de API Gemini (${response.status}): ${errText.slice(0, 300)}`
                };
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            const textPart = candidate?.content?.parts?.[0]?.text;

            if (!textPart) {
                return {
                    success: false,
                    error: 'Gemini no retornó contenido transcripto para este audio.'
                };
            }

            return {
                success: true,
                text: textPart.trim(),
                finishReason: candidate.finishReason || 'STOP'
            };
        } catch (err) {
            attempt++;
            if (attempt > maxRetries) {
                return { success: false, error: `Error de conexión con Gemini: ${err.message}` };
            }
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }

    return { success: false, error: 'No se pudo completar la transcripción tras varios reintentos.' };
}

/**
 * Genera un resumen ejecutivo y lista de tareas accionables a partir del texto transcripto.
 *
 * @param {Object} options
 * @param {string} options.text - Texto transcripto original
 * @param {string} [options.apiKey='']
 * @returns {Promise<{ success: boolean, summary?: string, error?: string }>}
 */
export async function generateSummary({ text, apiKey = '' }) {
    if (!text || text.length < 20) {
        return { success: false, error: 'El texto es demasiado corto para generar un resumen.' };
    }

    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
    if (!key) {
        return { success: false, error: 'Clave de API de Gemini no disponible.' };
    }

    const prompt = [
        'Actuá como asistente analista y organizador.',
        'A partir del siguiente texto transcripto, generá un resumen en español estructurado exactamente en:',
        '1. **Resumen Ejecutivo:** síntesis breve de 2-4 líneas.',
        '2. **Puntos Clave:** viñetas claras con las ideas o acuerdos principales.',
        '3. **Tareas y Acciones:** compromisos, pendientes o tareas detectadas (si no hay, indicá "Sin tareas pendientes").',
        'No agregues introducciones ni saludos.',
        '',
        'Texto transcripto:',
        text
    ].join('\n');

    const url = `${GEMINI_API_BASE}/${GEMINI_CONFIG.model}:generateContent?key=${key}`;
    const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            return { success: false, error: `Error al generar resumen: ${response.statusText}` };
        }

        const data = await response.json();
        const summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return {
            success: true,
            summary: (summaryText || '').trim()
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
