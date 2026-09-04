import { AUDIO_CONSTRAINTS } from './audio-transcription-config.mjs';
import {
    TRANSCRIPTION_BUCKET,
    getFileExtension,
    normalizeMimeType,
    normalizeSessionRow,
    sha256Blob
} from './transcription-utils.mjs';

function requireValue(value, message) {
    if (!value) throw new Error(message);
    return value;
}

function isAlreadyStoredError(error) {
    return Number(error?.statusCode || error?.status) === 409
        || /already exists|duplicate/i.test(String(error?.message || ''));
}

const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
const RESUMABLE_UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;

export function getResumableUploadEndpoint(supabaseUrl) {
    const url = new URL(String(supabaseUrl || ''));
    if (/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) {
        const projectId = url.hostname.split('.')[0];
        return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
    }
    return `${url.origin}/storage/v1/upload/resumable`;
}

export class TranscriptionCloudService {
    constructor(app) {
        this.app = app;
    }

    get client() {
        return this.app.auth?.supabase || null;
    }

    get user() {
        return this.app.auth?.user || null;
    }

    assertReady() {
        requireValue(this.client, 'Supabase todavía no está disponible.');
        requireValue(this.user?.id, 'Iniciá sesión para usar Transcripciones.');
    }

    async listLibrary() {
        this.assertReady();
        const [foldersResult, sessionsResult, documentsResult] = await Promise.all([
            this.client.from('transcription_folders')
                .select('id, name, created_at, updated_at')
                .order('name', { ascending: true }),
            this.client.from('transcription_sessions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500),
            this.client.from('transcription_documents')
                .select('id, session_id, kind, content, user_edited, updated_at')
                .order('updated_at', { ascending: false })
                .limit(1500)
        ]);
        const error = foldersResult.error || sessionsResult.error || documentsResult.error;
        if (error) throw error;
        return {
            folders: foldersResult.data || [],
            sessions: (sessionsResult.data || [])
                .map(row => normalizeSessionRow(row, documentsResult.data || []))
                .filter(Boolean)
        };
    }

    async createFolder(name) {
        this.assertReady();
        const safeName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!safeName) throw new Error('Ingresá un nombre para la carpeta.');
        const { data, error } = await this.client
            .from('transcription_folders')
            .insert({ user_id: this.user.id, name: safeName })
            .select('id, name, created_at, updated_at')
            .single();
        if (error) throw error;
        return data;
    }

    async createSession({
        id = globalThis.crypto?.randomUUID?.(),
        title = 'Transcripción sin título',
        folderId = null,
        sourceType = 'recording',
        language = 'es-AR',
        context = '',
        autoProcess = true,
        status = 'recording',
        mimeType = null
    } = {}) {
        this.assertReady();
        requireValue(id, 'No se pudo generar el identificador de la grabación.');
        const payload = {
            id,
            user_id: this.user.id,
            folder_id: folderId || null,
            title: String(title || 'Transcripción sin título').replace(/\s+/g, ' ').trim().slice(0, 160),
            source_type: sourceType === 'import' ? 'import' : 'recording',
            language,
            context: String(context || '').trim().slice(0, 2000),
            auto_process: autoProcess !== false,
            status,
            mime_type: normalizeMimeType(mimeType) || null
        };
        const { data, error } = await this.client
            .from('transcription_sessions')
            .insert(payload)
            .select('*')
            .single();
        if (error) throw error;
        return normalizeSessionRow(data);
    }

    async updateSession(sessionId, updates) {
        this.assertReady();
        const allowed = {};
        const mapping = {
            title: 'title',
            folderId: 'folder_id',
            context: 'context',
            language: 'language',
            autoProcess: 'auto_process',
            status: 'status',
            mimeType: 'mime_type',
            durationMs: 'duration_ms',
            totalBytes: 'total_bytes',
            expectedChunks: 'expected_chunks',
            completedChunks: 'completed_chunks'
        };
        Object.entries(mapping).forEach(([source, target]) => {
            if (Object.hasOwn(updates, source)) allowed[target] = updates[source];
        });
        allowed.updated_at = new Date().toISOString();
        const { data, error } = await this.client
            .from('transcription_sessions')
            .update(allowed)
            .eq('id', sessionId)
            .select('*')
            .single();
        if (error) throw error;
        return normalizeSessionRow(data);
    }

    async uploadChunk(sessionId, chunk, { filename = '' } = {}) {
        this.assertReady();
        const blob = requireValue(chunk?.blob, 'El fragmento no contiene contenido multimedia.');
        if (blob.size < 1 || blob.size > AUDIO_CONSTRAINTS.maxChunkSizeBytes) {
            throw new Error('El fragmento supera el límite seguro de 50 MB.');
        }
        const mimeType = normalizeMimeType(chunk.mimeType || blob.type);
        if (!mimeType) throw new Error('El formato de audio o video no está permitido.');
        const sequenceNumber = Math.max(0, Math.trunc(Number(chunk.sequenceNumber) || 0));
        const checksum = chunk.sha256 || await sha256Blob(blob);
        const extension = getFileExtension(filename, mimeType);
        const storagePath = [
            this.user.id,
            sessionId,
            `${String(sequenceNumber).padStart(4, '0')}_${checksum.slice(0, 12)}.${extension}`
        ].join('/');

        let createdObject = false;
        if (blob.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
            try {
                await this.uploadResumable(storagePath, blob, mimeType, checksum);
                createdObject = true;
            } catch (error) {
                if (!isAlreadyStoredError(error)) throw error;
            }
        } else {
            const upload = await this.client.storage
                .from(TRANSCRIPTION_BUCKET)
                .upload(storagePath, blob, {
                    contentType: mimeType,
                    cacheControl: '3600',
                    upsert: false
                });
            if (upload.error && !isAlreadyStoredError(upload.error)) throw upload.error;
            createdObject = !upload.error;
        }

        const { data, error } = await this.client
            .from('transcription_chunks')
            .upsert({
                session_id: sessionId,
                user_id: this.user.id,
                sequence_number: sequenceNumber,
                storage_path: storagePath,
                mime_type: mimeType,
                media_role: ['import_source', 'prepared'].includes(chunk.mediaRole)
                    ? chunk.mediaRole
                    : 'recorded',
                byte_size: blob.size,
                duration_ms: Math.max(0, Math.trunc(Number(chunk.durationMs) || 0)),
                sha256: checksum,
                status: 'uploaded',
                error_code: null,
                error_message: null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'session_id,sequence_number' })
            .select('id, storage_path, sequence_number, byte_size, duration_ms, status')
            .single();
        if (error) {
            // Storage is written before metadata so uploads can be retried. If
            // the database rejects this new object (quota, RLS or validation),
            // remove only the object created by this attempt. A conflict means
            // another retry already owns the deterministic object.
            if (createdObject) {
                await this.client.storage.from(TRANSCRIPTION_BUCKET)
                    .remove([storagePath])
                    .catch(() => {});
            }
            throw error;
        }
        return data;
    }

    async uploadResumable(storagePath, blob, mimeType, checksum) {
        const TusUpload = globalThis.tus?.Upload;
        if (typeof TusUpload !== 'function') {
            throw new Error('El cargador recuperable no está disponible. Recargá LifeCycle e intentá nuevamente.');
        }
        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;
        const accessToken = requireValue(data?.session?.access_token, 'La sesión venció antes de iniciar la subida.');
        const endpoint = getResumableUploadEndpoint(this.client.supabaseUrl);
        const fingerprint = [
            'lifecycle-transcription',
            this.user.id,
            storagePath,
            blob.size,
            checksum
        ].join(':');

        await new Promise((resolve, reject) => {
            const upload = new TusUpload(blob, {
                endpoint,
                retryDelays: [0, 3000, 5000, 10_000, 20_000],
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    ...(this.client.supabaseKey ? { apikey: this.client.supabaseKey } : {})
                },
                uploadDataDuringCreation: true,
                removeFingerprintOnSuccess: true,
                chunkSize: RESUMABLE_UPLOAD_CHUNK_BYTES,
                fingerprint: () => Promise.resolve(fingerprint),
                metadata: {
                    bucketName: TRANSCRIPTION_BUCKET,
                    objectName: storagePath,
                    contentType: mimeType,
                    cacheControl: '3600'
                },
                onError: reject,
                onSuccess: resolve
            });
            upload.findPreviousUploads()
                .then(previousUploads => {
                    if (previousUploads.length > 0) {
                        upload.resumeFromPreviousUpload(previousUploads[0]);
                    }
                    upload.start();
                })
                .catch(reject);
        });
    }

    async finalizeUpload(sessionId) {
        this.assertReady();
        const { data: chunks, error } = await this.client
            .from('transcription_chunks')
            .select('id, byte_size, duration_ms, sequence_number, status')
            .eq('session_id', sessionId)
            .neq('status', 'deleted')
            .order('sequence_number', { ascending: true });
        if (error) throw error;
        if (!chunks?.length) throw new Error('La grabación no tiene fragmentos subidos.');
        const totalBytes = chunks.reduce((sum, item) => sum + Number(item.byte_size || 0), 0);
        const durationMs = chunks.reduce((sum, item) => sum + Number(item.duration_ms || 0), 0);
        return this.updateSession(sessionId, {
            status: 'uploaded',
            totalBytes,
            durationMs,
            expectedChunks: chunks.length,
            completedChunks: chunks.filter(item => item.status === 'completed').length
        });
    }

    async enqueueSession(sessionId) {
        this.assertReady();
        const { data, error } = await this.client.rpc('enqueue_transcription_session', {
            p_session_id: sessionId
        });
        if (error) throw error;
        await this.wakeWorker();
        return Number(data) || 0;
    }

    async enqueueArtifact(sessionId, kind) {
        this.assertReady();
        if (!['summary', 'notes'].includes(kind)) throw new Error('Resultado derivado no válido.');
        const { error } = await this.client.rpc('enqueue_transcription_artifact', {
            p_session_id: sessionId,
            p_kind: kind
        });
        if (error) throw error;
        await this.wakeWorker();
    }

    async wakeWorker() {
        const { data } = await this.client.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) return;
        await fetch('/api/transcriptions/run', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
    }

    async saveTranscript(sessionId, content) {
        this.assertReady();
        const text = String(content || '');
        const { error } = await this.client
            .from('transcription_documents')
            .update({
                content: text,
                user_edited: true,
                updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)
            .eq('kind', 'transcript');
        if (error) throw error;
    }

    async deleteSession(sessionId) {
        this.assertReady();
        const { data: chunks, error: chunksError } = await this.client
            .from('transcription_chunks')
            .select('storage_path')
            .eq('session_id', sessionId);
        if (chunksError) throw chunksError;
        const paths = (chunks || []).map(chunk => chunk.storage_path).filter(Boolean);
        if (paths.length > 0) {
            const { error: storageError } = await this.client.storage
                .from(TRANSCRIPTION_BUCKET)
                .remove(paths);
            if (storageError) throw storageError;
        }
        const { error } = await this.client
            .from('transcription_sessions')
            .delete()
            .eq('id', sessionId);
        if (error) throw error;
    }

    async getAudioDownloadUrls(sessionId) {
        this.assertReady();
        const { data: chunks, error } = await this.client
            .from('transcription_chunks')
            .select('sequence_number, storage_path')
            .eq('session_id', sessionId)
            .neq('status', 'deleted')
            .order('sequence_number', { ascending: true });
        if (error) throw error;
        const paths = (chunks || []).map(chunk => chunk.storage_path);
        if (paths.length === 0) return [];
        const { data, error: signedError } = await this.client.storage
            .from(TRANSCRIPTION_BUCKET)
            .createSignedUrls(paths, 5 * 60);
        if (signedError) throw signedError;
        return (data || []).map((item, index) => ({
            sequenceNumber: chunks[index].sequence_number,
            signedUrl: item.signedUrl,
            path: item.path
        }));
    }
}
