/**
 * audio-recorder.js
 * Controlador de grabación de audio para navegador y PWA en Android.
 * Implementa Screen WakeLock API, compresión Opus/WebM a 32kbps y subida por trozos.
 * Fase D (Tandas 17A, 17C, 18B).
 */

import { AUDIO_CONSTRAINTS } from './audio-transcription-config.mjs';

export class AudioRecorder {
    constructor(options = {}) {
        this.options = {
            timeSliceMs: 1000,
            targetBitrate: AUDIO_CONSTRAINTS.targetBitrate,
            maxDurationSeconds: AUDIO_CONSTRAINTS.maxDurationSeconds,
            ...options
        };

        this.mediaRecorder = null;
        this.mediaStream = null;
        this.wakeLock = null;
        this.audioChunks = [];
        this.startTime = null;
        this.elapsedSeconds = 0;
        this.timerInterval = null;
        this.state = 'idle'; // 'idle' | 'recording' | 'paused'
        this.mimeType = null;
    }

    static isSupported() {
        return typeof window !== 'undefined'
            && Boolean(navigator?.mediaDevices?.getUserMedia)
            && Boolean(window.MediaRecorder);
    }

    static getBestMimeType() {
        if (typeof window === 'undefined' || !window.MediaRecorder) {
            return AUDIO_CONSTRAINTS.preferredMimeType;
        }
        if (MediaRecorder.isTypeSupported(AUDIO_CONSTRAINTS.preferredMimeType)) {
            return AUDIO_CONSTRAINTS.preferredMimeType;
        }
        for (const candidate of AUDIO_CONSTRAINTS.fallbackMimeTypes) {
            if (MediaRecorder.isTypeSupported(candidate)) {
                return candidate;
            }
        }
        return '';
    }

    async acquireWakeLock() {
        try {
            if ('wakeLock' in navigator && !this.wakeLock) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {
                    this.wakeLock = null;
                });
            }
        } catch (err) {
            // WakeLock no bloquea la grabación si el dispositivo lo rechaza por batería baja
            console.warn('[AudioRecorder] WakeLock no disponible o denegado:', err.message);
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            try {
                this.wakeLock.release();
            } catch (err) {
                // Silencioso
            } finally {
                this.wakeLock = null;
            }
        }
    }

    async start({ onTick = null, onChunk = null } = {}) {
        if (this.state !== 'idle') {
            throw new Error('La grabadora ya está en curso.');
        }

        const mimeType = AudioRecorder.getBestMimeType();
        this.mimeType = mimeType;

        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: AUDIO_CONSTRAINTS.sampleRate,
                channelCount: AUDIO_CONSTRAINTS.channels
            }
        });

        this.audioChunks = [];
        this.elapsedSeconds = 0;
        this.startTime = Date.now();

        const recorderOptions = {
            audioBitsPerSecond: this.options.targetBitrate
        };
        if (mimeType) {
            recorderOptions.mimeType = mimeType;
        }

        this.mediaRecorder = new MediaRecorder(this.mediaStream, recorderOptions);

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
                if (onChunk) onChunk(event.data);
            }
        };

        this.mediaRecorder.start(this.options.timeSliceMs);
        this.state = 'recording';

        // Solicitar pantalla activa en Android
        await this.acquireWakeLock();

        // Temporizador de duración
        this.timerInterval = setInterval(() => {
            if (this.state === 'recording') {
                this.elapsedSeconds++;
                if (onTick) onTick(this.elapsedSeconds);

                // Corte de seguridad a los 30 minutos
                if (this.elapsedSeconds >= this.options.maxDurationSeconds) {
                    this.stop();
                }
            }
        }, 1000);
    }

    pause() {
        if (this.state === 'recording' && this.mediaRecorder) {
            this.mediaRecorder.pause();
            this.state = 'paused';
            this.releaseWakeLock();
        }
    }

    async resume() {
        if (this.state === 'paused' && this.mediaRecorder) {
            this.mediaRecorder.resume();
            this.state = 'recording';
            await this.acquireWakeLock();
        }
    }

    async stop() {
        if (this.state === 'idle') return null;

        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.releaseWakeLock();

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                const finalMimeType = this.mediaRecorder.mimeType || this.mimeType || 'audio/webm';
                const audioBlob = new Blob(this.audioChunks, { type: finalMimeType });

                // Detener y liberar el micrófono
                if (this.mediaStream) {
                    this.mediaStream.getTracks().forEach(track => track.stop());
                    this.mediaStream = null;
                }

                const result = {
                    blob: audioBlob,
                    durationSeconds: this.elapsedSeconds,
                    mimeType: finalMimeType,
                    sizeBytes: audioBlob.size
                };

                this.state = 'idle';
                resolve(result);
            };

            if (this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
        });
    }

    /**
     * Divide un blob de audio en trozos contiguos para subida resiliente (Chunked Upload).
     *
     * @param {Blob} blob
     * @param {number} [chunkSizeBytes=AUDIO_CONSTRAINTS.chunkSizeBytes]
     * @returns {Blob[]}
     */
    static splitIntoChunks(blob, chunkSizeBytes = AUDIO_CONSTRAINTS.chunkSizeBytes) {
        const chunks = [];
        let start = 0;
        while (start < blob.size) {
            const end = Math.min(start + chunkSizeBytes, blob.size);
            chunks.push(blob.slice(start, end));
            start = end;
        }
        return chunks;
    }
}