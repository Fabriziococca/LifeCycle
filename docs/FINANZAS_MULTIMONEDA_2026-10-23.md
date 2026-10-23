# Finanzas: conversión automática, moneda original e histórico

Alcance autorizado el 23/10/2026: totales USD/ARS compartiendo preferencia con
Proyectos, desglose de moneda original, equivalentes históricos de cada cobro,
valoración actual de cuentas y conversión opcional entre cuentas. No añade bancos,
servicios pagos ni obliga a registrar compras de dólares.

## Reglas y conservación

- `amount` sigue siendo el equivalente USD guardado. No se reescribe el historial.
- La vista predeterminada convierte automáticamente al cambio actual de referencia
  compartido con Proyectos (Lemon vía CriptoYa; respaldo identificado si falla).
  No requiere completar cotizaciones antiguas. Usa los importes originales cuando
  existen y el equivalente USD guardado cuando la moneda original es desconocida.
  El selector Cotización permite alternar con el histórico de cada cobro/gasto.
  Sólo se guarda la preferencia local de vista; nunca se guarda el cambio actual
  como cotización de una fecha pasada ni se presume la moneda de cobros antiguos.
- `nativeCurrency` y `nativeAmountMinor` conservan moneda e importe recibidos.
  En ARS, `exchangeRate` fija ARS por USD al registrar el cobro/gasto. En USD,
  `exchangeRate=1` y `valuationRate`, opcional, guarda la referencia histórica ARS.
- Una cotización actual sólo se sugiere para la fecha de hoy y con caché fresca.
  Para el histórico estricto, fechas anteriores necesitan una cotización ingresada
  expresamente. Sin ella, el informe ARS identifica subtotal e importes sin convertir;
  no usa el dólar de hoy. La vista Actual · automática sigue disponible sin esa carga.
  Si todos carecen de cotización, muestra el equivalente USD guardado y el
  resultado pendiente; no presenta ingresos ni resultado en ARS como cero.
- Los registros antiguos sin moneda original conservan su equivalente USD y se
  muestran por separado. No se los presenta como dólares efectivamente cobrados.
- Confirmar importe original pide sólo moneda e importe realmente recibido/pagado.
  Se guarda en `workspace.receipts`, con `originalConfirmedAt` y huella del origen;
  el movimiento fuente y su equivalente USD quedan intactos. El importe puede
  corregir la referencia anterior. En ARS, `rateSource=saved-equivalent` identifica
  la proporción técnica de compatibilidad; nunca se presenta como cotización de
  mercado de aquella fecha. En histórico USD se marca esa referencia como estimada.
- Confirmar ingresos como USD muestra hasta 200 ingresos con original pendiente,
  del mes y filtros actuales. Empieza sin selección y muestra cantidad/total antes
  de guardar. Sólo aplica a seleccionados; valida sesión y huellas de todos antes
  de una única escritura. Un ingreso editado, eliminado o ya confirmado cancela
  toda la tanda. Los gastos y registros no seleccionados se conservan.
- Totales, categorías y filas que usan referencias antiguas pendientes llevan
  marca de estimación. Una confirmación elimina esa incertidumbre para el importe
  en su moneda original. Se puede corregir después desde el mismo registro.
  Editar descripción/fecha conserva la confirmación; cambiar el origen por fuera
  de ese recorrido invalida la anotación cuando su huella ya no coincide.
- `workspace.receipts` permite completar datos del registro desde Finanzas sin
  duplicar el movimiento ni modificar documentos de Proyectos/Mantenimientos.
  Incluye identidad, fecha, equivalente USD y huella del origen: una modificación
  del origen invalida su aplicación. Parciales conservan la identidad al archivar.
  También permite completar sólo la cotización, manteniendo original desconocida.
- Los nuevos cobros parciales/finales de Proyectos confirman moneda y cotización;
  sus metadatos acompañan al movimiento derivado. Una edición concurrente o un
  cambio de cuenta impide confirmar un proyecto distinto del revisado.
- El saldo neto agrega cuentas registradas, archivadas y deudas de tarjetas hasta
  hoy; excluye movimientos futuros y no depende del mes ni del filtro del informe.
  Se informa origen/fecha/frescura de la referencia actual. Si falta, no se inventa
  una valoración conjunta. El saldo es manual, no una consulta bancaria.
- Traspasos de igual moneda conservan el formato anterior. En una conversión,
  `amountMinor/currency` es lo enviado y `receivedAmountMinor/receivedCurrency`
  lo neto recibido. La cotización surge de esos importes reales; no hay otro ingreso
  ni gasto. Anular conserva el registro y deja de afectar ambos saldos. Las
  conversiones no se aplican a tarjetas de crédito.
- Resumen, Movimientos y cobros de Proyectos comparten moneda de visualización y
  criterio de cotización. El desglose original se conserva en ambas vistas. El
  informe mensual a valor actual no representa dinero que aún conservás; el saldo
  de cuentas se calcula separadamente a partir de los movimientos registrados.
- Backups y recuperación cifrada usan el mismo validador para los campos nuevos.
  No hay migración SQL ni modificación masiva de datos/propietarios/permisos.

## Verificación

- Pruebas de cálculo: mezcla USD 1.000 + ARS 500.000, tipo histórico 1.000,
  valoración posterior 1.800, datos antiguos, cotización incompleta, conversiones
  en ambos sentidos, anulación, fechas futuras, referencias alteradas y backups.
- Navegación real en navegador local con nube sintética, escritorio 1440 y móvil
  390, carbón y piedra: desglose, filtros, persistencia al recargar, cobros
  parciales/finales y ausencia de duplicación.
- QA autenticada: identidad confirmada antes de escribir, respaldo previo,
  registros sintéticos y comparación de datos tras retirar las pruebas. La cuenta
  personal queda fuera del procedimiento.
- Publicación: commit/CI y Manual Deploy se acreditan por separado con health y
  logs en el recibo local `.tmp-sb/currency-release.json`. Ese recibo distingue
  pruebas locales, QA y despliegue; este documento no acredita un despliegue solo.
- La simplificación de vista automática se verifica sin escribir datos en QA;
  su evidencia de publicación se guarda en `.tmp-sb/currency-auto-release.json`.
- La confirmación individual/en grupo se prueba con datos sintéticos en QA,
  respaldo previo, recarga desde la nube y restauración exacta de Finanzas.
  Evidencia de esta tanda: `.tmp-sb/originals-release.json`.

## Evolución de ingresos

- Gráfico SVG en Resumen de Finanzas, como el gráfico corporal, sin librerías ni
  servicios nuevos. Últimos 12 meses hasta el mes elegido, con puntos que se pueden
  tocar o seleccionar por teclado, detalle mensual y tabla accesible.
- Usa exactamente los ingresos combinados de Finanzas: manuales, Proyectos,
  Mantenimientos y resultados de campañas cerradas de Saylor. No suma recordatorios
  de Trading, posiciones abiertas, aportes de capital ni traspasos entre cuentas.
- Total por defecto; permite separar Software/clientes (freelance, software,
  Proyectos y Mantenimientos), Trading (categoría trading y Saylor) y otros ingresos.
- Respeta USD/ARS, modo de cotización, moneda original y ámbito. Los meses con
  cotización faltante dejan un hueco, sin dibujar su subtotal como total completo.
  Estimados se distinguen con ≈ y punto hueco. Ocultar montos retira todo
  el gráfico y su tabla para que tampoco se revelen importes por puntos o tooltips.
