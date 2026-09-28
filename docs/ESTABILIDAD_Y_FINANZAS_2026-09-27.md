# LifeCycle — estado de estabilidad y diseño de Finanzas, 27/09/2026

Este documento es el estado operativo vigente de esta entrega. Complementa el plan
A–F y **sustituye las propuestas incompatibles del 26/09**, no declara cerrado el
roadmap completo. No existe un Project Pack separado en este repositorio.

## Decisiones confirmadas por el usuario

- Recuperó acceso a LifeCycle el 27/09 por la noche. **No enviar más consultas a
  soporte por el bloqueo resuelto.** La comprobación independiente de Auth devolvió
  HTTP 200; esto no equivale a auditar toda la base ni a probar recepción Push.
- Render: **My Workspace**, servicio `Lifecycle`, rama `main`, plan Free,
  despliegue automático por commit. Repositorio `Fabriziococca/LifeCycle`.
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

- `npm test`: 420 pruebas aprobadas, 0 fallidas en la revisión final.
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
- No se aplicaron migraciones SQL ni cambios de facturación. Publicación de este
  bloque pendiente hasta registrar commit, CI y deploy en esta sección.

## Sandía: mapa observado, no clonación de backend

Sesión autenticada en `https://www.sandia.la/app`. Navegación de sólo lectura,
sin crear movimientos, tocar sus cuentas/metas ni enviar mensajes de WhatsApp.

| Sección observada | Función/organización visible | Aplicación a LifeCycle |
|---|---|---|
| Inicio | Moneda ARS/USD, mes, ingresos/egresos, comparativa y últimos movimientos | Resumen rápido, mantener privacidad de importes |
| Movimientos | Registro unificado, búsqueda/filtros; formulario ingreso/egreso, importe, moneda, categoría, cuenta | Una única lista con edición y vínculo al origen |
| Patrimonio | Cuentas/bienes/evolución, saldos y traspasos | Separar cuentas de categorías; transferencia no es gasto |
| Gastos fijos | Recurrencias y registro de cada pago | Reutilizar suscripciones/recurrencias, evitar gasto duplicado |
| Tarjetas | Deuda, disponible, cierre y vencimiento | Seguimiento manual y avisos; no integración bancaria implícita |
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

Reglas de integridad del diseño:

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

## Pendientes reales, no cierre global

1. Medir un ciclo normal de egress oficial después de los arreglos. La causa
   histórica fue el bucle Realtime documentado en `INCIDENTE_EGRESS_2026-09-13.md`,
   no los audios. Archivar Transcripciones no es prueba de que jamás se llegue a
   cuota. No hay monitor automático del cupo oficial implementado todavía.
2. Activación humana de la copia en cada dispositivo y descarga de respaldo.
3. Escritura offline con conflictos por entidad y recuperación entre dos equipos:
   aún no implementada. La cola existente no equivale a una nueva arquitectura
   multi-dispositivo sin pérdida garantizada.
4. Plan A–F: Trading multihorario/compatibilidad de deduplicación, reactivación de
   suscripciones con fecha segura y renovaciones sin abrir la app siguen pendientes.
   No mezclar esas migraciones con el parche de estabilidad sin su validación.
5. Prueba Push física y de cancelación tras completar; depende del teléfono.
6. Implementación del alcance de Finanzas aprobado; no se cambió aún su módulo.

Siguiente acción técnica: revisar diff, repetir validación final, commit/push a
`main`, verificar CI y despliegue automático en My Workspace sin contratar recursos.
