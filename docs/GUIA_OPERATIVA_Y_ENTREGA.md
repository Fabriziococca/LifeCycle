# Guía operativa y de entrega

**LifeCycle — revisión técnica del 4 de septiembre de 2026**

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
2. Aplicar, en orden, las migraciones pendientes:
   - `20260904034548_lifecycle_subscriptions_and_transcription_foundation.sql`;
   - `20260904035623_transcription_pipeline.sql`.
3. Ejecutar `supabase/verification/20260904_lifecycle_expansion_security_check.sql`; todos los controles deben devolver `true`.
4. Ejecutar los asesores de seguridad y rendimiento de Supabase y resolver hallazgos nuevos relevantes.
5. Configurar `GEMINI_API_KEY` en Render sin copiar su valor a archivos o mensajes.
6. Publicar el commit validado y esperar el despliegue.
7. Comprobar `/api/health`, la web y los logs del worker.
8. Hacer una transcripción corta no confidencial y comprobar texto, descarga y limpieza programada.
9. Instalar el APK de prueba y ejecutar el protocolo físico Android.

Las migraciones son aditivas, pero cambian contratos de sincronización y crean tablas/bucket. No se despliega el frontend nuevo antes de que la base esté preparada.

## Comandos locales

```powershell
npm test
npm run android:debug
npm start
```

El APK debug queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

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
- Los trabajos bloqueados se recuperan tras 15 minutos y respetan su máximo de intentos.
- Las sesiones correctas programan limpieza a 24 horas; las fallidas conservan audio hasta siete días.
- La eliminación manual vuelve a intentar retirar objetos aunque una ejecución previa haya quedado incompleta.
