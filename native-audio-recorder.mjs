function getNativePlugin() {
    return globalThis.Capacitor?.Plugins?.LifeCycleAudioRecorder || null;
}

export function isNativeAudioRecorderAvailable() {
    return Boolean(
        globalThis.Capacitor?.isNativePlatform?.()
        && getNativePlugin()
    );
}

export function base64ToBlob(base64, mimeType = 'audio/mp4') {
    const binary = atob(String(base64 || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
}

export class NativeAudioRecorder {
    constructor() {
        this.plugin = getNativePlugin();
    }

    isAvailable() {
        return isNativeAudioRecorderAvailable();
    }

    assertAvailable() {
        if (!this.plugin) throw new Error('El grabador nativo no está disponible en esta instalación.');
    }

    async start({ sessionId, title, maxDurationSeconds, segmentDurationSeconds }) {
        this.assertAvailable();
        return this.plugin.startRecording({
            sessionId,
            title: String(title || 'Grabación LifeCycle').slice(0, 120),
            maxDurationSeconds,
            segmentDurationSeconds
        });
    }

    async stop() {
        this.assertAvailable();
        const result = await this.plugin.stopRecording();
        const deadline = Date.now() + 15_000;
        while (Date.now() < deadline) {
            const status = await this.plugin.getStatus();
            if (!status?.active) return { ...result, status };
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        throw new Error('Android tardó demasiado en cerrar el último fragmento de audio.');
    }

    async getStatus() {
        this.assertAvailable();
        return this.plugin.getStatus();
    }

    async listChunks(sessionId) {
        this.assertAvailable();
        const result = await this.plugin.listChunks({ sessionId });
        return Array.isArray(result?.chunks) ? result.chunks : [];
    }

    async readChunk(path, mimeType = 'audio/mp4') {
        this.assertAvailable();
        const result = await this.plugin.readChunk({ path });
        return base64ToBlob(result?.base64, mimeType);
    }

    async deleteSessionAudio(sessionId) {
        this.assertAvailable();
        return this.plugin.deleteSessionAudio({ sessionId });
    }

    addListener(eventName, listener) {
        this.assertAvailable();
        return this.plugin.addListener(eventName, listener);
    }
}
