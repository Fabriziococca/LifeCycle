# Mejoras de seguimiento — 11 de octubre de 2026

Alcance aprobado directamente por Fabrizio: corregir avisos de proyectos en
arbitraje, mostrar entrega exacta, incorporar suscripciones gratuitas, pausar
tarjetas y recordatorios, calcular avisos previos por porcentaje. No continuar
otros módulos, Transcripciones, APK ni trabajos diferidos de A–F por este pedido.

## Comportamiento

- El arbitraje deja de producir avisos de entrega demorada y avisos de tareas
  urgentes del proyecto. Se conserva el proyecto visible para resolver el arbitraje
  y su situación financiera; no se inventa una entrega ni una fecha de cobro.
- Las tarjetas de proyecto muestran día de semana, fecha completa y hora local.
  La fecha aparece como plazo original si el proyecto está entregado o en arbitraje.
- Suscripciones distingue `paid`, `trial` y `free`, conservando el precio real.
  Sólo las pagas activas suman gasto mensual y pueden registrar gastos. Las pruebas
  mantienen su vencimiento hasta una decisión explícita. «Pasar a paga» pide la
  primera renovación vigente; «No continuar» cancela el seguimiento conservando
  historial. Cancelar en LifeCycle no cancela el servicio en el proveedor.
- Las suscripciones anteriores se interpretan como pagas. No se deduce una prueba
  gratuita a partir de un precio cero ni se modifica automáticamente información
  personal existente. El usuario puede editar la modalidad y el precio real.
- Las tarjetas configurables de Higiene, Cuidado, Lentes, Salud y módulos propios,
  incluidos estudios y avisos hasta resolver, tienen Pausar/Reanudar. Vehículo
  también incorpora la acción en tarjetas existentes y nuevas. El seguimiento
  independiente de Vitamina D también queda cubierto. El historial real
  no cambia. Los períodos de pausa se guardan aparte y se excluyen del avance.
  La pausa en Vehículo también congela kilometraje del seguimiento; el odómetro
  y los registros reales se conservan. Los documentos conservan su fecha real de
  vencimiento y la reevaluan al reanudar.
- Los recordatorios recurrentes tienen un control de pausa independiente de
  activación, horarios y frecuencia. Reanudar continúa la programación calendario;
  no recupera recordatorios pasados.
- Nuevas tarjetas por días usan avisos automáticos al 70% y 85% del plazo, con
  redondeo hacia abajo y mínimo de un día. Los plazos muy cortos pueden coincidir.
  El editor permite modo manual. Las tarjetas anteriores mantienen sus días
  configurados hasta que el usuario elija automático.
- El servidor excluye entidades pausadas de los avisos y comprueba estado actual
  antes de reintentar Push. La pausa debe sincronizarse para que el servidor la
  conozca. No se puede retirar un Push ya aceptado por el proveedor.

## Persistencia y costos

Campos compatibles dentro de los documentos JSON existentes; Suscripciones usa
versión 3. No requiere migración SQL, cambios de grants/RLS, infraestructura,
variables, planes ni costo adicional. Las comprobaciones de reintento reutilizan
el lector de documentos con revisión/caché y sólo cargan estado cuando hay candidatos.

## Validación y publicación

- Suite final: **439 pruebas aprobadas, cero fallos**; incluye regresión del
  reintento, congelación de tiempo/kilometraje, fechas reales, historial intacto,
  modalidades gratuitas y compatibilidad de documentos anteriores.
- Interfaz real aislada: las cinco mejoras en 1440 y 390 px, claro y oscuro.
  Incluye pausa persistida tras recarga/sincronización, edición manual/automática,
  conversión de prueba a paga sin gastos retroactivos y cancelación conservando datos.
  Incluye el seguimiento separado de Vitamina D.
- Regresión de la interfaz previa: cuatro combinaciones, sin errores ni overflow;
  navegación, editor de avisos, suscripciones, sesión, Finanzas y copia cifrada.
- Datos ficticios y nube simulada. No se editaron datos personales de producción.
  La recepción Push física en un teléfono no queda demostrada por estas pruebas.
- Publicación y verificación exacta de commit, health, build y logs: pendiente
  hasta cerrar las comprobaciones finales de este cambio.

## Recuperación

Preferir una corrección hacia adelante conservando `billingMode` y períodos de
pausa. Volver a un cliente anterior puede perder esos campos al guardar documentos
porque ese cliente no los conoce; además dejaría de respetar pausas. Conservar
datos y evitar reset de la base. Ningún rollback requiere borrar datos o tablas.
