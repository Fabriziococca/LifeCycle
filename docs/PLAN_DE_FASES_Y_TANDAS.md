# Plan definitivo de LifeCycle — estado auditado

**Actualizado:** 6 de septiembre de 2026

La implementación puede agruparse en bloques grandes cuando sea seguro. No existe un límite artificial de 20–30 minutos: cada cierre debe ser coherente, probado y recuperable. Se mantiene confirmación explícita para migraciones productivas, facturación y acciones destructivas.

## Estado general

| Fase | Alcance | Código local | Cierre externo |
|---|---|---|---|
| A | Organización, cuenta, navegación, iconos y destinos | Implementado; corregidos buscador y accesos faltantes | QA local escritorio/móvil y claro/oscuro correcto |
| B | Varios horarios diarios por entidad | Implementado y auditado | Prueba Push real pendiente |
| C | Suscripciones y Finanzas | Implementado; alta multihorario y búsqueda verificadas | Migración y pruebas SQL productivas correctas, sin conservar fixtures |
| D | Presupuesto, PWA y Android nativo | Implementado y compilable | Prueba física Android pendiente |
| E | Pipeline completo de transcripciones | Implementado; cuotas recuperables, reservas y transporte Gemini corregidos | Migraciones, aislamiento y prueba productiva corta correctos; Gemini gratuito activado |
| F | Presets iniciales, QA y publicación | Presets, 386 pruebas y QA visual correctos | Publicado y comprobado en Render; verificaciones físicas pendientes |

## Fase A — Base y organización

- **Tanda 0:** reconciliar Git, conservar un respaldo del estado recibido y separar temporales.
- **Tanda 1:** corregir destinos profundos desde Hoy, campana y notificaciones, incluida Vitamina D.
- **Tanda 2:** completar iconos faltantes y corregir el tooltip residual de “Más”.
- **Tanda 3:** ordenar Cuenta en identidad/sesión, preferencias, organización, notificaciones/dispositivos y datos/aplicación.
- **Tanda 4:** acceso visible a Cuenta en móvil; cuatro favoritos; “Más” contiene sólo módulos.
- **Tanda 5:** distinguir funciones especializadas, módulos y tarjetas; ocultar opcionalmente plantillas sin eliminarlas; conservar Hoy, búsqueda y tarea rápida.

## Fase B — Varios horarios de notificación

- **Tanda 6:** modelo común de varios horarios dentro del mismo día calendario, sin duplicados.
- **Tanda 7:** migración compatible desde configuraciones de un horario y claves de envío por horario.
- **Tanda 8A:** editor compartido para agregar, ordenar y quitar horarios.
- **Tanda 8B:** cobertura de tarjetas, recordatorios, vehículo, gimnasio, proyectos, Trading y futuros avisos de suscripciones.
- **Tanda 9:** servidor con deduplicación por horario; reintentos técnicos separados; supresión de avisos restantes si la entidad deja de estar pendiente.
- **Tanda 10:** regresión, cambio de día, sincronización, reinicio y prueba Push en dispositivo.

## Fase C — Suscripciones

- **Tanda 11:** modelo versionado con moneda, precio, periodo, próxima renovación, estado e historial.
- **Tanda 12:** módulo especializado y ocultable con alta, edición, pausa/cancelación lógica y reactivación.
- **Tanda 13:** gasto manual o automático, como máximo uno por periodo y de forma atómica entre dispositivos.
- **Tanda 14:** recordatorios multihorario y traslado idempotente de Workana sin avisos dobles.
- **Tanda 15:** migración productiva, pruebas de renovación/fin de mes/ARS-USD y validación integrada.

## Fase D — Presupuesto y Android

- **Tanda 16A:** Gemini como proveedor inicial gratuito, consentimiento explícito y calidad medida con muestras no confidenciales.
- **Tanda 16B:** límites propios, telemetría y pausa segura sin activar facturación.
- **Tanda 17A:** conservar PWA y sumar Capacitor Android sin duplicar interfaz ni migrar backend.
- **Tanda 17B:** servicio foreground de micrófono, notificación persistente y `PARTIAL_WAKE_LOCK`.
- **Tanda 17C:** interrupciones, recuperación local, permisos y experiencia Android.
- **Tanda 18A:** AAC mono a 48 kbit/s, sesiones de hasta tres horas, fragmentos de cinco minutos y retención 24 h/7 días.
- **Tanda 18B:** grabación web y Android, caché local y subidas recuperables.
- **Tanda 18C:** compilación APK y prueba física en Galaxy S24 FE / Android 16.

## Fase E — Transcripciones

- **Tanda 19:** tablas separadas, RLS, relación compuesta de propietario, bucket privado y presupuestos.
- **Tanda 20A:** subida Android fragmentada e idempotente sin borrar audio local antes de confirmar.
- **Tanda 20B:** importación de audio/video hasta 50 MB, TUS desde 6 MB y preparación con FFmpeg.
- **Tanda 21:** cola persistente, reclamo concurrente seguro, reintentos acotados y espera diaria por cuota.
- **Tanda 22:** transcripción fiel por fragmento y unión determinista completa.
- **Tanda 23:** biblioteca, carpetas, títulos, edición, copia, exportación, descarga y eliminación.
- **Tanda 24:** módulo ocultable integrado en navegación y búsqueda.
- **Tanda 25:** resumen y apuntes opcionales como documentos separados del texto fuente.

## Fase F — Inicio de cuentas y entrega

- **Tanda 26:** presets opcionales y neutrales, con vista previa, selección granular, prevención de duplicados y aplicación atómica respecto de cuotas.
- **Tanda 27A:** suite completa, migraciones reales sobre PostgreSQL 17 aislado, RLS con dos cuentas, idempotencia y recuperación.
- **Tanda 27B:** QA visual escritorio/celular, claro/oscuro, estados vacíos/errores y prueba física Android.
- **Tanda 27C:** migraciones productivas confirmadas, variables seguras, commit/push, despliegue, health/logs y comprobación final.

## Secuencia de cierre pendiente

1. Verificar recepción Push real, incluidos varios horarios de una misma entidad y cancelación del aviso restante al completarla.
2. Ejecutar el protocolo físico de grabación en Galaxy S24 FE / Android 16: pantalla bloqueada, otras aplicaciones, interrupción de micrófono, pérdida de red y continuidad prolongada. No utilizar el emulador que pertenece a otro proyecto.
3. Registrar esos resultados antes de declarar cerrado el plan completo. La transcripción productiva de audio sintético ya se verificó; no reemplaza una grabación real de tres horas.

Las tres migraciones iniciales y la protección adicional del contador diario quedaron aplicadas y alineadas con el historial remoto. Pasaron 12 controles SQL de seguridad, 8 resultados de pruebas transaccionales y 5 comprobaciones adicionales de consumo/privacidad con rollback. No quedan migraciones de esta entrega pendientes. Detalles y comandos en `GUIA_OPERATIVA_Y_ENTREGA.md`.
