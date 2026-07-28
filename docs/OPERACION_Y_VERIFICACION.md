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

## Backups

El backup JSON versionado conserva todos los datos estructurados sincronizados, incluidas definiciones, historiales y referencias de adjuntos. La restauración valida el archivo completo antes de escribir y revierte todos los cambios si una escritura falla.

Los adjuntos médicos nuevos permanecen como binarios privados en Supabase Storage. El JSON conserva su referencia, pero no contiene los bytes del PDF o imagen. Por eso:

- el backup actual es rápido y correcto para restaurar dentro del mismo proyecto de Supabase;
- no es todavía un backup portátil independiente de Supabase;
- una exportación portátil futura deberá generar un paquete con JSON, manifiesto y binarios descargados de Storage.

Ambas modalidades son útiles y no deberían sustituirse entre sí.

## Render y despliegue automático

El repositorio local apunta a `Fabriziococca/LifeCycle`, mientras que las capturas de Render todavía muestran `Fabriziococca/HygieneTracker`. Los logs también indican que Render intenta clonar sin acceso a la integración del repositorio. Esto es consistente con una conexión antigua o permisos perdidos después de un cambio de nombre.

Al terminar la tanda de código:

1. En Render > Settings, revisar el repositorio y las credenciales Git.
2. Reconectar la cuenta de GitHub y autorizar explícitamente el repositorio actual.
3. Confirmar que la rama vinculada sea `main`.
4. Configurar Auto-Deploy como `On Commit`, o `After CI Checks Pass` si se quiere esperar al workflow `Validate LifeCycle`.
5. Evitar “Deploy a specific commit” y “Clear build cache & deploy” durante la comprobación, porque pueden desactivar el despliegue automático.
6. Hacer un commit pequeño de prueba y comprobar que Render lo detecte sin intervención.

El workflow de GitHub incluido ejecuta instalación exacta, pruebas y verificación sintáctica antes de considerar válida una revisión.

## Supabase pendiente de decisión manual

Estas dos defensas siguen aplazadas y no bloquean el código actual:

- Protección contra contraseñas filtradas: impide usar una contraseña conocida en filtraciones públicas.
- RLS sobre el snapshot privado de seguridad: agrega una barrera de base de datos aunque el esquema ya sea privado y no tenga permisos para `anon` ni `authenticated`.

Antes de cambiar cualquiera de ellas conviene confirmar la configuración real desde el panel de Supabase y conservar un snapshot.

## Criterio de cierre en producción

La tanda queda operativamente cerrada cuando:

- GitHub Actions pasa.
- Render ejecuta y deja activo el commit esperado.
- `/api/health` informa ese commit y un último ciclo exitoso.
- El diagnóstico informa la cantidad esperada de endpoints únicos.
- Una prueba llega al celular.
- Una prueba llega al navegador de escritorio elegido.
- Una tarea muy urgente pendiente llega nuevamente después de su intervalo sin abrir la PWA.
