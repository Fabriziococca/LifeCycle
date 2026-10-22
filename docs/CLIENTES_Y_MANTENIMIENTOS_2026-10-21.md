# Clientes: recordatorios y mantenimiento mensual

Alcance autorizado el 21/10/2026: simplificar la ficha de cada cliente, corregir
la asociación confusa de proyectos y agregar mantenimiento mensual con cobros
confirmados manualmente. Sin reasignaciones automáticas de datos personales.

## Uso y reglas

- **Recordatorios del cliente:** responsabilidades recurrentes, proyecto opcional
  restringido a ese cliente, frecuencia y horarios Argentina configurables.
  Ejemplo: reiniciar la PC cada tres días desde la última realización. Conserva
  las rutinas existentes, su historial, pausa, archivo y opciones de calendario.
- **Mantenimiento mensual:** tareas incluidas, importe USD o ARS, día de cobro,
  primer mes pendiente, proyectos del cliente y avisos diarios configurables.
  Un mes corto usa su último día; los siguientes recuperan el día configurado.
- Al vencer aparece un **cobro por confirmar** en Trabajo, Finanzas y Hoy/campana.
  «Todavía no pagó» o no actuar mantiene el mismo período, sin ingreso.
  «Sí, recibí el pago» requiere una confirmación con fecha de recepción y, en
  ARS, cotización explícita. Cuenta de ingreso opcional de la misma moneda.
- Confirmar registra exactamente un recibo y avanza **un mes desde el período
  pendiente**, aunque se confirme tarde. No saltea meses impagos ni altera el
  presupuesto o las liberaciones del desarrollo. Múltiples proyectos comparten
  un mantenimiento; su ingreso se cuenta una sola vez en Finanzas.
- Editar tarifa/tareas no reescribe recibos anteriores. Archivar cliente o
  mantenimiento detiene avisos y conserva los ingresos. Sólo se elimina un
  mantenimiento sin historial. Se puede anular el último cobro vigente: conserva
  trazabilidad, retira su efecto financiero y recupera el período pendiente.
  Ninguna acción cobra, transfiere o devuelve dinero en un proveedor externo.
- Los pendientes puntuales, las respuestas esperadas y las notas anteriores se
  conservan en un apartado secundario explicado. No se confunden con rutinas
  ni contratos de mantenimiento.

## Vínculos y protección de datos

En una ficha, «Vincular un proyecto a este cliente» muestra proyectos sin cliente
con casillas inicialmente vacías. Sólo guarda lo marcado. Los proyectos
existentes tienen «Cambiar cliente / desvincular». La revisión general muestra
el vínculo actual, sin preseleccionar otro cliente para todos los proyectos.

Al cambiar un vínculo, los recordatorios/notas/mantenimientos quedan en su
cliente original y se quita únicamente su referencia actual al proyecto. Los
recibos conservan el cliente y proyectos originales. No se adivina a qué cliente
pertenecen los vínculos reales guardados antes de esta corrección.

## Persistencia y avisos

Los mantenimientos viven en `work_clients.record.retainers`. Recibo y próxima
fecha se guardan juntos mediante la revisión CAS de `save_work_state`. Finanzas
deriva sus movimientos de esos recibos, sin otra escritura en `finanzasData`.
Reintentos idénticos no duplican cobros; revisiones concurrentes requieren
recargar. El backup unificado conserva contratos y recibos, y los backups sin
Trabajo conservan el Trabajo vigente según las reglas existentes.

La migración es aditiva: valida contratos/recibos y vínculos al final de la
transacción de Trabajo. No cambia filas personales ni agrega tablas o servicios.
RLS, permisos y aislamiento de propietario se mantienen. El scheduler selecciona
también cuentas con sólo un cobro pendiente; reutiliza la deduplicación Push,
ventana de 15 minutos, cancelación de reintentos y enlace directo a la ficha.
Aceptación de Push no acredita recepción o visualización en Android.

## Verificación

Pruebas de modelo, SQL PostgreSQL aislado, interfaz local en escritorio/celular y
temas claro/oscuro: selección explícita, cancelación, recordatorio por proyecto,
cobro pendiente, confirmación, cambio de importe, anulación, recobro, archivo,
Finanzas, Proyectos, Hoy, recarga y backup sin duplicación. Verificación real
únicamente con la cuenta QA cuyo usuario empieza por `soyfabr`; la cuenta
personal queda fuera de las pruebas. El recibo operativo local identifica el
commit, la migración, el Manual Deploy y las comprobaciones de salud/logs.
