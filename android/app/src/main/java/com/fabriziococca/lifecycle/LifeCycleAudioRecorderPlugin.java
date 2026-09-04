package com.fabriziococca.lifecycle;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(
    name = "LifeCycleAudioRecorder",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class LifeCycleAudioRecorderPlugin extends Plugin {
    private static final Pattern SESSION_ID_PATTERN = Pattern.compile(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    );
    private static final Pattern CHUNK_PATTERN = Pattern.compile(
        "^(\\d{4})_(\\d+)_(\\d+)\\.aac$"
    );
    private BroadcastReceiver stateReceiver;
    private boolean receiverRegistered;

    @Override
    public void load() {
        stateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                JSObject payload = new JSObject();
                payload.put("sessionId", intent.getStringExtra(LifeCycleAudioRecorderService.EXTRA_SESSION_ID));
                payload.put("automatic", intent.getBooleanExtra(LifeCycleAudioRecorderService.EXTRA_AUTOMATIC, false));
                payload.put("interrupted", intent.getBooleanExtra(LifeCycleAudioRecorderService.EXTRA_INTERRUPTED, false));
                payload.put("message", intent.getStringExtra(LifeCycleAudioRecorderService.EXTRA_MESSAGE));
                if (LifeCycleAudioRecorderService.ACTION_INTERRUPTED.equals(intent.getAction())) {
                    notifyListeners("recordingInterrupted", payload, true);
                } else if (LifeCycleAudioRecorderService.ACTION_STOPPED.equals(intent.getAction())) {
                    notifyListeners("recordingStopped", payload, true);
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(LifeCycleAudioRecorderService.ACTION_INTERRUPTED);
        filter.addAction(LifeCycleAudioRecorderService.ACTION_STOPPED);
        ContextCompat.registerReceiver(
            getContext(),
            stateReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
        receiverRegistered = true;
    }

    @Override
    protected void handleOnDestroy() {
        if (receiverRegistered && stateReceiver != null) {
            try {
                getContext().unregisterReceiver(stateReceiver);
            } catch (IllegalArgumentException ignored) {
                // The Android lifecycle may already have unregistered it.
            }
        }
        receiverRegistered = false;
        super.handleOnDestroy();
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        List<String> missingAliases = new ArrayList<>();
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            missingAliases.add("microphone");
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            missingAliases.add("notifications");
        }
        if (!missingAliases.isEmpty()) {
            requestPermissionForAliases(
                missingAliases.toArray(new String[0]),
                call,
                "recordingPermissionsCallback"
            );
            return;
        }
        startRecordingWithPermissions(call);
    }

    @PermissionCallback
    private void recordingPermissionsCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("El permiso de micrófono es obligatorio para grabar.", "microphone_denied");
            return;
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            call.reject(
                "Android necesita mostrar una notificación persistente mientras graba.",
                "notification_denied"
            );
            return;
        }
        startRecordingWithPermissions(call);
    }

    private void startRecordingWithPermissions(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        if (!isValidSessionId(sessionId)) {
            call.reject("La sesión de grabación no es válida.", "invalid_session");
            return;
        }
        if (LifeCycleAudioRecorderService.isRecordingActive(getContext())) {
            call.reject("Ya existe una grabación activa.", "already_recording");
            return;
        }
        int maxDurationSeconds = clamp(call.getInt("maxDurationSeconds", 10_800), 60, 10_800);
        int segmentDurationSeconds = clamp(call.getInt("segmentDurationSeconds", 300), 60, 900);
        String title = safeTitle(call.getString("title", "Grabación LifeCycle"));
        Intent intent = LifeCycleAudioRecorderService.createStartIntent(
            getContext(), sessionId, title, maxDurationSeconds, segmentDurationSeconds
        );
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            JSObject result = new JSObject();
            result.put("accepted", true);
            result.put("sessionId", sessionId);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Android no permitió iniciar la grabación en segundo plano.", "start_failed", error);
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (!LifeCycleAudioRecorderService.isRecordingActive(getContext())) {
            JSObject result = new JSObject();
            result.put("stopped", false);
            call.resolve(result);
            return;
        }
        try {
            getContext().startService(LifeCycleAudioRecorderService.createStopIntent(getContext()));
            JSObject result = new JSObject();
            result.put("stopped", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("No se pudo detener la grabación.", "stop_failed", error);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences preferences = LifeCycleAudioRecorderService.getPreferences(getContext());
        boolean active = LifeCycleAudioRecorderService.isRecordingActive(getContext());
        String sessionId = preferences.getString(LifeCycleAudioRecorderService.PREF_SESSION_ID, null);
        boolean recoverable = !active && isValidSessionId(sessionId) && hasRecoverableAudio(sessionId);
        JSObject result = new JSObject();
        result.put("active", active);
        result.put("recoverable", recoverable);
        result.put("sessionId", sessionId);
        result.put("title", preferences.getString(LifeCycleAudioRecorderService.PREF_TITLE, ""));
        result.put("startedAt", preferences.getLong(LifeCycleAudioRecorderService.PREF_STARTED_AT, 0L));
        result.put("heartbeatAt", preferences.getLong(LifeCycleAudioRecorderService.PREF_HEARTBEAT_AT, 0L));
        call.resolve(result);
    }

    @PluginMethod
    public void listChunks(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        if (!isValidSessionId(sessionId)) {
            call.reject("La sesión no es válida.", "invalid_session");
            return;
        }
        try {
            File sessionDirectory = getSessionDirectory(sessionId);
            salvagePartialChunk(sessionDirectory);
            File[] files = sessionDirectory.listFiles(file -> file.isFile() && CHUNK_PATTERN.matcher(file.getName()).matches());
            if (files == null) files = new File[0];
            Arrays.sort(files, Comparator.comparing(File::getName));
            JSArray chunks = new JSArray();
            for (File file : files) {
                Matcher matcher = CHUNK_PATTERN.matcher(file.getName());
                if (!matcher.matches()) continue;
                JSObject chunk = new JSObject();
                chunk.put("sequenceNumber", Integer.parseInt(matcher.group(1)));
                chunk.put("startedAt", Long.parseLong(matcher.group(2)));
                chunk.put("durationMs", Long.parseLong(matcher.group(3)));
                chunk.put("byteSize", file.length());
                chunk.put("mimeType", "audio/aac");
                chunk.put("path", file.getCanonicalPath());
                chunks.put(chunk);
            }
            JSObject result = new JSObject();
            result.put("chunks", chunks);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudieron enumerar los fragmentos.", "list_failed", error);
        }
    }

    @PluginMethod
    public void readChunk(PluginCall call) {
        String requestedPath = call.getString("path", "");
        try {
            File file = requireSafeAudioFile(requestedPath);
            if (file.length() < 1 || file.length() > 52_428_800L) {
                throw new IOException("El fragmento tiene un tamaño inválido.");
            }
            byte[] bytes = readFile(file);
            JSObject result = new JSObject();
            result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            result.put("byteSize", bytes.length);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo leer el fragmento solicitado.", "read_failed", error);
        }
    }

    @PluginMethod
    public void deleteSessionAudio(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        if (!isValidSessionId(sessionId)) {
            call.reject("La sesión no es válida.", "invalid_session");
            return;
        }
        SharedPreferences preferences = LifeCycleAudioRecorderService.getPreferences(getContext());
        if (
            LifeCycleAudioRecorderService.isRecordingActive(getContext())
                && sessionId.equals(preferences.getString(LifeCycleAudioRecorderService.PREF_SESSION_ID, null))
        ) {
            call.reject("No se puede borrar una grabación activa.", "recording_active");
            return;
        }
        try {
            deleteRecursively(getSessionDirectory(sessionId));
            JSObject result = new JSObject();
            result.put("deleted", true);
            call.resolve(result);
        } catch (IOException error) {
            call.reject("No se pudo eliminar el audio local.", "delete_failed", error);
        }
    }

    private boolean hasRecoverableAudio(String sessionId) {
        File directory = getSessionDirectory(sessionId);
        File[] files = directory.listFiles(file -> file.isFile() && file.length() > 0);
        return files != null && files.length > 0;
    }

    private void salvagePartialChunk(File sessionDirectory) throws IOException {
        if (!sessionDirectory.exists()) return;
        File[] partialFiles = sessionDirectory.listFiles(file -> file.isFile() && file.getName().endsWith(".part"));
        if (partialFiles == null) return;
        for (File partial : partialFiles) {
            Matcher matcher = Pattern.compile("^(\\d{4})_(\\d+)\\.part$").matcher(partial.getName());
            if (!matcher.matches() || partial.length() < 7) continue;
            long startedAt = Long.parseLong(matcher.group(2));
            long durationMs = Math.max(1_000L, Math.min(900_000L, partial.lastModified() - startedAt));
            File recovered = new File(
                sessionDirectory,
                matcher.group(1) + "_" + startedAt + "_" + durationMs + ".aac"
            );
            if (!partial.renameTo(recovered)) {
                throw new IOException("No se pudo recuperar un fragmento parcial.");
            }
        }
    }

    private File requireSafeAudioFile(String requestedPath) throws IOException {
        File root = new File(getContext().getFilesDir(), "transcriptions").getCanonicalFile();
        File candidate = new File(requestedPath).getCanonicalFile();
        String rootPrefix = root.getPath() + File.separator;
        if (!candidate.getPath().startsWith(rootPrefix) || !candidate.isFile() || !candidate.getName().endsWith(".aac")) {
            throw new IOException("Ruta de audio no permitida.");
        }
        return candidate;
    }

    private File getSessionDirectory(String sessionId) {
        return new File(new File(getContext().getFilesDir(), "transcriptions"), sessionId);
    }

    private static byte[] readFile(File file) throws IOException {
        try (FileInputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream((int) file.length())) {
            byte[] buffer = new byte[16_384];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                if (read > 0) output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static void deleteRecursively(File file) throws IOException {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        if (!file.delete()) throw new IOException("No se pudo borrar " + file.getName());
    }

    private static boolean isValidSessionId(String sessionId) {
        return sessionId != null && SESSION_ID_PATTERN.matcher(sessionId).matches();
    }

    private static String safeTitle(String title) {
        String normalized = title == null ? "Grabación LifeCycle" : title.replaceAll("\\s+", " ").trim();
        if (normalized.isEmpty()) normalized = "Grabación LifeCycle";
        return normalized.substring(0, Math.min(120, normalized.length()));
    }

    private static int clamp(Integer value, int minimum, int maximum) {
        int safeValue = value == null ? minimum : value;
        return Math.max(minimum, Math.min(maximum, safeValue));
    }
}
