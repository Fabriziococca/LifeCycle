# Arquitectura de audio y Android

**LifeCycle — revisión técnica del 4 de septiembre de 2026**

## Decisión

LifeCycle conserva una sola aplicación web y PWA, y agrega **Capacitor para Android**. No se migra a Flutter, Firebase ni a una segunda interfaz nativa.

- La web continúa funcionando en escritorio y navegador móvil.
- El APK reutiliza el mismo HTML, CSS y JavaScript.
- Sólo la capacidad que necesita integración real con Android —grabar con la pantalla bloqueada— vive en un plugin Java propio.
- Publicar en Play Store no es necesario para instalar y probar un APK firmado localmente. Una publicación futura requerirá la cuenta y los requisitos vigentes de Google Play.

## Dos rutas de grabación

### Navegador/PWA

Usa `getUserMedia` y `MediaRecorder`, guarda cada fragmento en IndexedDB y lo sube sin detener la captura mientras espera la red. Es la alternativa compatible con web, pero el navegador o Android pueden suspenderla al bloquear la pantalla o mandar la página al fondo. No se promete grabación prolongada en segundo plano desde una PWA.

### Aplicación Android

Usa `LifeCycleAudioRecorderService`, un servicio foreground de tipo `microphone` iniciado por una acción explícita del usuario. Mientras está activo:

- Android muestra una notificación persistente con una acción para detener;
- se mantiene un `PARTIAL_WAKE_LOCK` acotado a la duración máxima;
- `AudioRecord` captura un canal mono a 48 kHz;
- `MediaCodec` codifica AAC-LC a 48 kbit/s;
- el audio se cierra en fragmentos recuperables de cinco minutos;
- la grabación se detiene automáticamente a las tres horas;
- los fragmentos quedan en almacenamiento privado de la aplicación hasta que la subida se confirma.

La cámara, una llamada u otra aplicación que tome el micrófono puede interrumpir la captura. LifeCycle conserva lo ya cerrado y comunica la interrupción al volver a la aplicación; Android no permite garantizar que dos aplicaciones controlen simultáneamente el micrófono.

## Flujo de datos

1. El usuario crea una sesión y acepta expresamente el aviso de privacidad.
2. Android o el navegador producen fragmentos locales.
3. Cada fragmento se sube al bucket privado `transcription-audio` bajo `user_id/session_id/...`.
4. PostgreSQL registra metadatos, aplica RLS, relaciones de propietario y presupuestos de almacenamiento.
5. El worker de Render reclama trabajos persistentes y envía el audio a Gemini.
6. Las respuestas se guardan por fragmento y luego se unen por número de secuencia, sin resumirlas.
7. Resumen y apuntes son trabajos opcionales y documentos separados.
8. Tras completar la transcripción se programa el borrado del audio cloud a las 24 horas. Los fallos conservan audio hasta siete días para permitir recuperación.

## Importaciones

La web acepta audio o video de hasta 50 MB por archivo. Desde 6 MB utiliza el protocolo TUS con fragmentos de 6 MB y reanudación. El worker extrae la pista de audio con FFmpeg, la normaliza a AAC mono de 48 kbit/s y la divide en tramos de cinco minutos antes de transcribir.

El límite de 50 MB es deliberado para el proyecto gratuito actual. Una grabación larga debe hacerse desde LifeCycle, donde ya nace fragmentada; no se cortan archivos multimedia existentes por bytes porque eso puede corromper el contenedor.

## Estado verificable

- El proyecto Android y el plugin nativo se compilan con Gradle.
- Hay pruebas automatizadas para contratos nativos, fragmentación web, preparación real con FFmpeg, cola, reintentos, cuotas y unión del texto.
- La prueba real con pantalla bloqueada en el Galaxy S24 FE / Android 16 queda como criterio obligatorio antes de declarar la función lista para uso cotidiano.
- iOS no forma parte de este alcance porque no existe un dispositivo ni una Mac disponibles para validarlo.
