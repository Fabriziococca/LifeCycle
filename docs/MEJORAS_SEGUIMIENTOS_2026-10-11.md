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
  El editor permite modo manual. Por pedido posterior explícito del propietario,
  sus 38 tarjetas existentes por días también pasaron a automático, conservando
  cada plazo de vencimiento. Las 3 tarjetas por meses o por estado quedaron iguales.
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
- Mejoras publicadas en `05bc9a3a73b48313c2ce8d32c3466d9486a385af`, CI aprobada.
  Manual Deploy `dep-db5i0h2jnfac73aiii60`, activo a las 02:36:44 de Argentina
  (05:36:44 UTC). `/api/health` confirmó `05bc9a3`, motor configurado, primer ciclo
  exitoso a las 05:36:47 UTC y cero fallos consecutivos o timeouts.

## Parches de dependencias detectados en el build

El build inicial mostró dos avisos de dependencias preexistentes. Se actualizaron
sólo dos paquetes transitivos, dentro de los rangos permitidos por sus padres;
sin cambiar dependencias directas, arquitectura ni configuración:

- `proxy-addr` 2.0.7 → 2.0.8 (Express), corrige
  [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
  El caso del aviso usa subredes IPv6 mal configuradas; LifeCycle usa `trust proxy`
  con valor numérico `1`. No se detectó un ataque ni se cambió ese ajuste.
- `brace-expansion` 5.0.9 → 5.0.12 (CLI de Capacitor, dependencia de desarrollo),
  corrige los avisos de recursión y expansión, incluido
  [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr).

`npm audit` completo y de producción: **0 vulnerabilidades conocidas** después
del parche. Suite repetida con ambos parches: **439 aprobadas, cero fallos**.
El commit de cierre sólo actualiza esas dos dependencias transitivas y este
registro; la lógica de las cinco mejoras corresponde a `05bc9a3`.

## Recuperación

### Conversión de tarjetas existentes solicitada el 11/10

Se alinearon las 26 versiones locales/remotas antes de aplicar la migración de
datos `20261011054822_owner_automatic_day_thresholds.sql`; ahora son 27. Se usó
el SQL Editor oficial autenticado porque el conector no estaba instalado.
La selección se limita al único perfil propietario y bloquea su documento actual;
un cambio concurrente de revisión cancela la aplicación antes de modificar datos.
No aplica una preferencia global ni instala un trigger que fuerce futuros cambios.

La transacción verificó con huellas del documento que no cambiaran vencimientos,
historiales, pausas, horarios, preferencias ni otras secciones. También conservó
columnas, constraints, índices, RLS y grants de `user_data`. Se guardó fuera de Git
una copia mínima de los 38 umbrales anteriores, sin contenido personal ni credenciales,
en `.tmp-sb/automatic-thresholds-originals-2026-10-11.json`. Para deshacer, preparar
una migración compatible a partir de esa copia y comprobar que no haya ajustes
manuales posteriores antes de restaurarlos; no sobrescribir otros campos.

La regresión SQL real se probó con PostgreSQL embebido: propietario/amigo,
tarjetas pausadas/archivadas, meses, estados, instalación nueva, idempotencia y
rechazo de propietarios ambiguos. La suite local completa pasó 441 pruebas.
El cálculo del cliente usa porcentajes enteros para evitar que 90 × 0,7 termine
redondeado a 62 por precisión binaria; el resultado correcto es 63 días.

Preferir una corrección hacia adelante conservando `billingMode` y períodos de
pausa. Volver a un cliente anterior puede perder esos campos al guardar documentos
porque ese cliente no los conoce; además dejaría de respetar pausas. Conservar
datos y evitar reset de la base. Ningún rollback requiere borrar datos o tablas.
