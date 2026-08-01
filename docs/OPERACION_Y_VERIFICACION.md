# Operación y verificación de LifeCycle

Este documento separa las comprobaciones automáticas del repositorio de aquellas que necesitan infraestructura o un dispositivo real.

## Notificaciones

### Comportamiento esperado

- El backend ejecuta los dos motores cada cinco minutos.
- Las tareas muy urgentes no tienen horario silencioso.
- El primer aviso se puede emitir en el siguiente ciclo del backend.
- Los avisos siguientes respetan el intervalo configurado, por defecto cuatro horas.
- Cada endpoint Push único registrado para el usuario recibe el aviso.
- Un endpoint rechazado con HTTP 404 o 410 se elimina automáticamente.
- Una ejecución manual forzada no modifica la fecha del próximo ciclo normal.

### Estado público no sensible

`GET /api/health`

Además del commit activo, devuelve si la infraestructura de notificaciones está configurada, si el planificador está ejecutándose y cuándo terminó correctamente por última vez.

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

Requiere el encabezado `X-Admin-Token` y puede enviar notificaciones reales. Revisa tanto alertas por horario como robot y tareas muy urgentes. Al ser una prueba forzada, no posterga el próximo aviso normal.

### Prueba por dispositivo

En cada celular o computadora:

1. Abrir LifeCycle mediante HTTPS e iniciar sesión.
2. Entrar en Perfil > Notificaciones.
3. Activar notificaciones.
4. Verificar que el panel muestre el dispositivo como listo y el total registrado.
5. Usar “Enviar notificación de prueba”.
6. Si el permiso está bloqueado, habilitarlo desde la configuración del sitio y desde el sistema operativo.
7. En Brave, habilitar el servicio de mensajería Push de Google si el navegador lo solicita.

### Administración e historial por dispositivo

La pantalla Perfil > Notificaciones permite:

- identificar y renombrar cada celular o computadora;
- enviar una prueba a un dispositivo específico;
- revocar un endpoint sin desactivar los demás;
- ver la última actividad y si el último intento fue aceptado o rechazado;
- filtrar los últimos intentos por aceptados, fallidos o endpoints vencidos.

“Aceptada por Push” significa que el proveedor Web Push recibió correctamente el mensaje. La API del navegador no confirma de forma fiable que la persona haya visto la notificación, por lo que LifeCycle no presenta ese estado como “leída” ni “entregada al usuario”.

Estas funciones requieren aplicar en Supabase la migración:

`supabase/migrations/20260801090000_push_management_and_history.sql`

El código es retrocompatible: antes de aplicar la migración, los avisos siguen enviándose, pero no se pueden renombrar dispositivos ni guardar el historial. Después de ejecutar la migración, se debe reiniciar o volver a desplegar el servicio de Render para que vuelva a detectar el esquema ampliado.

La migración siguiente también debe ejecutarse para mantener la base alineada con el cliente y cerrar una defensa pendiente:

`supabase/migrations/20260801100000_harden_private_snapshots_and_sync_schema.sql`

Esta segunda migración agrega `projectPulseTemplates` a la lista de claves que el RPC autenticado puede sincronizar y activa/impone RLS sobre el snapshot privado de seguridad. No concede acceso nuevo a `anon` ni a `authenticated`.

## Backups

El backup JSON versionado conserva todos los datos estructurados sincronizados, incluidas definiciones, historiales y referencias de adjuntos. La restauración valida el archivo completo antes de escribir y revierte todos los cambios si una escritura falla.

Los adjuntos médicos nuevos permanecen como binarios privados en Supabase Storage. El JSON conserva su referencia, pero no contiene los bytes del PDF o imagen. Por eso:

- el backup actual es rápido y correcto para restaurar dentro del mismo proyecto de Supabase;
- no es todavía un backup portátil independiente de Supabase;
- una exportación portátil futura deberá generar un paquete con JSON, manifiesto y binarios descargados de Storage.

Ambas modalidades son útiles y no deberían sustituirse entre sí.

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

## Supabase pendiente de acción manual

Quedan estas acciones de panel o producción:

- Protección contra contraseñas filtradas: impide usar una contraseña conocida en filtraciones públicas.
- Ejecutar, en orden, las migraciones `20260801090000_push_management_and_history.sql` y `20260801100000_harden_private_snapshots_and_sync_schema.sql`.
- Ejecutar luego `supabase/verification/20260801_operation_security_check.sql`: cada fila debe devolver `passed = true` y la primera no debe listar columnas faltantes.
- Volver a desplegar Render después de las migraciones para que el proceso descarte el fallback de compatibilidad y detecte las nuevas tablas/columnas.

La protección contra contraseñas filtradas se activa desde Auth en el panel; no existe una configuración equivalente segura dentro de este repositorio.

## Criterio de cierre en producción

La tanda queda operativamente cerrada cuando:

- GitHub Actions pasa.
- Render ejecuta y deja activo el commit esperado.
- `/api/health` informa ese commit y un último ciclo exitoso.
- El diagnóstico informa la cantidad esperada de endpoints únicos.
- Una prueba llega al celular.
- Una prueba llega al navegador de escritorio elegido.
- Una tarea muy urgente pendiente llega nuevamente después de su intervalo sin abrir la PWA.
