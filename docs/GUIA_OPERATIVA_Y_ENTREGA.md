# Guía operativa y de entrega

**LifeCycle — revisión técnica del 5 de septiembre de 2026 (migraciones del 6/9 UTC)**

## Componentes nuevos

- avisos con varios horarios para una misma entidad y deduplicación por horario;
- módulo especializado de Suscripciones y gastos financieros idempotentes;
- PWA existente más aplicación Android mediante Capacitor;
- grabación nativa Android con servicio foreground y fragmentos recuperables;
- biblioteca de transcripciones, importación, cola persistente, Gemini, exportación y borrado diferido;
- configuración inicial opcional con presets neutrales, sin copiar datos privados.

## Configuración

Usar `.env.example` como inventario. Las claves privadas nunca deben incluirse en el cliente, el APK, Git ni los logs.

Variables necesarias para el backend actual:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
GEMINI_API_KEY=
```

Opciones de transcripción:

```env
GEMINI_TRANSCRIPTION_MODEL=gemini-3.5-transcribe
GEMINI_ARTIFACT_MODEL=gemini-2.5-flash
TRANSCRIPTION_DAILY_JOB_LIMIT=100
TRANSCRIPTION_SEGMENT_SECONDS=300
```

## Orden de publicación

1. Confirmar que Git sólo contiene cambios intencionales y que la suite completa pasa.
2. Confirmar estas migraciones, ya aplicadas en producción y necesarias en instalaciones nuevas:
   - `20260906020420_lifecycle_subscriptions_and_transcription_foundation.sql`;
   - `20260906020429_transcription_pipeline.sql`;
   - `20260906020827_transcription_owner_fk_indexes.sql`.
3. Ejecutar `supabase/verification/20260904_lifecycle_expansion_security_check.sql`; todos los controles deben devolver `true`.
4. Ejecutar los asesores de seguridad y rendimiento de Supabase y resolver hallazgos nuevos relevantes.
5. Confirmar que el proyecto de la clave en Google AI Studio está en Free tier, sin facturación de pago; después configurar `GEMINI_API_KEY` en Render sin exponer su valor. Mientras falte, la grabación permanece disponible y la interfaz advierte que el procesamiento está pendiente de activación.
6. Publicar el commit validado y esperar el despliegue.
7. Comprobar `/api/health`, la web y los logs del worker.
8. Hacer una transcripción corta no confidencial y comprobar texto, descarga y limpieza programada.
9. Instalar el APK de prueba y ejecutar el protocolo físico Android.

Las migraciones son aditivas, pero cambian contratos de sincronización y crean tablas/bucket. No se despliega el frontend nuevo antes de que la base esté preparada.

### Conexión de Render comprobada

El 6/9/2026 UTC se alineó la referencia del servicio existente con `https://github.com/Fabriziococca/LifeCycle`, conservando `main`, la URL pública y el plan Free. El push no produjo un despliegue automático: el build posterior advirtió que Render no tenía acceso conectado al repositorio y lo clonó mediante su URL pública. Aunque la API indique `autoDeploy: yes`, no asumir que un push publica hasta reconectar y verificar la integración Git. Mientras tanto, comprobar que no haya un despliegue activo y publicar manualmente el commit validado, verificándolo después en `/api/health`.

## Comandos locales

```powershell
npm test
npm run test:ui
npm run android:debug
npm start
```

El APK debug queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

`test:ui` usa Playwright con Chrome aislado y datos ficticios. Necesita el módulo `playwright` disponible o su ruta en `LIFECYCLE_PLAYWRIGHT_MODULE`; guarda capturas en `.tmp-sb/ui-smoke`. No usa sesiones personales, Supabase productivo ni emuladores. Comprueba carga real de módulos, preferencias, alta de suscripción con dos horarios, búsqueda, biblioteca y cierre de Más en 1440/390 px y claro/oscuro. No reemplaza la prueba física.

## Evidencia de esta revisión

- 382 pruebas automatizadas, incluido análisis explícito de sintaxis ES module de todos los scripts propios publicados y compatibilidad de dependencias corregidas.
- Cuatro combinaciones visuales, con alta y apertura de suscripción desde búsqueda: correctas.
- APK debug compilado correctamente; sin instalar ni accionar el emulador de otro proyecto.
- 23 migraciones locales/remotas alineadas; 12/12 controles de seguridad SQL correctos.
- `supabase/verification/20260906_transcription_behavior_rollback.sql`: 8/8 resultados correctos en producción. Usa las dos cuentas existentes para verificar aislamiento, permisos, gastos idempotentes, cuotas, recuperación y retención; revierte todos los datos de prueba.
- Asesores: sin errores y sin claves foráneas compuestas nuevas sin índice. Las tablas de trabajo son privadas para el backend; no necesitan políticas de acceso de cliente. Se mantiene la observación preexistente sobre contraseñas filtradas.
- `npm audit` y `npm audit --omit=dev`: cero vulnerabilidades conocidas tras fijar `qs` 6.16.0 y `uuid` 11.1.1 sólo dentro de `xcode` (dependencia de desarrollo de Capacitor). Se verifican la API CommonJS y el generador de identificadores que utiliza `xcode`; no equivale a validar iOS.
- Pendientes externos: confirmar Free tier y activar/probar Gemini con audio no confidencial, recepción Push real y protocolo físico Android. Compilar no demuestra continuidad durante tres horas.

## Protocolo Android mínimo

En el Galaxy S24 FE con Android 16:

1. conceder micrófono y notificaciones;
2. grabar dos fragmentos con la aplicación visible;
3. bloquear la pantalla durante más de cinco minutos;
4. desbloquear y comprobar continuidad, orden y duración;
5. cambiar a otra aplicación sin usar el micrófono y repetir;
6. provocar una interrupción tomando el micrófono desde otra aplicación y comprobar el aviso y la recuperación;
7. cortar la red, grabar, restaurarla y verificar subida pendiente;
8. detener desde la notificación persistente;
9. transcribir y verificar que el original pueda descargarse antes de su limpieza.

No se declara validada la grabación prolongada hasta completar esta prueba física.

## Diagnóstico

- `/api/health` expone si el worker está configurado, disponible, ejecutando, en pausa por cuota o fallando.
- La cola diferencia `queued`, `processing`, `waiting_quota`, `completed` y `failed`.
- Los reintentos de red no consumen horarios adicionales de notificaciones ni duplican gastos de suscripción.
- Un 503 en `/api/transcriptions/run` indica clave ausente o migración no aplicada; no debe ocultarse con reintentos infinitos.

## Recuperación

- Los audios locales sólo se eliminan después de confirmar la persistencia remota correspondiente.
- Las reservas se renuevan cada minuto; los trabajos abandonados se recuperan tras 15 minutos. Sólo el worker que conserva la reserva puede confirmar sus resultados.
- Los errores transitorios tienen intentos acotados. Las cuotas 429 no agotan esos intentos: esperan con backoff persistente y respetan `Retry-After`; la cuota diaria de Google se retoma después de medianoche del Pacífico. No se rotan claves para evadir la cuota del proyecto.
- Las sesiones correctas programan limpieza a 24 horas; las fallidas conservan audio hasta siete días.
- La limpieza enumera el prefijo privado completo de la sesión, incluidos fragmentos huérfanos de intentos interrumpidos. Una respuesta SQL perdida no provoca el borrado inmediato de objetos que otro intento podría haber confirmado.
