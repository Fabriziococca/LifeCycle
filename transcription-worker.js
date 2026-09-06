const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const defaultFfmpegPath = require('ffmpeg-static');
const {
    FileState,
    GoogleGenAI
} = require('@google/genai');
const { runWithTimeout } = require('./operational-resilience.js');

const TRANSCRIPTION_BUCKET = 'transcription-audio';
const DEFAULT_TRANSCRIPTION_MODEL = 'gemini-3.5-transcribe';
const DEFAULT_ARTIFACT_MODEL = 'gemini-3.6-flash';
const DEFAULT_SEGMENT_DURATION_SECONDS = 5 * 60;
const MEDIA_PREPARATION_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PROVIDER_CONTROL_TIMEOUT_MS = 45 * 1000;

class DailyQuotaError extends Error {
    constructor(message = 'Se alcanzó el límite diario de procesamiento.') {
        super(message);
        this.name = 'DailyQuotaError';
        this.code = 'daily_safety_limit';
    }
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getNextUtcQuotaWindow(now = new Date()) {
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 5, 0, 0);
    return next;
}

function runProcess(executable, args, { timeoutMs = MEDIA_PREPARATION_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
        if (!executable) {
            reject(new Error('FFmpeg no está disponible en este servidor.'));
            return;
        }
        const child = spawn(executable, args, {
            windowsHide: true,
            shell: false,
            stdio: ['ignore', 'ignore', 'pipe']
        });
        let stderr = '';
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            child.kill('SIGKILL');
            settled = true;
            reject(new Error('FFmpeg superó el tiempo máximo de preparación.'));
        }, timeoutMs);
        timer.unref?.();
        child.stderr.on('data', chunk => {
            stderr = `${stderr}${String(chunk)}`.slice(-16_000);
        });
        child.once('error', error => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        });
        child.once('close', code => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg no pudo preparar el archivo (${code}): ${stderr.trim() || 'sin detalle'}`));
        });
    });
}

async function prepareMediaSegments({
    inputPath,
    outputDirectory,
    ffmpegPath = defaultFfmpegPath,
    segmentDurationSeconds = DEFAULT_SEGMENT_DURATION_SECONDS
}) {
    await fs.promises.mkdir(outputDirectory, { recursive: true });
    const outputPattern = path.join(outputDirectory, 'segment_%03d.m4a');
    await runProcess(ffmpegPath, [
        '-y', '-nostdin', '-hide_banner', '-loglevel', 'error',
        '-i', inputPath,
        '-map', '0:a:0', '-vn',
        '-ac', '1', '-ar', '48000', '-c:a', 'aac', '-b:a', '48k',
        '-f', 'segment', '-segment_time', String(segmentDurationSeconds),
        '-reset_timestamps', '1', outputPattern
    ]);
    const names = (await fs.promises.readdir(outputDirectory))
        .filter(name => /^segment_\d{3}\.m4a$/i.test(name))
        .sort();
    if (names.length === 0) throw new Error('El archivo no contiene una pista de audio utilizable.');
    if (names.length > 60) throw new Error('La preparación generó más fragmentos que el límite permitido.');
    return names.map(name => path.join(outputDirectory, name));
}

async function sha256File(filePath) {
    const contents = await fs.promises.readFile(filePath);
    return {
        contents,
        checksum: crypto.createHash('sha256').update(contents).digest('hex')
    };
}

function isStorageConflict(error) {
    return Number(error?.statusCode || error?.status) === 409
        || /already exists|duplicate/i.test(String(error?.message || ''));
}

function sanitizeError(error) {
    return String(error?.message || error || 'Error desconocido')
        .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[secret]')
        .slice(0, 1800);
}

function getErrorStatus(error) {
    return Number(error?.status || error?.statusCode || error?.code) || null;
}

function isRetryableError(error) {
    const status = getErrorStatus(error);
    return status === 408 || status === 409 || status === 429 || (status >= 500 && status <= 599)
        || error?.code === 'OPERATION_TIMEOUT' || error?.name === 'OperationTimeoutError'
        || /timeout|network|fetch failed|temporar/i.test(String(error?.message || ''));
}

function getProviderErrorDetails(error) {
    if (Array.isArray(error?.error?.details)) return error.error.details;
    if (Array.isArray(error?.details)) return error.details;
    try {
        const parsed = JSON.parse(error?.message || '{}');
        return parsed.error?.details || parsed.details || [];
    } catch {
        return [];
    }
}

function getNextPacificQuotaWindow(now = new Date()) {
    // Google resets daily project quotas at midnight Pacific, including DST.
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const day = formatter.format(now);
    const next = new Date(now);
    next.setUTCMinutes(0, 0, 0);
    do {
        next.setUTCHours(next.getUTCHours() + 1);
    } while (formatter.format(next) === day);
    next.setUTCMinutes(5);
    return next;
}

function getQuotaResumeAt(error, quotaWaits = 0, now = new Date()) {
    const details = getProviderErrorDetails(error);
    const safeDetails = Array.isArray(details) ? details : [];
    const dailyQuota = safeDetails.some(detail => (detail.violations || []).some(violation =>
        /per_?day|daily/i.test(`${violation.quotaMetric || ''} ${violation.quotaId || ''}`)
    ));
    const backoffMs = Math.min(60 * 60 * 1000, 60_000 * (2 ** Math.min(6, Math.max(0, Number(quotaWaits) || 0))));
    let nextMs = dailyQuota ? getNextPacificQuotaWindow(now).getTime() : now.getTime() + backoffMs;
    const headers = error?.headers || error?.response?.headers;
    const retryAfter = headers?.get?.('retry-after') ?? headers?.['retry-after'];
    if (retryAfter != null && String(retryAfter).trim()) {
        const seconds = Number(retryAfter);
        const headerMs = Number.isFinite(seconds) ? now.getTime() + Math.max(0, seconds) * 1000 : Date.parse(retryAfter);
        if (Number.isFinite(headerMs)) nextMs = Math.max(nextMs, headerMs);
    }
    for (const detail of safeDetails) {
        const duration = /^(\d+(?:\.\d+)?)s$/.exec(String(detail.retryDelay || ''));
        if (duration) nextMs = Math.max(nextMs, now.getTime() + Number(duration[1]) * 1000);
    }
    return new Date(Math.min(nextMs, 8_640_000_000_000_000));
}

function isMissingPipelineError(error) {
    return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(String(error?.code || ''))
        || /transcription_(jobs|sessions|chunks)|claim_transcription_job/i.test(String(error?.message || ''));
}

function buildTranscriptionPrompt(session, chunk) {
    const context = String(session.context || '').trim().slice(0, 2000);
    return [
        'Transcribí este fragmento de audio de forma completa, fiel y en el orden original.',
        `Idioma principal esperado: ${session.language || 'es-AR'}. Fragmento: ${Number(chunk.sequence_number) + 1}.`,
        'No resumas, no completes ideas, no corrijas el contenido y no inventes palabras.',
        'Conservá nombres propios, cifras, tecnicismos y modismos. Usá puntuación legible.',
        'Marcá [inaudible] cuando no puedas determinar una parte y [hablan a la vez] si corresponde.',
        'Devolvé solamente la transcripción, sin encabezado, explicación ni bloque Markdown.',
        context ? `Contexto aportado por el usuario (sólo para desambiguar): ${context}` : ''
    ].filter(Boolean).join('\n');
}

function buildArtifactPrompt(kind, transcript) {
    if (kind === 'summary') {
        return [
            'Creá un resumen fiel en español de la transcripción incluida debajo.',
            'Separá: Resumen, Puntos clave y Decisiones. No modifiques la transcripción fuente.',
            '',
            transcript
        ].join('\n');
    }
    return [
        'Convertí la transcripción incluida debajo en apuntes ordenados y completos en español.',
        'Separá conceptos, ejemplos, dudas y tareas. No afirmes información que no aparezca en la fuente.',
        '',
        transcript
    ].join('\n');
}

function getProviderAudioMimeType(mimeType) {
    if (mimeType === 'audio/mp4') return 'audio/m4a';
    return mimeType;
}

function getProviderLanguageCodes(language) {
    const normalized = String(language || '').trim();
    if (!normalized) return [];
    // Gemini Transcribe currently exposes a Latin-American Spanish locale,
    // rather than country-specific es-AR.
    if (/^es-(ar|bo|cl|co|cr|cu|do|ec|gt|hn|mx|ni|pa|pe|pr|py|sv|uy|ve)$/i.test(normalized)) {
        return ['es-419'];
    }
    return [normalized];
}

function getProviderCustomVocabulary(context) {
    const phrases = String(context || '')
        .split(/[\n,;|]+/)
        .map(value => value.replace(/\s+/g, ' ').trim())
        .filter(value => value.length >= 2 && value.length <= 100);
    return [...new Set(phrases)].slice(0, 100);
}

function normalizeProviderTimeout(value, fallback, minimum = 5_000, maximum = 30 * 60 * 1000) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
    return Math.min(maximum, parsed);
}

function getProviderHttpOptions(timeoutMs) {
    return {
        timeout: timeoutMs,
        // LifeCycle owns retries in its persistent queue. Retrying again inside
        // the SDK could duplicate paid/provider work after an ambiguous timeout.
        retryOptions: { attempts: 1 }
    };
}

class TranscriptionWorker {
    constructor({
        supabase,
        apiKey = process.env.GEMINI_API_KEY || '',
        transcriptionModel = process.env.GEMINI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL,
        artifactModel = process.env.GEMINI_ARTIFACT_MODEL || DEFAULT_ARTIFACT_MODEL,
        intervalMs = 15_000,
        dailyJobLimit = Number(process.env.TRANSCRIPTION_DAILY_JOB_LIMIT || 100),
        ffmpegPath = defaultFfmpegPath,
        segmentDurationSeconds = Number(process.env.TRANSCRIPTION_SEGMENT_SECONDS || DEFAULT_SEGMENT_DURATION_SECONDS),
        providerRequestTimeoutMs = Number(process.env.TRANSCRIPTION_PROVIDER_TIMEOUT_MS || DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS),
        providerControlTimeoutMs = Number(process.env.TRANSCRIPTION_PROVIDER_CONTROL_TIMEOUT_MS || DEFAULT_PROVIDER_CONTROL_TIMEOUT_MS),
        maxJobsPerRun = 3,
        logger = console
    } = {}) {
        this.supabase = supabase;
        this.apiKey = apiKey;
        this.transcriptionModel = transcriptionModel;
        this.artifactModel = artifactModel;
        this.intervalMs = Math.max(5_000, Number(intervalMs) || 15_000);
        this.dailyJobLimit = Math.max(1, Math.min(1000, Math.trunc(dailyJobLimit) || 100));
        this.ffmpegPath = ffmpegPath;
        this.segmentDurationSeconds = Math.max(60, Math.min(900, Math.trunc(segmentDurationSeconds) || DEFAULT_SEGMENT_DURATION_SECONDS));
        this.providerRequestTimeoutMs = normalizeProviderTimeout(
            providerRequestTimeoutMs,
            DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS,
            30_000
        );
        this.providerControlTimeoutMs = normalizeProviderTimeout(
            providerControlTimeoutMs,
            DEFAULT_PROVIDER_CONTROL_TIMEOUT_MS
        );
        this.maxJobsPerRun = Math.max(1, Math.min(10, Math.trunc(maxJobsPerRun) || 3));
        this.logger = logger;
        this.workerId = `render-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
        this.ai = apiKey ? new GoogleGenAI({
            apiKey,
            httpOptions: getProviderHttpOptions(this.providerRequestTimeoutMs)
        }) : null;
        this.timer = null;
        this.running = false;
        this.pipelineAvailable = null;
        this.lastCleanupAt = 0;
        this.runtime = {
            configured: Boolean(supabase && apiKey),
            running: false,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastError: null,
            processedJobs: 0,
            failedJobs: 0,
            quotaPauses: 0,
            providerAttempts: 0,
            preparedImports: 0,
            lastCleanupAt: null,
            deletedAudioObjects: 0
        };
    }

    start() {
        if (!this.runtime.configured || this.timer) return false;
        this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
        this.timer.unref?.();
        setImmediate(() => void this.runOnce());
        return true;
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    kick() {
        if (!this.runtime.configured) return false;
        setImmediate(() => void this.runOnce());
        return true;
    }

    async reserveProviderAttempt(job) {
        const { data, error } = await this.supabase.rpc('reserve_transcription_provider_attempt', {
            p_job_id: job.id,
            p_daily_limit: this.dailyJobLimit
        });
        if (error) throw error;
        if (data !== true) throw new DailyQuotaError();
        this.runtime.providerAttempts += 1;
    }

    async claimJob() {
        const { data, error } = await this.supabase.rpc('claim_transcription_job', {
            p_worker_id: this.workerId
        });
        if (error) throw error;
        return data || null;
    }

    async runOnce() {
        if (this.running || !this.runtime.configured || this.pipelineAvailable === false) return false;
        this.running = true;
        this.runtime.running = true;
        this.runtime.lastAttemptAt = new Date().toISOString();
        try {
            for (let index = 0; index < this.maxJobsPerRun; index += 1) {
                const job = await this.claimJob();
                if (!job) break;
                this.pipelineAvailable = true;
                await this.processJob(job);
                this.runtime.processedJobs += 1;
            }
            await this.cleanupExpiredAudioIfDue();
            this.runtime.lastSuccessAt = new Date().toISOString();
            this.runtime.lastError = null;
            return true;
        } catch (error) {
            if (isMissingPipelineError(error)) {
                this.pipelineAvailable = false;
                this.logger.warn('[Transcriptions] La migración del pipeline todavía no está aplicada.');
            } else {
                this.logger.error('[Transcriptions] Falló el ciclo del worker:', sanitizeError(error));
            }
            this.runtime.lastFailureAt = new Date().toISOString();
            this.runtime.lastError = sanitizeError(error);
            return false;
        } finally {
            this.running = false;
            this.runtime.running = false;
        }
    }

    async processJob(job) {
        let refreshing = false;
        const leaseTimer = setInterval(async () => {
            if (refreshing) return;
            refreshing = true;
            try {
                const { error } = await this.supabase.from('transcription_jobs')
                    .update({ locked_at: new Date().toISOString() })
                    .eq('id', job.id).eq('status', 'processing').eq('locked_by', this.workerId);
                if (error) this.logger.warn('[Transcriptions] No se pudo renovar la reserva:', sanitizeError(error));
            } catch (error) {
                this.logger.warn('[Transcriptions] No se pudo renovar la reserva:', sanitizeError(error));
            } finally {
                refreshing = false;
            }
        }, 60_000);
        leaseTimer.unref?.();
        try {
            if (job.job_type === 'prepare') {
                await this.processPreparationJob(job);
            } else if (job.job_type === 'transcribe') {
                await this.processTranscriptionJob(job);
            } else if (job.job_type === 'summary' || job.job_type === 'notes') {
                await this.processArtifactJob(job);
            } else {
                throw new Error(`Tipo de trabajo desconocido: ${job.job_type}`);
            }
        } catch (error) {
            if (!(error instanceof DailyQuotaError) && getErrorStatus(error) !== 429) this.runtime.failedJobs += 1;
            await this.failJob(job, error);
        } finally {
            clearInterval(leaseTimer);
        }
    }

    async loadSession(sessionId) {
        const { data, error } = await this.supabase
            .from('transcription_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        if (error) throw error;
        return data;
    }

    async processPreparationJob(job) {
        const [{ data: chunk, error: chunkError }, session] = await Promise.all([
            this.supabase.from('transcription_chunks').select('*').eq('id', job.chunk_id).single(),
            this.loadSession(job.session_id)
        ]);
        if (chunkError) throw chunkError;
        if (chunk.media_role !== 'import_source') {
            throw new Error('El trabajo de preparación no apunta al archivo importado original.');
        }
        const { data: sourceBlob, error: downloadError } = await this.supabase.storage
            .from(TRANSCRIPTION_BUCKET)
            .download(chunk.storage_path);
        if (downloadError) throw downloadError;
        if (!sourceBlob || sourceBlob.size !== Number(chunk.byte_size)) {
            throw new Error('El archivo importado no coincide con el tamaño registrado.');
        }

        const extension = path.extname(chunk.storage_path).replace(/[^.a-z0-9]/gi, '') || '.media';
        const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lifecycle-prepare-'));
        const inputPath = path.join(temporaryDirectory, `source${extension}`);
        const outputDirectory = path.join(temporaryDirectory, 'segments');
        try {
            await fs.promises.writeFile(inputPath, Buffer.from(await sourceBlob.arrayBuffer()));
            const segmentPaths = await prepareMediaSegments({
                inputPath,
                outputDirectory,
                ffmpegPath: this.ffmpegPath,
                segmentDurationSeconds: this.segmentDurationSeconds
            });
            const totalDurationMs = Math.max(0, Number(chunk.duration_ms) || Number(session.duration_ms) || 0);
            const nominalDurationMs = this.segmentDurationSeconds * 1000;
            const preparedSegments = [];
            for (let index = 0; index < segmentPaths.length; index += 1) {
                const { contents, checksum } = await sha256File(segmentPaths[index]);
                if (contents.length < 1 || contents.length > 52_428_800) {
                    throw new Error('Un fragmento preparado excede el límite seguro de 50 MB.');
                }
                const storagePath = [
                    chunk.user_id,
                    chunk.session_id,
                    `prepared_${String(index).padStart(3, '0')}_${checksum.slice(0, 12)}.m4a`
                ].join('/');
                const { error: uploadError } = await this.supabase.storage
                    .from(TRANSCRIPTION_BUCKET)
                    .upload(storagePath, contents, {
                        contentType: 'audio/mp4',
                        cacheControl: '3600',
                        upsert: false
                    });
                if (uploadError && !isStorageConflict(uploadError)) throw uploadError;
                // Keep content-addressed outputs until session retention cleanup.
                // A stale worker or a lost SQL response cannot safely decide that
                // another attempt has not already committed/reused these objects.
                const remainingDuration = Math.max(0, totalDurationMs - index * nominalDurationMs);
                preparedSegments.push({
                    sequenceNumber: index,
                    storagePath,
                    mimeType: 'audio/mp4',
                    byteSize: contents.length,
                    durationMs: totalDurationMs > 0 ? Math.min(nominalDurationMs, remainingDuration) : 0,
                    sha256: checksum
                });
            }
            const { error: completionError } = await this.supabase.rpc('complete_transcription_prepare_job', {
                p_job_id: job.id,
                p_worker_id: this.workerId,
                p_segments: preparedSegments
            });
            if (completionError) throw completionError;
            const { error: removeError } = await this.supabase.storage
                .from(TRANSCRIPTION_BUCKET)
                .remove([chunk.storage_path]);
            if (removeError) {
                this.logger.warn('[Transcriptions] El original preparado quedará para la limpieza diferida:', sanitizeError(removeError));
            }
            this.runtime.preparedImports += 1;
        } finally {
            await fs.promises.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
        }
    }

    async processTranscriptionJob(job) {
        const [{ data: chunk, error: chunkError }, session] = await Promise.all([
            this.supabase.from('transcription_chunks').select('*').eq('id', job.chunk_id).single(),
            this.loadSession(job.session_id)
        ]);
        if (chunkError) throw chunkError;
        if (!String(chunk.mime_type || '').startsWith('audio/')) {
            throw new Error('El fragmento debe prepararse como audio antes de transcribirse.');
        }
        const { data: audioBlob, error: downloadError } = await this.supabase.storage
            .from(TRANSCRIPTION_BUCKET)
            .download(chunk.storage_path);
        if (downloadError) throw downloadError;
        if (!audioBlob || audioBlob.size !== Number(chunk.byte_size)) {
            throw new Error('El fragmento descargado no coincide con el tamaño registrado.');
        }

        const extension = path.extname(chunk.storage_path).replace(/[^.a-z0-9]/gi, '') || '.audio';
        const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lifecycle-transcription-'));
        const temporaryPath = path.join(temporaryDirectory, `chunk${extension}`);
        let uploadedFile = null;
        try {
            const providerMimeType = getProviderAudioMimeType(chunk.mime_type);
            await this.reserveProviderAttempt(job);
            await fs.promises.writeFile(temporaryPath, Buffer.from(await audioBlob.arrayBuffer()));
            uploadedFile = await runWithTimeout(signal => this.ai.files.upload({
                file: temporaryPath,
                config: {
                    mimeType: providerMimeType,
                    displayName: `LifeCycle ${session.id} fragment ${chunk.sequence_number + 1}`,
                    // Inherit timeout/retries from the client. Upload-specific
                    // httpOptions replace the SDK's resumable headers and empty
                    // apiVersion, producing /v1beta/upload/v1beta/files (404).
                    abortSignal: signal
                }
            }), this.providerRequestTimeoutMs, 'La carga del audio en Gemini');
            uploadedFile = await this.waitForActiveFile(uploadedFile);
            const customVocabulary = getProviderCustomVocabulary(session.context);
            const interaction = await runWithTimeout(signal => this.ai.interactions.create({
                model: this.transcriptionModel,
                input: [{
                    type: 'audio',
                    uri: uploadedFile.uri,
                    mime_type: uploadedFile.mimeType || providerMimeType
                }],
                generation_config: {
                    max_output_tokens: 65_536,
                    transcription_config: {
                        language_codes: getProviderLanguageCodes(session.language),
                        mode: { type: 'verbatim' },
                        ...(customVocabulary.length > 0 ? { custom_vocabulary: customVocabulary } : {})
                    }
                },
                store: false
            }, {
                timeout: this.providerRequestTimeoutMs,
                maxRetries: 0,
                fetchOptions: { signal }
            }), this.providerRequestTimeoutMs, 'La transcripción de Gemini');
            const text = String(interaction.output_text || '').trim();
            const finishReason = String(interaction.status || 'unknown');
            if (finishReason !== 'completed') {
                throw new Error(`La transcripción no terminó correctamente (${finishReason}).`);
            }
            if (!text) throw new Error('Gemini devolvió una transcripción vacía.');
            const { error: completionError } = await this.supabase.rpc('complete_transcription_chunk_job', {
                p_job_id: job.id,
                p_worker_id: this.workerId,
                p_transcript: text,
                p_finish_reason: finishReason
            });
            if (completionError) throw completionError;
        } finally {
            if (uploadedFile?.name) {
                await runWithTimeout(signal => this.ai.files.delete({
                    name: uploadedFile.name,
                    config: {
                        httpOptions: getProviderHttpOptions(this.providerControlTimeoutMs),
                        abortSignal: signal
                    }
                }), this.providerControlTimeoutMs, 'La limpieza del archivo temporal de Gemini').catch(() => {});
            }
            await fs.promises.unlink(temporaryPath).catch(() => {});
            await fs.promises.rmdir(temporaryDirectory).catch(() => {});
        }
    }

    async waitForActiveFile(file) {
        let current = file;
        for (let attempt = 0; attempt < 30; attempt += 1) {
            if (current?.state === FileState.ACTIVE || !current?.state) return current;
            if (current.state === FileState.FAILED) throw new Error('Google no pudo procesar el archivo de audio.');
            await wait(2000);
            current = await runWithTimeout(signal => this.ai.files.get({
                name: current.name,
                config: {
                    httpOptions: getProviderHttpOptions(this.providerControlTimeoutMs),
                    abortSignal: signal
                }
            }), this.providerControlTimeoutMs, 'La consulta del archivo temporal de Gemini');
        }
        throw new Error('Google tardó demasiado en preparar el archivo de audio.');
    }

    async processArtifactJob(job) {
        const { data: transcript, error } = await this.supabase
            .from('transcription_documents')
            .select('content')
            .eq('session_id', job.session_id)
            .eq('kind', 'transcript')
            .single();
        if (error) throw error;
        if (!String(transcript?.content || '').trim()) throw new Error('La transcripción fuente está vacía.');
        await this.reserveProviderAttempt(job);
        const response = await runWithTimeout(signal => this.ai.models.generateContent({
            model: this.artifactModel,
            contents: buildArtifactPrompt(job.job_type, transcript.content),
            config: {
                temperature: 0.2,
                maxOutputTokens: 16_384,
                httpOptions: getProviderHttpOptions(this.providerRequestTimeoutMs),
                abortSignal: signal
            }
        }), this.providerRequestTimeoutMs, 'La generación del documento de Gemini');
        const content = String(response.text || '').trim();
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason !== 'STOP') throw new Error(`Gemini devolvió un documento incompleto (${finishReason || 'sin estado'}).`);
        if (!content) throw new Error('Gemini devolvió un resultado vacío.');
        const { error: completionError } = await this.supabase.rpc('complete_transcription_artifact_job', {
            p_job_id: job.id,
            p_worker_id: this.workerId,
            p_content: content
        });
        if (completionError) throw completionError;
    }

    async failJob(job, error) {
        const dailyQuotaReached = error instanceof DailyQuotaError;
        const statusCode = getErrorStatus(error);
        const quotaReached = dailyQuotaReached || statusCode === 429;
        const retryable = quotaReached
            || (isRetryableError(error) && Number(job.attempts) < Number(job.max_attempts));
        const message = sanitizeError(error);
        const now = new Date();
        const retryDelayMs = Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.max(0, Number(job.attempts) - 1)));
        const jobStatus = quotaReached
            ? 'waiting_quota'
            : (retryable ? 'queued' : 'failed');
        const availableAt = dailyQuotaReached
            ? getNextUtcQuotaWindow(now)
            : statusCode === 429 ? getQuotaResumeAt(error, job.quota_waits, now)
                : (retryable ? new Date(now.getTime() + retryDelayMs) : now);
        if (quotaReached) this.runtime.quotaPauses += 1;
        const { error: jobError } = await this.supabase.rpc('fail_transcription_job', {
            p_job_id: job.id,
            p_worker_id: this.workerId,
            p_status: jobStatus,
            p_available_at: availableAt.toISOString(),
            p_error_code: dailyQuotaReached ? error.code : (statusCode ? String(statusCode) : 'provider_error'),
            p_error_message: message
        });
        if (jobError) throw jobError;
    }

    async cleanupExpiredAudioIfDue(force = false) {
        const now = Date.now();
        if (!force && now - this.lastCleanupAt < 60 * 60 * 1000) return 0;
        this.lastCleanupAt = now;
        const { data: sessions, error } = await this.supabase
            .from('transcription_sessions')
            .select('id, user_id')
            .is('audio_deleted_at', null)
            .in('status', ['completed', 'partial', 'failed', 'canceled'])
            .lte('audio_delete_after', new Date(now).toISOString())
            .limit(25);
        if (error) throw error;
        let deleted = 0;
        const { removeSessionAudioObjects } = await import('./transcription-storage-utils.mjs');
        for (const session of sessions || []) {
            const removed = await removeSessionAudioObjects(
                this.supabase.storage.from(TRANSCRIPTION_BUCKET), session.user_id, session.id
            );
            const timestamp = new Date().toISOString();
            const { error: chunkUpdateError } = await this.supabase.from('transcription_chunks').update({
                status: 'deleted', transcript_text: null, updated_at: timestamp
            }).eq('session_id', session.id);
            if (chunkUpdateError) throw chunkUpdateError;
            const { error: sessionUpdateError } = await this.supabase.from('transcription_sessions').update({
                audio_deleted_at: timestamp, updated_at: timestamp
            }).eq('id', session.id);
            if (sessionUpdateError) throw sessionUpdateError;
            deleted += removed;
        }
        this.runtime.lastCleanupAt = new Date().toISOString();
        this.runtime.deletedAudioObjects += deleted;
        return deleted;
    }
}

module.exports = {
    DailyQuotaError,
    DEFAULT_ARTIFACT_MODEL,
    DEFAULT_TRANSCRIPTION_MODEL,
    TranscriptionWorker,
    buildArtifactPrompt,
    buildTranscriptionPrompt,
    getNextUtcQuotaWindow,
    getNextPacificQuotaWindow,
    getQuotaResumeAt,
    getProviderAudioMimeType,
    getProviderCustomVocabulary,
    getProviderHttpOptions,
    getProviderLanguageCodes,
    isMissingPipelineError,
    isRetryableError,
    normalizeProviderTimeout,
    prepareMediaSegments,
    runProcess,
    sanitizeError
};
