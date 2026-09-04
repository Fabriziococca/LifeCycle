package com.fabriziococca.lifecycle;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.os.storage.StorageManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.atomic.AtomicBoolean;

public class LifeCycleAudioRecorderService extends Service {
    public static final String ACTION_START = "com.fabriziococca.lifecycle.audio.START";
    public static final String ACTION_STOP = "com.fabriziococca.lifecycle.audio.STOP";
    public static final String ACTION_STOPPED = "com.fabriziococca.lifecycle.audio.STOPPED";
    public static final String ACTION_INTERRUPTED = "com.fabriziococca.lifecycle.audio.INTERRUPTED";
    public static final String EXTRA_SESSION_ID = "sessionId";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_MAX_DURATION = "maxDurationSeconds";
    public static final String EXTRA_SEGMENT_DURATION = "segmentDurationSeconds";
    public static final String EXTRA_AUTOMATIC = "automatic";
    public static final String EXTRA_INTERRUPTED = "interrupted";
    public static final String EXTRA_MESSAGE = "message";
    public static final String PREF_SESSION_ID = "sessionId";
    public static final String PREF_TITLE = "title";
    public static final String PREF_STARTED_AT = "startedAt";
    public static final String PREF_HEARTBEAT_AT = "heartbeatAt";

    private static final String PREFS_NAME = "lifecycle_audio_recorder";
    private static final String PREF_ACTIVE = "active";
    private static final String CHANNEL_ID = "lifecycle_recording";
    private static final int NOTIFICATION_ID = 4201;
    private static final int SAMPLE_RATE = 48_000;
    private static final int CHANNEL_COUNT = 1;
    private static final int BIT_RATE = 48_000;
    private static final int PCM_BYTES_PER_SAMPLE = 2;
    private static final long HEARTBEAT_STALE_MS = 30_000L;
    private static volatile boolean processRecording;

    private final AtomicBoolean recording = new AtomicBoolean(false);
    private volatile boolean requestedStop;
    private volatile boolean automaticStop;
    private volatile String interruptionMessage;
    private Thread recordingThread;
    private PowerManager.WakeLock wakeLock;
    private String sessionId;
    private String title;
    private int maxDurationSeconds;
    private int segmentDurationSeconds;
    private long startedAtEpochMs;

    public static SharedPreferences getPreferences(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static boolean isRecordingActive(Context context) {
        SharedPreferences preferences = getPreferences(context);
        if (!preferences.getBoolean(PREF_ACTIVE, false)) return false;
        if (processRecording) return true;
        long heartbeat = preferences.getLong(PREF_HEARTBEAT_AT, 0L);
        if (heartbeat > 0 && System.currentTimeMillis() - heartbeat <= HEARTBEAT_STALE_MS) return true;
        preferences.edit().putBoolean(PREF_ACTIVE, false).apply();
        return false;
    }

    public static Intent createStartIntent(
        Context context,
        String sessionId,
        String title,
        int maxDurationSeconds,
        int segmentDurationSeconds
    ) {
        return new Intent(context, LifeCycleAudioRecorderService.class)
            .setAction(ACTION_START)
            .putExtra(EXTRA_SESSION_ID, sessionId)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_MAX_DURATION, maxDurationSeconds)
            .putExtra(EXTRA_SEGMENT_DURATION, segmentDurationSeconds);
    }

    public static Intent createStopIntent(Context context) {
        return new Intent(context, LifeCycleAudioRecorderService.class).setAction(ACTION_STOP);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            requestedStop = true;
            recording.set(false);
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action) || recording.getAndSet(true)) {
            return START_NOT_STICKY;
        }

        sessionId = intent.getStringExtra(EXTRA_SESSION_ID);
        title = intent.getStringExtra(EXTRA_TITLE);
        maxDurationSeconds = clamp(intent.getIntExtra(EXTRA_MAX_DURATION, 10_800), 60, 10_800);
        segmentDurationSeconds = clamp(intent.getIntExtra(EXTRA_SEGMENT_DURATION, 300), 60, 900);
        requestedStop = false;
        automaticStop = false;
        interruptionMessage = null;
        startedAtEpochMs = System.currentTimeMillis();
        persistActiveState(true);
        startMicrophoneForeground(createRecordingNotification());
        acquireWakeLock();
        processRecording = true;
        recordingThread = new Thread(this::recordAudio, "lifecycle-audio-recorder");
        recordingThread.start();
        // A killed process must never overwrite an existing fragment by silently
        // restarting at sequence zero. The next app launch recovers the .part file.
        return START_NOT_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        recording.set(false);
        releaseWakeLock();
        super.onDestroy();
    }

    @SuppressLint("MissingPermission")
    private void recordAudio() {
        AudioRecord audioRecord = null;
        MediaCodec encoder = null;
        SegmentWriter segmentWriter = null;
        try {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                throw new SecurityException("Android revocó el permiso de micrófono.");
            }
            File sessionDirectory = new File(new File(getFilesDir(), "transcriptions"), sessionId);
            if (!sessionDirectory.exists() && !sessionDirectory.mkdirs()) {
                throw new IOException("No se pudo crear la carpeta local de grabación.");
            }
            if (getAvailableRecordingBytes(sessionDirectory) < 100L * 1024L * 1024L) {
                throw new IOException("Queda menos de 100 MB libres en el teléfono.");
            }

            int minimumBuffer = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            if (minimumBuffer <= 0) throw new IOException("Android no pudo calcular el búfer del micrófono.");
            int bufferSize = Math.max(minimumBuffer * 2, SAMPLE_RATE * PCM_BYTES_PER_SAMPLE / 5);
            audioRecord = createAudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, bufferSize);
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                audioRecord.release();
                audioRecord = createAudioRecord(MediaRecorder.AudioSource.MIC, bufferSize);
            }
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                throw new IOException("Android no pudo inicializar el micrófono.");
            }

            MediaFormat format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, CHANNEL_COUNT);
            format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            format.setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE);
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, bufferSize);
            encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            encoder.start();
            audioRecord.startRecording();
            if (audioRecord.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                throw new IOException("El micrófono no inició la captura.");
            }

            segmentWriter = new SegmentWriter(sessionDirectory, startedAtEpochMs, segmentDurationSeconds * 1_000L);
            long totalSamples = 0L;
            long startedAtElapsed = SystemClock.elapsedRealtime();
            long lastHeartbeat = 0L;
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();

            while (recording.get()) {
                long elapsedMs = SystemClock.elapsedRealtime() - startedAtElapsed;
                if (elapsedMs >= maxDurationSeconds * 1_000L) {
                    automaticStop = true;
                    recording.set(false);
                    break;
                }
                int inputIndex = encoder.dequeueInputBuffer(10_000L);
                if (inputIndex >= 0) {
                    ByteBuffer inputBuffer = encoder.getInputBuffer(inputIndex);
                    if (inputBuffer == null) throw new IOException("El codificador perdió su búfer de entrada.");
                    inputBuffer.clear();
                    int requestedBytes = Math.min(inputBuffer.remaining(), bufferSize);
                    int bytesRead = audioRecord.read(inputBuffer, requestedBytes, AudioRecord.READ_BLOCKING);
                    if (bytesRead == AudioRecord.ERROR_DEAD_OBJECT) {
                        throw new IOException("Otra aplicación o Android interrumpió el micrófono.");
                    }
                    if (bytesRead < 0) throw new IOException("Falló la lectura del micrófono: " + bytesRead);
                    long presentationUs = totalSamples * 1_000_000L / SAMPLE_RATE;
                    totalSamples += bytesRead / (PCM_BYTES_PER_SAMPLE * CHANNEL_COUNT);
                    encoder.queueInputBuffer(inputIndex, 0, bytesRead, presentationUs, 0);
                    drainEncoder(encoder, bufferInfo, segmentWriter, false);
                }
                long now = System.currentTimeMillis();
                if (now - lastHeartbeat >= 5_000L) {
                    getPreferences(this).edit().putLong(PREF_HEARTBEAT_AT, now).apply();
                    lastHeartbeat = now;
                }
            }

            queueEndOfStream(encoder, totalSamples);
            drainEncoder(encoder, bufferInfo, segmentWriter, true);
        } catch (Exception error) {
            if (!requestedStop && !automaticStop) {
                interruptionMessage = safeErrorMessage(error);
            }
        } finally {
            if (audioRecord != null) {
                try {
                    if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) audioRecord.stop();
                } catch (RuntimeException ignored) {
                    // The recorder can already be released by Android after an interruption.
                }
                audioRecord.release();
            }
            if (encoder != null) {
                try {
                    encoder.stop();
                } catch (RuntimeException ignored) {
                    // A failed codec may not reach the started state.
                }
                encoder.release();
            }
            if (segmentWriter != null) {
                try {
                    segmentWriter.close();
                } catch (IOException closeError) {
                    if (interruptionMessage == null) interruptionMessage = safeErrorMessage(closeError);
                }
            }
            boolean interrupted = interruptionMessage != null;
            recording.set(false);
            processRecording = false;
            persistActiveState(false);
            releaseWakeLock();
            if (interrupted) broadcast(ACTION_INTERRUPTED, false, true, interruptionMessage);
            broadcast(
                ACTION_STOPPED,
                automaticStop,
                interrupted,
                automaticStop ? "Se alcanzó el límite de tres horas." : interruptionMessage
            );
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }

    @SuppressLint("MissingPermission")
    private AudioRecord createAudioRecord(int source, int bufferSize) {
        AudioFormat audioFormat = new AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
            .build();
        return new AudioRecord.Builder()
            .setAudioSource(source)
            .setAudioFormat(audioFormat)
            .setBufferSizeInBytes(bufferSize)
            .build();
    }

    private void drainEncoder(
        MediaCodec encoder,
        MediaCodec.BufferInfo bufferInfo,
        SegmentWriter writer,
        boolean waitForEnd
    ) throws IOException {
        int idleCount = 0;
        while (true) {
            int outputIndex = encoder.dequeueOutputBuffer(bufferInfo, waitForEnd ? 10_000L : 0L);
            if (outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
                if (!waitForEnd || idleCount++ > 100) return;
                continue;
            }
            if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) continue;
            if (outputIndex < 0) continue;
            ByteBuffer outputBuffer = encoder.getOutputBuffer(outputIndex);
            if (
                outputBuffer != null
                    && bufferInfo.size > 0
                    && (bufferInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0
            ) {
                outputBuffer.position(bufferInfo.offset);
                outputBuffer.limit(bufferInfo.offset + bufferInfo.size);
                byte[] encoded = new byte[bufferInfo.size];
                outputBuffer.get(encoded);
                writer.writeFrame(encoded, bufferInfo.presentationTimeUs);
            }
            boolean endOfStream = (bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
            encoder.releaseOutputBuffer(outputIndex, false);
            if (endOfStream) return;
        }
    }

    private void queueEndOfStream(MediaCodec encoder, long totalSamples) {
        for (int attempt = 0; attempt < 100; attempt++) {
            int inputIndex = encoder.dequeueInputBuffer(10_000L);
            if (inputIndex >= 0) {
                long presentationUs = totalSamples * 1_000_000L / SAMPLE_RATE;
                encoder.queueInputBuffer(inputIndex, 0, 0, presentationUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                return;
            }
        }
    }

    private void persistActiveState(boolean active) {
        SharedPreferences.Editor editor = getPreferences(this).edit().putBoolean(PREF_ACTIVE, active);
        if (active) {
            editor
                .putString(PREF_SESSION_ID, sessionId)
                .putString(PREF_TITLE, title == null ? "" : title)
                .putLong(PREF_STARTED_AT, startedAtEpochMs)
                .putLong(PREF_HEARTBEAT_AT, System.currentTimeMillis());
        } else {
            editor.putLong(PREF_HEARTBEAT_AT, System.currentTimeMillis());
        }
        editor.apply();
    }

    private void broadcast(String action, boolean automatic, boolean interrupted, String message) {
        Intent intent = new Intent(action)
            .setPackage(getPackageName())
            .putExtra(EXTRA_SESSION_ID, sessionId)
            .putExtra(EXTRA_AUTOMATIC, automatic)
            .putExtra(EXTRA_INTERRUPTED, interrupted)
            .putExtra(EXTRA_MESSAGE, message);
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Grabaciones de audio",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Mantiene activa una grabación iniciada por el usuario.");
        channel.setSound(null, null);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private Notification createRecordingNotification() {
        Intent openIntent = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            1,
            createStopIntent(this),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_lifecycle_recording)
            .setContentTitle("LifeCycle está grabando")
            .setContentText(title == null ? "Audio en fragmentos recuperables" : title)
            .setContentIntent(openPendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setWhen(startedAtEpochMs)
            .setUsesChronometer(true)
            .addAction(0, "Detener", stopPendingIntent)
            .build();
    }

    private void startMicrophoneForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private long getAvailableRecordingBytes(File targetDirectory) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            StorageManager manager = getSystemService(StorageManager.class);
            if (manager != null) {
                try {
                    return manager.getAllocatableBytes(manager.getUuidForPath(targetDirectory));
                } catch (IOException | RuntimeException ignored) {
                    // Fall back to the filesystem value if the volume cannot be queried.
                }
            }
        }
        return targetDirectory.getUsableSpace();
    }

    @SuppressLint("WakelockTimeout")
    private void acquireWakeLock() {
        PowerManager manager = (PowerManager) getSystemService(POWER_SERVICE);
        if (manager == null) return;
        wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeCycle:AudioRecorder");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire((maxDurationSeconds + 60L) * 1_000L);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    private static String safeErrorMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) message = error.getClass().getSimpleName();
        return message.substring(0, Math.min(500, message.length()));
    }

    private static int clamp(int value, int minimum, int maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    private static final class SegmentWriter implements AutoCloseable {
        private final File directory;
        private final long recordingStartedAt;
        private final long segmentDurationMs;
        private OutputStream output;
        private File partialFile;
        private int sequenceNumber;
        private long segmentStartedAtEpoch;
        private long segmentFirstPresentationUs = -1L;
        private long lastPresentationUs = -1L;
        private long bytesWritten;

        SegmentWriter(File directory, long recordingStartedAt, long segmentDurationMs) {
            this.directory = directory;
            this.recordingStartedAt = recordingStartedAt;
            this.segmentDurationMs = segmentDurationMs;
        }

        void writeFrame(byte[] encodedFrame, long presentationUs) throws IOException {
            if (output == null) openSegment(presentationUs);
            long elapsedInSegmentMs = Math.max(0L, (presentationUs - segmentFirstPresentationUs) / 1_000L);
            if (bytesWritten > 0 && elapsedInSegmentMs >= segmentDurationMs) {
                closeSegment();
                sequenceNumber += 1;
                openSegment(presentationUs);
            }
            byte[] header = createAdtsHeader(encodedFrame.length);
            output.write(header);
            output.write(encodedFrame);
            bytesWritten += header.length + encodedFrame.length;
            lastPresentationUs = presentationUs;
        }

        private void openSegment(long presentationUs) throws IOException {
            segmentFirstPresentationUs = presentationUs;
            lastPresentationUs = presentationUs;
            bytesWritten = 0L;
            segmentStartedAtEpoch = recordingStartedAt + presentationUs / 1_000L;
            partialFile = new File(
                directory,
                String.format(java.util.Locale.ROOT, "%04d_%d.part", sequenceNumber, segmentStartedAtEpoch)
            );
            output = new BufferedOutputStream(new FileOutputStream(partialFile, false), 64 * 1024);
        }

        private void closeSegment() throws IOException {
            if (output == null) return;
            output.flush();
            output.close();
            output = null;
            long durationMs = Math.max(1_000L, (lastPresentationUs - segmentFirstPresentationUs) / 1_000L + 22L);
            File completed = new File(
                directory,
                String.format(
                    java.util.Locale.ROOT,
                    "%04d_%d_%d.aac",
                    sequenceNumber,
                    segmentStartedAtEpoch,
                    durationMs
                )
            );
            if (bytesWritten > 0L && !partialFile.renameTo(completed)) {
                throw new IOException("No se pudo cerrar el fragmento " + sequenceNumber + ".");
            }
            if (bytesWritten == 0L && partialFile.exists() && !partialFile.delete()) {
                throw new IOException("No se pudo limpiar un fragmento vacío.");
            }
            partialFile = null;
        }

        @Override
        public void close() throws IOException {
            closeSegment();
        }

        private static byte[] createAdtsHeader(int payloadLength) {
            int packetLength = payloadLength + 7;
            int frequencyIndex = 3; // 48 kHz
            int profile = 2; // AAC LC
            byte[] header = new byte[7];
            header[0] = (byte) 0xFF;
            header[1] = (byte) 0xF9;
            header[2] = (byte) (((profile - 1) << 6) + (frequencyIndex << 2) + (CHANNEL_COUNT >> 2));
            header[3] = (byte) (((CHANNEL_COUNT & 3) << 6) + (packetLength >> 11));
            header[4] = (byte) ((packetLength & 0x7FF) >> 3);
            header[5] = (byte) (((packetLength & 7) << 5) + 0x1F);
            header[6] = (byte) 0xFC;
            return header;
        }
    }
}
