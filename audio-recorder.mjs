import { AUDIO_CONSTRAINTS } from './audio-transcription-config.mjs';

export class AudioRecorder {
    constructor(options = {}) {
        this.options = {
            targetBitrate: AUDIO_CONSTRAINTS.targetBitrate,
            maxDurationSeconds: AUDIO_CONSTRAINTS.maxDurationSeconds,
            segmentDurationSeconds: AUDIO_CONSTRAINTS.segmentDurationSeconds,
            ...options
        };
        this.state = 'idle';
        this.stream = null;
        this.mediaRecorder = null;
        this.segmentChunks = [];
        this.segmentStartedAt = 0;
        this.startedAt = 0;
        this.sequenceNumber = 0;
        this.rotateTimer = null;
        this.tickTimer = null;
        this.currentStopPromise = null;
        this.callbacks = {};
        this.visibilityHandler = null;
        this.backgroundWarningSent = false;
    }

    static isSupported() {
        return Boolean(
            globalThis.navigator?.mediaDevices?.getUserMedia
            && globalThis.MediaRecorder
        );
    }

    static getBestMimeType() {
        const recorder = globalThis.MediaRecorder;
        if (!recorder?.isTypeSupported) return '';
        return [
            AUDIO_CONSTRAINTS.preferredMimeType,
            ...AUDIO_CONSTRAINTS.fallbackMimeTypes
        ].find(candidate => recorder.isTypeSupported(candidate)) || '';
    }

    getElapsedSeconds() {
        return this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
    }

    async start(callbacks = {}) {
        if (!AudioRecorder.isSupported()) {
            throw new Error('Este navegador no admite grabación de audio.');
        }
        if (this.state !== 'idle') throw new Error('Ya hay una grabación en curso.');
        this.state = 'starting';
        this.callbacks = callbacks;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: AUDIO_CONSTRAINTS.channels,
                    sampleRate: AUDIO_CONSTRAINTS.sampleRate
                }
            });
            const audioTrack = this.stream.getAudioTracks()[0];
            if (!audioTrack) throw new Error('No se encontró una entrada de micrófono.');
            audioTrack.addEventListener('ended', () => {
                if (this.state === 'recording') {
                    void this.stop({ interrupted: true, reason: 'El sistema dejó de entregar audio del micrófono.' });
                }
            });
            this.startedAt = Date.now();
            this.sequenceNumber = 0;
            this.state = 'recording';
            this._bindVisibilityWarning();
            this._startTicking();
            this._startSegment();
            return { startedAt: new Date(this.startedAt).toISOString() };
        } catch (error) {
            this._releaseStream();
            this.state = 'idle';
            throw error;
        }
    }

    _startTicking() {
        clearInterval(this.tickTimer);
        this.tickTimer = setInterval(() => {
            if (this.state !== 'recording') return;
            const elapsedSeconds = this.getElapsedSeconds();
            this.callbacks.onTick?.(elapsedSeconds);
            if (elapsedSeconds >= this.options.maxDurationSeconds) {
                void this.stop({ reason: 'Se alcanzó el límite de seguridad de tres horas.', automatic: true });
            }
        }, 1000);
    }

    _startSegment() {
        if (this.state !== 'recording' || !this.stream) return;
        const mimeType = AudioRecorder.getBestMimeType();
        const options = { audioBitsPerSecond: this.options.targetBitrate };
        if (mimeType) options.mimeType = mimeType;
        this.segmentChunks = [];
        this.segmentStartedAt = Date.now();
        this.mediaRecorder = new MediaRecorder(this.stream, options);
        this.mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data?.size > 0) this.segmentChunks.push(event.data);
        });
        this.mediaRecorder.addEventListener('error', event => {
            this.callbacks.onError?.(event.error || new Error('Falló la grabadora del navegador.'));
        });
        this.mediaRecorder.start(1000);
        clearTimeout(this.rotateTimer);
        this.rotateTimer = setTimeout(() => {
            void this._rotateSegment();
        }, this.options.segmentDurationSeconds * 1000);
    }

    async _finishCurrentSegment() {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;
        if (this.currentStopPromise) return this.currentStopPromise;
        const recorder = this.mediaRecorder;
        const sequenceNumber = this.sequenceNumber;
        const segmentStartedAt = this.segmentStartedAt;
        this.currentStopPromise = new Promise((resolve, reject) => {
            recorder.addEventListener('stop', () => {
                try {
                    const mimeType = recorder.mimeType || AudioRecorder.getBestMimeType() || 'audio/webm';
                    const blob = new Blob(this.segmentChunks, { type: mimeType });
                    const result = blob.size > 0 ? {
                        sequenceNumber,
                        blob,
                        mimeType: mimeType.split(';')[0],
                        byteSize: blob.size,
                        durationMs: Math.max(0, Date.now() - segmentStartedAt)
                    } : null;
                    // Persist/upload outside the recorder rotation path. Waiting for the
                    // network callback here left the microphone stopped between segments.
                    if (result) {
                        Promise.resolve(this.callbacks.onSegment?.(result)).catch(error => {
                            this.callbacks.onError?.(error);
                        });
                    }
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.segmentChunks = [];
                    this.currentStopPromise = null;
                }
            }, { once: true });
            recorder.addEventListener('error', event => {
                reject(event.error || new Error('No se pudo cerrar el fragmento de audio.'));
            }, { once: true });
            try {
                recorder.stop();
            } catch (error) {
                reject(error);
            }
        });
        return this.currentStopPromise;
    }

    async _rotateSegment() {
        if (this.state !== 'recording') return;
        clearTimeout(this.rotateTimer);
        await this._finishCurrentSegment();
        if (this.state !== 'recording') return;
        this.sequenceNumber += 1;
        this._startSegment();
    }

    async stop({ interrupted = false, reason = '', automatic = false } = {}) {
        if (this.state === 'idle') return null;
        if (this.state === 'stopping') return this.stopPromise;
        this.state = 'stopping';
        clearTimeout(this.rotateTimer);
        clearInterval(this.tickTimer);
        this.stopPromise = (async () => {
            let finalSegment = null;
            try {
                finalSegment = await this._finishCurrentSegment();
            } finally {
                const durationSeconds = this.getElapsedSeconds();
                this._releaseStream();
                this._unbindVisibilityWarning();
                this.state = 'idle';
                const result = { durationSeconds, finalSegment, interrupted, reason, automatic };
                if (interrupted) this.callbacks.onInterrupted?.(result);
                if (automatic) this.callbacks.onAutomaticStop?.(result);
                this.callbacks.onStopped?.(result);
                this.stopPromise = null;
                return result;
            }
        })();
        return this.stopPromise;
    }

    _releaseStream() {
        this.stream?.getTracks?.().forEach(track => track.stop());
        this.stream = null;
        this.mediaRecorder = null;
        this.startedAt = 0;
    }

    _bindVisibilityWarning() {
        if (typeof document === 'undefined') return;
        this.backgroundWarningSent = false;
        this.visibilityHandler = () => {
            if (
                document.visibilityState === 'hidden'
                && this.state === 'recording'
                && !this.backgroundWarningSent
            ) {
                this.backgroundWarningSent = true;
                this.callbacks.onBackgroundRisk?.();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    _unbindVisibilityWarning() {
        if (this.visibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
        }
        this.visibilityHandler = null;
    }
}
