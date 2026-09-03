# Plan Definitivo de LifeCycle — Fases y Tandas

Este documento es la referencia oficial del avance y ejecución del plan maestro de LifeCycle.

---

## Estado General de Avance

| Fase | Descripción | Tandas Totales | Completadas | Estado |
|---|---|---|---|---|
| **Fase A** | Base local y organización | 6 (0 a 5) | 1 | 🟡 En progreso |
| **Fase B** | Varios horarios de notificación | 6 (6 a 10) | 0 | ⚪ Pendiente |
| **Fase C** | Suscripciones | 5 (11 a 15) | 0 | ⚪ Pendiente |
| **Fase D** | Viabilidad, presupuesto operativo y Android | 8 (16A a 18C) | 0 | ⚪ Pendiente |
| **Fase E** | Transcripciones completas | 7 (19 a 25) | 0 | ⚪ Pendiente |
| **Fase F** | Inicio de cuentas y entrega | 4 (26 a 27C) | 0 | ⚪ Pendiente |

---

## Detalle por Fases y Tandas

### Fase A — Base local y organización

- [x] **Tanda 0 — Reconciliación de Git**: Respaldar el estado local, contrastarlo con GitHub y producción, recuperar las referencias correspondientes y separar archivos temporales del código. Conservar todos los cambios legítimos, sin commits duplicados ni reescrituras de historial. Dejar el plan y el estado de avance documentados en el repositorio. *(Completada: 2026-09-02)*
- [ ] **Tanda 1 — Destinos de los avisos**: Corregir enlaces como Vitamina D para abrir el módulo, la pestaña y el elemento correspondiente. Revisar los recorridos desde la campana, Hoy y las notificaciones que utilicen esos destinos.
- [ ] **Tanda 2 — Iconos y tooltip**: Inventariar los iconos utilizados, corregir referencias incorrectas y verificar su carga y visualización. Cubrir también selectores y contenido dinámico. Corregir el tooltip que queda visible al cerrar “Más”.
- [ ] **Tanda 3 — Cuenta y preferencias**: Reorganizar la sección en **Mi cuenta**, **Preferencias**, **Organización**, **Notificaciones y dispositivos**, y **Datos y aplicación**. Ubicar moneda, apariencia y comportamiento en Preferencias; mantener diagnósticos avanzados desplegables y preservar las configuraciones existentes.
- [ ] **Tanda 4 — Navegación móvil**: Incorporar un acceso visible a la cuenta en la cabecera. Mantener cuatro favoritos y reservar “Más” exclusivamente para módulos. Verificar selección, regreso, foco, accesibilidad y adaptación a pantallas pequeñas.
- [ ] **Tanda 5 — Personalización y funciones**: Distinguir funciones especializadas de la aplicación, módulos personalizados y contenido creado por el usuario. Aclarar el selector de iconos. Añadir una preferencia para ocultar las plantillas de proyectos sin eliminarlas. Mantener Hoy, la búsqueda y la creación rápida de tareas.

### Fase B — Varios horarios de notificación

- [ ] **Tanda 6 — Reglas comunes de horarios**: Permitir varios horarios dentro del mismo día calendario para una única tarjeta o recordatorio. Mantener días, vencimientos y condiciones existentes. Validar horarios, evitar repeticiones idénticas y respetar la zona horaria utilizada por la aplicación. No incorporar ciclos especiales que agrupen noches entre dos fechas.
- [ ] **Tanda 7 — Persistencia y compatibilidad**: Adaptar configuraciones y registros de envío para identificar cada aviso programado. Conservar las configuraciones antiguas como un único horario. Definir límites técnicos y compatibilidad entre versiones durante la transición.
- [ ] **Tanda 8A — Editor compartido**: Incorporar controles reutilizables para agregar y quitar horarios en tarjetas, recordatorios y gimnasio. Mantener una sola entidad, configuración e historial.
- [ ] **Tanda 8B — Resto de avisos configurables**: Aplicar el modelo a vehículo, salud, proyectos, tareas, Trading y demás avisos existentes. Preservar las reglas propias de anticipaciones, intervalos y vencimientos de cada dominio.
- [ ] **Tanda 9 — Servidor, deduplicación y reintentos**: Adaptar el motor de envíos para admitir varios avisos diarios. Separar horarios solicitados de reintentos técnicos. Conservar las protecciones contra duplicados y avisos vencidos. Suprimir los avisos posteriores cuando el elemento registrado como realizado deje de cumplir la condición de pendiente.
- [ ] **Tanda 10 — Verificación integrada**: Probar varios horarios, cambio de día, modificación de configuraciones, elementos realizados o archivados, sincronización y reinicios. Verificar compatibilidad con los reintentos existentes, aislamiento entre cuentas y recepción en el dispositivo.

### Fase C — Suscripciones

- [ ] **Tanda 11 — Modelo e historial**: Definir suscripciones con nombre, importe, moneda, inicio, periodo, próxima renovación, vigencia y estado de renovación automática. Mantener historial y contemplar cambios de precio y fechas de fin de mes.
- [ ] **Tanda 12 — Gestión del módulo**: Crear el módulo especializado y ocultable de Suscripciones. Incorporar listado, detalle, creación, edición, desactivación de renovación y reactivación. Conservar la vigencia hasta la fecha correspondiente y distinguir el registro en LifeCycle de una cancelación real en el proveedor externo.
- [ ] **Tanda 13 — Gastos vinculados**: Incorporar registro manual por defecto y registro automático como opción explícita. Generar como máximo un gasto por periodo, evitar duplicados entre dispositivos y reintentos, identificar los registros automáticos y permitir su corrección sin borrar el historial financiero.
- [ ] **Tanda 14 — Recordatorios y traslado de Workana**: Integrar avisos previos y de vencimiento con varios horarios. Trasladar Workana desde Proyectos conservando sus datos y referencias. Verificar que repetir la migración no duplique información.
- [ ] **Tanda 15 — Cierre del bloque**: Probar alta, edición, renovación, avisos, generación de gastos, cancelación y reactivación. Verificar persistencia, sincronización e interfaz. Publicar el bloque cuando esté integrado y validado.

### Fase D — Viabilidad, presupuesto operativo y Android

- [ ] **Tanda 16A — Gemini gratuito y calidad**: Verificar el proyecto, los modelos disponibles, las cuotas y la configuración necesaria para utilizar Gemini gratuito como único proveedor inicial. Evaluar precisión con muestras autorizadas. Definir avisos de privacidad y activación expresa del envío a la nube. No activar facturación ni proveedores de pago.
- [ ] **Tanda 16B — Presupuesto operativo**: Consultar el consumo real de Supabase y Render y las cuotas de Gemini. Medir tamaños y transferencias previstas. Reservar margen para LifeCycle y definir límites, avisos y condiciones de pausa antes de habilitar tráfico de audio. Aplicar los controles de audio también a la cuenta propietaria.
- [ ] **Tanda 17A — Base Android con Capacitor**: Revisar las herramientas disponibles, incorporar Capacitor y obtener una compilación Android reproducible. Mantener JavaScript, la web existente, Supabase y Render.
- [ ] **Tanda 17B — Integración de la APK**: Verificar autenticación, comunicación con el backend, sincronización, almacenamiento y navegación. Adaptar los comportamientos específicos de Android sin romper la PWA.
- [ ] **Tanda 17C — Notificaciones nativas y locales**: Integrar el canal nativo de Android y los avisos locales. Conservar las notificaciones web y evitar registros o entregas duplicadas involuntarias. Utilizar FCM únicamente como canal de mensajes, sin migrar la base de datos.
- [ ] **Tanda 18A — Grabador persistente**: Implementar grabación del micrófono ambiente, con objetivo de hasta tres horas por sesión. Guardar progresivamente en el teléfono, mantener fragmentos internos y mostrar una única sesión. Evitar reiniciar innecesariamente la captura entre fragmentos.
- [ ] **Tanda 18B — Interrupciones y recuperación**: Manejar pérdida del micrófono, errores, falta de espacio e interrupciones. Emitir avisos locales cuando el fallo sea detectable. Recuperar el material conservado y mostrar el estado de las sesiones interrumpidas al volver a abrir la aplicación.
- [ ] **Tanda 18C — Piloto prolongado en el teléfono**: Probar en el **Samsung Galaxy S24 FE con Android 16 y One UI 8.5**: pantalla bloqueada, uso de otras aplicaciones, interrupciones, continuidad de fragmentos y recuperación. Conservar registros verificables de las pruebas. Resolver los fallos detectados antes de dar por validada la grabación prolongada.

### Fase E — Transcripciones completas

- [ ] **Tanda 19 — Datos, permisos y límites**: Crear una estructura separada para carpetas, sesiones, fragmentos, trabajos y textos. Aplicar aislamiento entre usuarios, acceso inicial restringido a la cuenta propietaria y límites antes de aceptar subidas. No incorporar audios ni transcripciones extensas al gran estado general de sincronización.
- [ ] **Tanda 20A — Subida recuperable desde Android**: Subir fragmentos comprobando presupuesto, tamaño e integridad. Reanudar transferencias interrumpidas y evitar repetir archivos ya subidos. Conservar el audio local pendiente cuando falte conexión o cuota, dentro de los límites de espacio definidos.
- [ ] **Tanda 20B — Importación desde la web**: Permitir importar audios y videos existentes. Validar formatos, tamaños y duración, y preparar el audio para procesamiento por fragmentos. No borrar los originales de las carpetas personales del usuario.
- [ ] **Tanda 21 — Cola de procesamiento**: Implementar trabajos persistentes con Gemini gratuito, reintentos acotados, espera por cuota y reanudación después de interrupciones. Guardar resultados conforme se completen. No bloquear el motor de notificaciones ni cambiar automáticamente a un servicio de pago.
- [ ] **Tanda 22 — Transcripción completa y unificada**: Ensamblar los resultados por código, respetando orden y límites entre fragmentos. Detectar trabajos incompletos y respuestas truncadas. Verificar que las uniones no dupliquen ni eliminen contenido legítimo. Mantener la transcripción completa, sin convertirla en un resumen.
- [ ] **Tanda 23 — Biblioteca, organización y edición**: Incorporar carpetas, títulos opcionales, bandeja de entrada, movimiento de sesiones y estados de progreso. Permitir procesamiento manual o automático activado por el usuario. Añadir edición, copia, exportación, descarga de audio y eliminación con las confirmaciones correspondientes.
- [ ] **Tanda 24 — Caducidad y control de consumo**: Aplicar la caducidad del audio a las 24 horas de una transcripción completa, guardada y sincronizada. Limpiar las copias gestionadas por LifeCycle y los temporales del proveedor que corresponda. No borrar el único original de un trabajo fallido o incompleto. Verificar la limpieza y contrastar el consumo estimado con el registrado por los servicios.
- [ ] **Tanda 25 — Resúmenes y apuntes opcionales**: Generar resultados adicionales mediante Gemini, claramente separados de la transcripción original. Mantenerlos opcionales, exportables y sujetos al mismo presupuesto gratuito. No reemplazar ni modificar automáticamente el texto fuente.

### Fase F — Inicio de cuentas y entrega

- [ ] **Tanda 26 — Configuración inicial opcional**: Incorporar, después de la revisión de una cuenta nueva, una selección de tarjetas y configuraciones predeterminadas con vista previa. Mantener vacíos los datos personales hasta que el usuario elija incorporar contenido. No copiar historiales, importes, fechas reales ni datos personales de la cuenta propietaria. Evitar duplicados y respetar los límites al aplicar la configuración.
- [ ] **Tanda 27A — Pruebas integradas**: Verificar permisos, aislamiento entre cuentas, persistencia, sincronización, cuotas, interrupciones, recuperación y regresiones relevantes. Cubrir los recorridos completos de las funcionalidades nuevas y su convivencia con las existentes.
- [ ] **Tanda 27B — Verificación visual y de dispositivos**: Comprobar las pantallas y recorridos modificados en web y Android, escritorio y celular, modo claro y oscuro. Revisar accesibilidad, navegación, estados vacíos, errores y mensajes de progreso.
- [ ] **Tanda 27C — Publicación y entrega operativa**: Entregar la versión web y la APK firmada, proteger las claves de firma y documentar instalación, actualización, límites, recuperación y operación. Realizar los commits, push y despliegues correspondientes y verificar el resultado posterior. No publicar en tiendas.

---

## Reglas de Ejecución

1. **Una tanda por ejecución**, salvo que dos pequeñas puedan completarse juntas de forma segura.
2. Objetivo de ejecuciones de aproximadamente **20–30 minutos**, subdividiendo antes de comenzar las piezas que puedan excederlo.
3. Cada tanda incluye implementación, revisión, pruebas pertinentes y corrección de los problemas encontrados.
4. Cada cierre deja un estado estable, documentado y recuperable.
5. Las pruebas prolongadas se preparan con registros persistentes y se revisan cuando concluyan.
6. Se utilizan checkpoints y commits para cambios coherentes; los despliegues se agrupan por bloques completos y verificados.
7. Se solicita confirmación antes de las migraciones productivas acordadas, cambios de facturación o acciones destructivas.
8. Si falta cuota, se pausa el procesamiento correspondiente sin contratar capacidad automáticamente ni borrar material pendiente.
9. Al finalizar cada tanda se informa: **completado, verificado, riesgos o pendientes y siguiente tanda**.
10. Se espera el **OK del usuario** antes de ejecutar la tanda siguiente.
