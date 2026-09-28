# LifeCycle — estado de estabilidad y diseño de Finanzas, 27/09/2026

Este documento es el estado operativo vigente de esta entrega. Complementa el plan
A–F y **sustituye las propuestas incompatibles del 26/09**, no declara cerrado el
roadmap completo. No existe un Project Pack separado en este repositorio.

## Decisiones confirmadas por el usuario

- Recuperó acceso a LifeCycle el 27/09 por la noche. **No enviar más consultas a
  soporte por el bloqueo resuelto.** La comprobación independiente de Auth devolvió
  HTTP 200; esto no equivale a auditar toda la base ni a probar recepción Push.
- Render: **My Workspace**, servicio `Lifecycle`, rama `main`, plan Free,
  repositorio `Fabriziococca/LifeCycle`. El usuario confirmó que se debe ejecutar
  **Manual Deploy → Deploy latest commit** tras cada publicación validada. Aunque
  la configuración muestra auto-deploy, el push de estabilidad no lo inició.
  Verificar CI y ausencia de otro despliegue antes de hacerlo manualmente.
- Objetivo USD 0, techo deseado aproximado USD 5/mes: no autoriza activar pagos.
- Tarjetas, historiales, recordatorios, proyectos, tareas y suscripciones siguen
  siendo el núcleo. No eliminar historial ni reducir puntualidad por ahorro.
- **Transcripciones queda archivado como producto**: sin grabadora, biblioteca,
  resúmenes ni importación integrada. Samsung graba; la herramienta de PC queda
  fuera de este trabajo. Conservar código y datos existentes; no borrar originales.
- APK y recordatorios locales nativos quedan diferidos. No tocar el emulador de
  otro proyecto ni prometer avisos offline con la PWA cerrada.
- Continuidad aprobada expresamente: **copia cifrada por dispositivo con clave
  local, inicialmente sólo lectura**. No habilitar escritura offline nueva sin
  resolver conflictos y probar reconciliación entre equipos.
- Sandía se inspecciona como referencia funcional/organizativa para Finanzas.
  Implementación propia; no extraer código privado, marcas ni datos de su cuenta.

## Implementación de estabilidad

1. Reconfirmar la misma sesión ya cargada no vuelve a levantar el panel de acceso.
   Primer ingreso/cambio real de usuario siguen exigiendo autenticación y nube.
   Respuestas tardías de otra sesión no pueden habilitar la pantalla anterior.
2. Proyectos conserva sus nodos/menús cuando llega un cambio ajeno al módulo.
   El hover ya no desplaza la tarjeta debajo del puntero. Se conserva realce visual.
3. Fallos de red usan espera incremental; 402/restricción por cuota espera desde
   cinco minutos, con tope de quince. Sincronización manual permite reintentar.
   Una escritura en vuelo sigue en la cola persistente hasta confirmación;
   cerrar sesión con pendientes fallidos no los borra silenciosamente.
   Se muestra aviso global ante fallo, sin presentar ese estado como sincronizado.
4. Transcripciones: flag de producto compartido, sin instancia cliente, navegación
   ni búsqueda; worker deshabilitado, sin timer, procesamiento ni limpieza;
   endpoint de ejecución devuelve 410 antes de consultar Auth. Config público
   declara `transcriptionEnabled: false` y `transcriptionConfigured: false`.
   **Clientes antiguos abiertos deben recargarse**: no se revocaron por SQL sus
   permisos de consulta/carga. Datos y archivos anteriores aún ocupan espacio.
5. Copia cifrada con WebCrypto: AES-GCM, claves aleatorias por instantánea,
   RSA-OAEP para actualizarlas sin conservar la clave privada descifrada y PBKDF2
   SHA-256 (600.000 iteraciones) para proteger la clave privada con la clave local.
   IndexedDB separado de la sincronización conserva las tres últimas versiones;
   actualización atómica impide que una pestaña anterior pise una más reciente.
6. Visor independiente `/recovery.html`, sin Supabase ni conexiones de datos,
   búsqueda y exportación, bloqueo al ocultarse o tras diez minutos. Service worker
   guarda sólo sus cuatro recursos estáticos; no guarda respuestas autenticadas.
   Si falla la navegación raíz por falta de red/HTTP 5xx, ofrece el visor cacheado.
7. Corregida omisión previa del backup: `lifecycle_subscriptions` ahora se valida
   como registro JSON, conservando horarios e historial; antes podía impedir
   exportar el backup unificado de una cuenta con suscripciones.

### Activación y límites de la copia

- El usuario debe habilitarla **en cada navegador/dispositivo**, estando conectado:
  Cuenta → Datos y aplicación → Copia cifrada. Elegir una clave de 12–256 caracteres
  que recuerde, distinta de la contraseña de Supabase. El agente no elige su clave.
- Se actualiza al usar ese dispositivo, tras cambios/sincronización. No es una
  copia remota programada cuando el dispositivo está apagado.
- Descargar también el archivo cifrado y conservarlo fuera del navegador. Borrar
  almacenamiento/desinstalar puede eliminar IndexedDB y el visor cacheado.
- Si se olvida la clave no se puede recuperar esa copia. No hay puerta trasera ni
  contraseña enviada al servidor. No se implementó cambio de clave/eliminación
  de copias: requerirá exportación previa y confirmación específica.
- El visor muestra fecha de copia y si tenía cambios pendientes; datos en formato
  legible/JSON, no una segunda aplicación editable. Los adjuntos se conservan como
  referencias, no se duplican sus binarios. No entrega notificaciones.
- Protege **esa copia**, no cifra retroactivamente todos los datos normales del
  navegador ni protege contra dispositivo comprometido/XSS. No sustituye el login
  normal ni verifica revocaciones remotas estando desconectado.
- Máximo 16 MiB de datos por versión; si no cabe o falla el almacenamiento, se
  conserva la copia anterior y se informa el fallo. No se borran datos para caber.

## Evidencia de pruebas

- `npm test`: 420 pruebas para estabilidad; 428 tras incorporar Finanzas y sus
  pruebas de integración, 0 fallidas.
- `npm run test:ui`: escritorio 1440 y móvil 390, claro/oscuro; alta/edición/búsqueda
  de suscripción multihorario, reconfirmación sin panel, DOM/menú de proyecto estable,
  cero consultas de Transcripciones y cero escrituras ociosas por eco Realtime.
- Tres comprobaciones de revisión sin cambios descargan sólo revisión, no documento.
- `node scripts/recovery-smoke.cjs`: cifrado real/IndexedDB, clave errónea, datos
  tratados como texto, versiones, rechazo de copia vieja y navegación raíz con
  conexión del navegador realmente deshabilitada. Captura móvil inspeccionada.
- Crypto: round-trip, aislamiento por propietario, manipulación y clave incorrecta.
- No hay ensayo físico nuevo del Galaxy ni prueba productiva de Push. Los tests UI
  usan nube sintética aislada; no modifican la cuenta real.
- No se aplicaron migraciones SQL ni cambios de facturación.
- Estabilidad publicada: commit `37217871a84d01c9f92e060bebe3b3c5b68ce752`,
  GitHub Validate LifeCycle correcto (run `36362251776`), Render manual
  `dep-dasredl9fdbs73eo6uqg` **live** a las 00:39:57 UTC del 28/09
  (21:39 del 27/09 en Argentina). Config productivo confirma Transcripciones
  deshabilitado y `/recovery.html` devuelve 200.

## Sandía: mapa observado, no clonación de backend

Sesión autenticada en `https://www.sandia.la/app`. Navegación de sólo lectura,
sin crear movimientos, tocar sus cuentas/metas ni enviar mensajes de WhatsApp.

| Sección observada | Función/organización visible | Aplicación a LifeCycle |
|---|---|---|
| Inicio | Moneda ARS/USD, mes, ingresos/egresos, comparativa y últimos movimientos | Resumen rápido, mantener privacidad de importes |
| Movimientos | Registro unificado, búsqueda/filtros; formulario ingreso/egreso, importe, moneda, categoría, cuenta | Una única lista con edición y vínculo al origen |
| Patrimonio | Cuentas/bienes/evolución, saldos y traspasos | Separar cuentas de categorías; transferencia no es gasto |
| Gastos fijos | Recurrencias y registro de cada pago | Reutilizar suscripciones/recurrencias, evitar gasto duplicado |
| Tarjetas | Deuda, disponible, cierre y vencimiento | Seguimiento manual; nuevos avisos requieren integración posterior |
| Presupuestos | Límite mensual por categoría, fijo o porcentaje de ingresos | Presupuesto informativo conservando historial |
| P&L | Balance por mes y conversión por fecha de movimiento | No recalcular el pasado con la cotización de hoy |
| Ahorro | Cuentas de ahorro y aportes mensuales | Clasificación de fondos, no contar transferencias como ingresos |
| Metas | Objetivo y progreso financiado desde ahorro | Mejora opcional posterior, sin doble contabilización |
| Inversiones | Cartera/posiciones y precios de mercado | Cotizaciones automáticas requieren diseño/proveedor aparte |
| Alertas | Presupuestos, vencimientos y anomalías | Reutilizar recordatorios existentes, no segundo scheduler |

Se vio el formulario de nuevo movimiento. Algunos botones de alta/filtros no
abrieron un diálogo verificable durante la inspección; **no se declara mapeado su
comportamiento interno**, ni verificados todos los formularios/planes/precios.
WhatsApp sólo se observó como enlace; no se probó ni se asumió que sea gratuito.

### Alcance inicial aprobado durante esta entrega

Primero resumen, movimientos, cuentas, presupuestos y tarjetas, conservando
suscripciones/proyectos. Ahorro/metas/P&L pueden agregarse sobre el mismo modelo;
inversiones automáticas y WhatsApp fuera de esta primera implementación. El usuario
confirmó: **«Sí, ese alcance primero»**. Implementar después de publicar el bloque
de estabilidad, con compatibilidad de datos antes que una reescritura destructiva.

Reglas de integridad del diseño (se distingue abajo lo implementado del objetivo):

- Ledger versionado; ID estable, importe en unidad mínima, moneda original,
  categoría, cuenta, fecha y referencia de origen. Nunca sumar ARS y USD sin una
  conversión explícita y fechada. No inferir cotizaciones para datos históricos.
- Importación compatible de `finanzasData`, respaldo previo, preservar IDs y las
  claves de idempotencia de gastos de suscripción/proyecto. Migración ensayada con
  fixtures antes de cualquier cambio sobre datos reales.
- Traspasos enlazan salida/entrada sin duplicar ingresos/gastos. Pago de tarjeta
  liquida deuda; no vuelve a contar el consumo como gasto.
- Detalle e historial se cargan bajo demanda/paginados al separar almacenamiento;
  no poner otro documento gigante en cada notificación Realtime.
- Aceptación: importes históricos iguales, saldos reconciliables, sin doble gasto,
  recordatorios existentes conservados, pruebas moneda/fecha/edición/borrado lógico,
  vistas escritorio/móvil y recuperación de backup.

### Finanzas: implementación compatible de este primer alcance

- Nueva vista propia con Resumen, Movimientos, Cuentas, Presupuestos y Tarjetas;
  mantiene estilo LifeCycle, privacidad de montos, temas y diseño móvil.
- `finanzasData` conserva sus colecciones originales. `workspace.version=1`
  añade cuentas, presupuestos y traspasos **sólo cuando el usuario crea datos**.
  No hay migración masiva, SQL ni reescritura del historial al abrir la aplicación.
- Nuevos movimientos desde esta vista conservan moneda ARS/USD, centavos
  originales, cotización explícita y equivalente USD para informes anteriores.
  Historial sin moneda original se etiqueta como equivalente USD guardado; jamás
  se infiere el importe original ni se recalcula al dólar actual. Formularios
  anteriores/recurrencias/RPC de suscripciones mantienen su formato histórico USD.
- Cuentas en efectivo, banco, billetera y crédito, con saldo inicial explícito;
  moneda/tipo inmutables, edición y archivo sin borrar historial. Editar un gasto
  de una cuenta archivada conserva la asignación.
- Compras con tarjeta generan gasto; pagarla es un traspaso de saldo, no otro gasto.
  Se puede anular un traspaso conservando el registro y quitando su efecto contable.
  Traspasos sólo entre cuentas de igual moneda. No ejecuta operaciones bancarias.
- Tarjetas muestran deuda, disponible, cierre/vencimiento orientativos. **No se
  añadieron avisos Push de tarjetas ni extracción de resúmenes bancarios**.
- Presupuestos mensuales fijos por categoría/moneda. No porcentajes, inversiones,
  WhatsApp ni sincronización con Sandía. No se añadieron proveedores ni pagos.
- Proyectos y Suscripciones siguen siendo los orígenes de sus movimientos; no se
  duplican ni editan directamente desde la lista nueva. Vista anterior y detalles
  anuales continúan accesibles en un desplegable.
- El RPC de gasto de suscripción espera los cambios pendientes; reconcilia una
  respuesta tardía con cambios locales ocurridos durante la solicitud y descarta
  respuestas de otra sesión. No equivale a sincronización multiusuario por entidad:
  el documento financiero completo sigue siendo la unidad de escritura.
- Listas con búsqueda/filtros y 30 filas por página **en la UI**, no paginación de
  red. Traspasos muestra últimos 20; el resto permanece conservado en el backup.
  La cuota cliente cuenta traspasos; el servidor mantiene sus controles existentes
  de tamaño del documento, sin nueva cuota SQL específica de esas colecciones.
- Validación de backup ampliada, IDs y precisión histórica conservados; copia
  cifrada incluye automáticamente el nuevo workspace.
- Reactivar una suscripción exige confirmar próxima fecha hoy/futura; cancelar
  el editor conserva su estado. No registra los períodos que estuvo inactiva.
- QA: 4 escenarios UI escritorio/móvil y claro/oscuro, cuentas, tarjeta/pago sin
  doble gasto, anulación, presupuesto excedido, ARS/USD, edición con cuenta archivada,
  editor obsoleto rechazado, cierre al perder sesión, reactivación segura y backup.
  Fixtures sintéticos: ninguna operación financiera real se creó para probar.
- Publicación de Finanzas: pendiente de registrar commit/CI/deploy final.

## Pendientes reales, no cierre global

1. Medir un ciclo normal de egress oficial después de los arreglos. La causa
   histórica fue el bucle Realtime documentado en `INCIDENTE_EGRESS_2026-09-13.md`,
   no los audios. Archivar Transcripciones no es prueba de que jamás se llegue a
   cuota. No hay monitor automático del cupo oficial implementado todavía.
2. Activación humana de la copia en cada dispositivo y descarga de respaldo.
3. Escritura offline con conflictos por entidad y recuperación entre dos equipos:
   aún no implementada. La cola existente no equivale a una nueva arquitectura
   multi-dispositivo sin pérdida garantizada.
4. Plan A–F: Trading multihorario/compatibilidad de deduplicación y renovaciones sin
   abrir la app siguen pendientes. Reactivación segura implementada en este bloque.
   Trading usa proyección SQL y un registro durable cuya clave actual no incluye
   horarios; requiere migración coordinada y pruebas de idempotencia. El RPC actual
   de gastos deriva propietario de `auth.uid()`: no habilita por sí solo un worker
   de renovaciones service-role. No aplicar cambios SQL sin ensayo de esas rutas.
5. Prueba Push física y de cancelación tras completar; depende del teléfono.
6. Validación productiva/publicación de Finanzas; ampliaciones fuera de este primer
   alcance (metas, inversiones, avisos de tarjetas) no se dan por implementadas.

Siguiente acción técnica: revisar diff, repetir validación final, commit/push a
`main`, verificar CI y **despliegue manual** en My Workspace sin contratar recursos.
