# Evaluación de Arquitectura de Audio y Móvil (Android)
**LifeCycle — Fase D (Tandas 17A, 17B y 17C)**
**Última actualización:** Septiembre 2026

Este documento evalúa las alternativas técnicas para la captura de voz en Android, el comportamiento ante el bloqueo de pantalla, la gestión de permisos del micrófono y la decisión entre PWA pura versus envoltorios nativos.

---

## 1. Comparación de Alternativas de Arquitectura Móvil

| Criterio | PWA Pura (Opus + WakeLock) | Trusted Web Activity (TWA) | Capacitor / Cordova |
|---|---|---|---|
| **Estabilidad de audio en grabación** | **Alta**: MediaRecorder API nativo con Opus + Screen WakeLock API para evitar suspensión del procesador. | **Alta**: Mismo motor Chromium del sistema. | **Alta**: Plugins nativos de micrófono o WebView. |
| **Costo de mantenimiento** | **$0 / mes**: Sin dependencias nativas ni SDKs externos. | **Medio**: Requiere empaquetado con Bubblewrap y Java/Gradle. | **Alto**: Requiere Gradle, Android Studio, actualizaciones periódicas de plugins. |
| **Costo de publicación** | **$0**: Instalación directa desde el navegador (Add to Home Screen / WebAPK). | **$25 USD**: Pago único de cuenta de desarrollador Google Play. | **$25 USD**: Pago único de cuenta de desarrollador Google Play. |
| **Velocidad de actualización** | **Instantánea**: El Service Worker actualiza el código inmediatamente tras el despliegue. | **Retrasada**: Pasa por el pipeline de release de Google Play Store. | **Retrasada**: Requiere compilar APK/AAB y esperar aprobación de Google. |
| **Acceso a hardware necesario** | **Completo**: Micrófono (getUserMedia), Vibración, Pantalla activa (Wake Lock), Almacenamiento (IndexedDB). | **Completo**: Exactamente idéntico a la PWA. | **Completo**: Vía bindings de Java/Kotlin. |

---

## 2. Decisión Arquitectónica Adoptada

Se adopta **PWA Pura con APIs Web Modernas**, complementada por:
1. **MediaStream Recording API:** Captura directa en formato `audio/webm;codecs=opus` a 32 kbps (mono).
2. **Screen Wake Lock API (`navigator.wakeLock`):** Activa un bloqueo de suspensión de pantalla mientras el usuario está grabando, garantizando que el sistema operativo Android no entre en modo Doze ni degrade la frecuencia de muestreo del micrófono.
3. **Almacenamiento local en IndexedDB (`lifecycle_audio_cache`):** Los fragmentos de audio grabados se guardan localmente en el dispositivo conforme se generan. Si se pierde la conexión o se interrumpe la subida, la nota de voz queda a salvo en el dispositivo y puede reintentarse.
4. **Subida por trozos (Chunked Upload):** Las notas de más de 2 minutos se suben en partes de 1 MB, permitiendo reanudar ante cortes de red móvil sin reenviar todo el audio.

---

## 3. Comportamiento en Android y Casos Límite

* **Pantalla bloqueada / Suspensión:**
  * El uso de `navigator.wakeLock.request('screen')` mantiene la pantalla encendida durante la grabación activa.
  * Al pulsar 'Detener' o pausar la grabación, el WakeLock se libera inmediatamente para preservar la batería del dispositivo.
* **Permisos de micrófono:**
  * La solicitud se dispara únicamente por acción directa del usuario al tocar el botón de grabar ('Iniciar nota de voz').
  * Se incluye tratamiento de error explicativo si el usuario tiene bloqueado el permiso en los ajustes de Android.
* **Grabaciones en segundo plano / Cambio de app:**
  * Si el usuario cambia de aplicación mientras graba, el evento `visibilitychange` o `pagehide` pausa automáticamente la grabación y guarda el fragmento actual en IndexedDB para no perder lo que ya se habló.

---

## 4. Conclusión

La PWA Pura cumple al 100% con los requerimientos operativos de LifeCycle, elimina los $25 de Google Play y la deuda técnica de Android Studio, y ofrece una experiencia de grabación fluida y confiable en cualquier dispositivo Android moderno.