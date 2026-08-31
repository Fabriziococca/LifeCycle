# Operación y verificación de LifeCycle

Este documento separa las comprobaciones automáticas del repositorio de aquellas que necesitan infraestructura o un dispositivo real.

## Acceso y registro por invitación

El alta pública de Supabase debe permanecer desactivada. LifeCycle crea cuentas
únicamente mediante `POST /api/auth/register`, que requiere:

- un código de invitación válido;
- una contraseña de 12 a 128 caracteres;
- `SUPABASE_SERVICE_ROLE_KEY` disponible solo en el backend;
- `REGISTRATION_ACCESS_CODE_SHA256` configurado en Render.

`REGISTRATION_ACCESS_CODE_SHA256` es el SHA-256 hexadecimal del código que se
comparte con las personas invitadas. El código y la Service Role nunca se
incluyen en `/api/config`, HTML, JavaScript del navegador, logs ni commits. Si
falta cualquiera de esas dos variables, el registro se desactiva y el endpoint
responde de forma cerrada.

Para generar el hash localmente sin guardar el código en archivos del proyecto:

```powershell
node -e "const c=require('crypto'); process.stdout.write(c.createHash('sha256').update(process.argv[1].trim()).digest('hex'))" "CODIGO-ELEGIDO"
```

Después de configurar la variable en Render hay que reiniciar o desplegar el
servicio y comprobar que `GET /api/config` devuelva
`registrationEnabled: true` sin exponer el hash.

## Notificaciones

### Comportamiento esperado

- El backend ejecuta los dos motores cada cinco minutos.
- Las alertas con hora exacta solo se recuperan durante 15 minutos; después vencen.
- Esas alertas usan urgencia alta y un TTL que disminuye hasta el final de la ventana.
- El Service Worker descarta cualquier payload que llegue después de `expiresAt`.
- Si el proveedor aceptó el envío pero el dispositivo no reportó recepción en cinco minutos, el backend intenta una sola vez más mientras la ventana original siga vigente.
- El reintento conserva exactamente el mismo vencimiento. `Topic` en Web Push y `tag` en el Service Worker reemplazan el intento pendiente en vez de generar avisos visibles duplicados.
- Cada consulta del backend a Supabase vence a los 15 segundos y cada motor tiene un watchdog inferior al intervalo de cinco minutos; los ciclos bloqueados dejan de inmovilizar el scheduler indefinidamente.
- Las tareas muy urgentes no tienen horario silencioso.
- El primer aviso se puede emitir en el siguiente ciclo del backend.
- Los avisos siguientes respetan el intervalo configurado, por defecto cuatro horas.
- Cada endpoint Push único registrado para el usuario recibe el aviso.
- Un endpoint rechazado con HTTP 404 o 410 se elimina automáticamente.
- Una ejecución manual forzada no modifica la fecha del próximo ciclo normal.

### Estado público no sensible

`GET /api/health`

Además del commit activo, devuelve si la infraestructura de notificaciones está configurada, si el planificador está ejecutándose, cuándo terminó correctamente por última vez, duración, timeouts, ciclos omitidos y resultado agregado del último control de reintentos.

### Diagnóstico administrativo

`GET /api/admin/notification-status`

Requiere el encabezado `X-Admin-Token`. Informa:

- presencia de Supabase, Service Role y VAPID;
- último intento, último éxito y fallos consecutivos del planificador;
- filas de usuarios y suscripciones;
- cantidad real de endpoints únicos;
- cantidad de usuarios con dispositivos registrados.

No devuelve claves, tokens ni URLs de endpoints.

### Prueba administrativa completa

`GET /api/check-reminders`

Requiere el encabezado `X-Admin-Token` y puede enviar notificaciones reales. Revisa alertas por horario, eventos de Trading, robot y tareas muy urgentes. Al ser una prueba forzada, no posterga el próximo aviso normal.

### Prueba por dispositivo

En cada celular o computadora:

1. Abrir LifeCycle mediante HTTPS e iniciar sesión.
2. Entrar en Perfil > Notificaciones.
3. Activar notificaciones.
4. Verificar que el panel muestre el dispositivo como listo y el total registrado.
5. Usar “Enviar notificación de prueba”.
6. Si el permiso está bloqueado, habilitarlo desde la configuración del sitio y desde el sistema operativo.
7. En Brave, habilitar el servicio de mensajería Push de Google si el navegador lo solicita.

El botón “Diagnosticar este dispositivo” realiza una comprobación no destructiva de HTTPS, compatibilidad, permiso, Service Worker, suscripción local, registro en LifeCycle, configuración del backend y una prueba real si el equipo ya está registrado. No puede cambiar por sí mismo los permisos de Brave ni de Windows.

### Administración y diagnóstico por dispositivo

La pantalla Perfil > Notificaciones permite:

- identificar y renombrar cada celular o computadora;
- enviar una prueba a un dispositivo específico;
- revocar un endpoint sin desactivar los demás;
- ver la última actividad y si el último intento fue aceptado o rechazado;
- ver el estado resumido del motor y su último error registrado;
- abrir `Diagnóstico avanzado > Ver actividad técnica` cuando sea necesario;
- filtrar los últimos intentos por aceptados, fallidos, vencidos, resultado desconocido o ausencia de dispositivos.

“Aceptada por Push” significa que el proveedor Web Push recibió correctamente el mensaje. “Recibida” indica que el Service Worker procesó el evento y “Mostrada” que `showNotification` terminó correctamente. Ningún estado automático prueba que la persona haya leído el aviso. El backend conserva como máximo 90 días de historial técnico y elimina automáticamente los registros anteriores.

El esquema base de estas funciones está registrado en:

`supabase/migrations/20260801062050_push_management_and_history.sql`

El diagnóstico completo, los campos históricos de confirmación, el estado sin dispositivos y la retención están registrados en:

`supabase/migrations/20260801193348_complete_push_diagnostics_and_retention.sql`

El permiso de backend necesario para actualizar el último resultado de cada dispositivo está registrado en:

`supabase/migrations/20260801201540_grant_push_subscription_updates.sql`

La ventana de frescura, el estado pendiente/desconocido y la telemetría automática del dispositivo están registrados en:

`supabase/migrations/20260821040806_notification_delivery_freshness_and_telemetry.sql`

El reintento único, su reserva atómica y los índices de diagnóstico están registrados en:

`supabase/migrations/20260831044654_add_safe_push_retry.sql`

La migración de reintento debe aplicarse antes de desplegar el backend que la consume. El código mantiene un fallback de compatibilidad para que una diferencia temporal de esquema nunca detenga el envío original de avisos.

La migración siguiente mantiene la base alineada con el cliente y cierra una defensa adicional:

`supabase/migrations/20260801062115_harden_private_snapshots_and_sync_schema.sql`

Esta segunda migración agrega `projectPulseTemplates` a la lista de claves que el RPC autenticado puede sincronizar y activa/impone RLS sobre el snapshot privado de seguridad. No concede acceso nuevo a `anon` ni a `authenticated`.

## Trading

Los eventos financieros continúan guardándose dentro de
`finanzasData.tradingEvents`, por lo que conservan el flujo offline-first, la
sincronización autenticada y el backup JSON de Finanzas. La base proyecta ese
arreglo de forma transaccional en `public.trading_events`: el backend obtiene
filas tipadas e indexadas, mientras que el JSON original se mantiene como
fuente compatible y vía de reversión.

`public.trading_events` habilita RLS y solo permite lectura de filas propias a
usuarios autenticados. Las escrituras no se exponen al navegador: un trigger
privado actualiza la proyección cuando cambia el documento sincronizado.

Cada evento conserva empresa, ticker opcional, nombre, fecha y hora, notas,
fuente opcional, estado e intervalos de aviso. Los valores iniciales son 60,
30, 15, 7 y 1 día, pero pueden editarse entre 1 y 365 días.

El motor configurado del backend evalúa los eventos activos cada cinco minutos.
Cada envío usa una clave formada por evento, fecha programada y umbral. Antes de
enviar, el backend reserva esa clave de forma atómica en
`private.trading_notification_dispatches`; así, dos procesos o un reinicio de
Render no pueden emitir simultáneamente el mismo aviso. Los estados fallidos y
sin dispositivos admiten reintentos con espera, mientras que un envío aceptado
queda cerrado. `alerts_sent_log` se conserva temporalmente como compatibilidad
con versiones anteriores. Si cambia la fecha del evento se genera una serie
nueva de claves; editar solamente el texto no duplica avisos ya enviados.

La pestaña Trading consulta el historial existente mediante
`GET /api/push/history?scope=trading`. El endpoint sigue requiriendo la sesión
Supabase del usuario y devuelve únicamente sus registros. El historial técnico
mantiene la retención general de 90 días y no confirma que la persona haya visto
el aviso.

El recordatorio semanal `Trading & Mercado` continúa siendo una definición
recurrente separada. No se consultan APIs bursátiles ni calendarios externos en
esta versión.

## Backups

El backup JSON versionado conserva todos los datos estructurados sincronizados, incluidas definiciones, historiales y referencias de adjuntos. La restauración valida el archivo completo antes de escribir y revierte todos los cambios si una escritura falla.

Los adjuntos médicos nuevos permanecen como binarios privados en Supabase Storage. El JSON conserva su referencia, pero no contiene los bytes del PDF o imagen. Por eso:

- el backup actual es rápido y correcto para restaurar dentro del mismo proyecto de Supabase;
- no es todavía un backup portátil independiente de Supabase;
- una exportación portátil futura deberá generar un paquete con JSON, manifiesto y binarios descargados de Storage.

Ambas modalidades son útiles y no deberían sustituirse entre sí.

Antes de cambios estructurales, la base también conserva snapshots inmutables
en `private.user_data_snapshots`. Son puntos de recuperación internos y no
sustituyen una exportación externa periódica ni el backup JSON descargable.

## Render y despliegue automático

El repositorio local apunta a `Fabriziococca/LifeCycle`, mientras que las capturas de Render todavía muestran `Fabriziococca/HygieneTracker`. Los logs también indican que Render intenta clonar sin acceso a la integración del repositorio. Esto es consistente con una conexión antigua o permisos perdidos después de un cambio de nombre.

El runtime queda acotado a Node 24.x LTS tanto en `package.json` como en GitHub Actions. Esto evita que Render vuelva a seleccionar automáticamente una versión Current de otro major (como ocurrió con Node 26) y mantiene producción y CI sobre la misma línea soportada.

Al terminar la tanda de código:

1. En Render > Settings, revisar el repositorio y las credenciales Git.
2. Reconectar la cuenta de GitHub y autorizar explícitamente el repositorio actual.
3. Confirmar que la rama vinculada sea `main`.
4. Configurar Auto-Deploy como `On Commit`, o `After CI Checks Pass` si se quiere esperar al workflow `Validate LifeCycle`.
5. Evitar “Deploy a specific commit” y “Clear build cache & deploy” durante la comprobación, porque pueden desactivar el despliegue automático.
6. Hacer un commit pequeño de prueba y comprobar que Render lo detecte sin intervención.

El workflow de GitHub incluido ejecuta instalación exacta, pruebas y verificación sintáctica antes de considerar válida una revisión.

## Estado de Supabase

Las migraciones de dispositivos Push, historial, endurecimiento del snapshot privado y optimización de políticas RLS ya están aplicadas en producción:

- `20260801062050_push_management_and_history.sql`;
- `20260801062115_harden_private_snapshots_and_sync_schema.sql`;
- `20260801062403_optimize_authenticated_rls_policies.sql`;
- `20260801193348_complete_push_diagnostics_and_retention.sql`;
- `20260801201540_grant_push_subscription_updates.sql`.

La Tanda 8 agrega dos migraciones aditivas:

- `20260809062547_tanda_8_data_foundation.sql`: snapshot previo, revisión
  monotónica de documentos, borrado en cascada al eliminar una cuenta, permisos
  mínimos y escritura autenticada exclusivamente mediante la RPC allowlisted;
- `20260809062605_tanda_8_trading_projection.sql`: proyección relacional de
  Trading con RLS e idempotencia persistente de sus notificaciones.

La proyección no elimina ni transforma el JSON original. Esto permite volver al
lector compatible sin reconstruir información si fuera necesario.

Después de cualquier ampliación del historial se debe ejecutar nuevamente `supabase/verification/20260801_operation_security_check.sql`: cada fila debe devolver `passed = true` y la primera no debe listar columnas faltantes. También se deben comparar los asesores de seguridad y rendimiento antes y después de aplicar la migración.

Después de la Tanda 8 también se ejecuta
`supabase/verification/20260809_tanda_8_security_check.sql`. Todas sus filas
deben devolver `passed = true`; además comprueba que la proyección de Trading y
el JSON compatible contengan los mismos identificadores.

La protección contra contraseñas filtradas requiere un plan pago de Supabase. Como este proyecto utiliza el plan Free, Supabase mantiene el alta pública desactivada y LifeCycle exige invitación más una contraseña mínima de 12 caracteres. La comprobación contra filtraciones queda documentada como defensa adicional para una futura migración de plan, no como requisito para compartir la aplicación con el grupo reducido previsto.

### Cuotas y protección operativa

Las cuotas funcionales se definen una sola vez en
`private.lifecycle_resource_limits`. El cliente las usa para informar antes de
guardar, la restauración de backups vuelve a contarlas y el trigger de
`public.user_data` constituye la barrera autoritativa frente a clientes viejos
o llamadas directas a la RPC. El perfil `owner` conserva recursos funcionales
ilimitados; los topes técnicos de archivo y transporte continúan vigentes para
proteger el servicio.

Las migraciones de las Tandas 6 y 7 se aplicaron en producción el
2026-08-30, en este orden. Un entorno nuevo debe conservar el mismo orden:

1. `20260829193500_enforce_tracker_resource_limits.sql`;
2. `20260829201218_expand_trading_projection_capacity.sql`;
3. `20260829213000_enforce_all_resource_limits.sql`;
4. `20260829214500_harden_storage_and_push_limits.sql`.

La última migración mantiene `blood-tests` privado, limita cada archivo a
15 MB, cuenta adjuntos por usuario desde RLS y limita a 20 dispositivos Push
las cuentas acotadas. Las inserciones concurrentes se serializan por usuario.
El servidor suma límites independientes para API general, registro por
invitación, telemetría, mutaciones autenticadas y pruebas Push; las respuestas
429 incluyen `Retry-After` y encabezados `RateLimit-*`.

Después de aplicarlas se ejecutan los verificadores
`supabase/verification/20260827_resource_policy_security_check.sql`,
`supabase/verification/20260809_tanda_8_security_check.sql` y
`supabase/verification/20260801_operation_security_check.sql`; todas las filas
deben devolver `passed = true`. La ejecución de producción del 2026-08-30
completó 30 de 30 comprobaciones, mantuvo la paridad de Trading y confirmó el
aislamiento RLS de la cuenta propietaria y la cuenta secundaria.

## Criterio de cierre en producción

La tanda queda operativamente cerrada cuando:

- GitHub Actions pasa.
- Render ejecuta y deja activo el commit esperado.
- `/api/health` informa ese commit y un último ciclo exitoso.
- El diagnóstico informa la cantidad esperada de endpoints únicos.
- Una prueba llega al celular.
- Una prueba llega al navegador de escritorio elegido.
- Una tarea muy urgente pendiente llega nuevamente después de su intervalo sin abrir la PWA.
