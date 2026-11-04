# Suscripciones de clientes y registro directo

Clientes → ficha → Suscripciones reutiliza el modelo, editor y tarjetas de Suscripciones. El módulo global separa Propias, Clientes y Todas; no mantiene copias de un mismo servicio. Resumen incluye las suscripciones junto a las demás responsabilidades. Archivar un cliente suspende avisos y avances de sus ciclos; conserva los registros.

Regla confirmada el 04/11/2026: las suscripciones vinculadas a un cliente las paga ese cliente. Su importe y moneda son informativos, opcionales y editables con el mismo formulario. No presentan acciones de convertir a paga ni registrar gasto, y no habilitan el registro automático. El resumen de Clientes muestra su costo; Todas conserva el gasto propio y aclara por separado el costo de clientes. El vínculo clientId también bloquea gastos desde Finanzas, desde el worker y desde la operación atómica de PostgreSQL, aun cuando una versión vieja envíe billingMode=paid. Los ciclos siguen avanzando sin gastos. No se reescriben datos personales ni movimientos históricos al desplegar esta regla.

El ciclo puede ser por meses calendario o por una cantidad exacta de días. Los días exactos se calculan desde la renovación prevista, sin desplazar el calendario por registrar una revisión tarde. El esquema conserva clientId, periodDays, renewalTime y alert.noticeDays; las suscripciones anteriores mantienen su frecuencia y sus avisos diarios desde daysBefore.

El modo Sólo seguimiento no afirma que el servicio sea gratuito ni crea gastos. El servidor avanza su calendario aunque no haya navegador ni dispositivos Push. Espera a que termine la ventana del último aviso del día de renovación. Si hay hora de renovación, los avisos posteriores de ese día se adelantan a dicha hora, siempre en Argentina. El avance no confirma un pago ni una renovación del proveedor. Pausar, cancelar o desactivar renovación automática detiene el avance.

La opción de avisos progresivos notifica exactamente a 7, 5, 3, 2, 1 y 0 días; no avisa a 6 ni 4. La hora habitual se elige con los mismos controles existentes. Los pagos automáticos opcionales siguen usando la transacción atómica existente, ahora compatible con periodDays. Un ciclo sólo genera como máximo un gasto por periodo; un seguimiento sin importe nunca lo genera.

Configuración solicitada para Diego: Webshare 04/11/2026 17:47; ngrok 29/11/2026 21:00; ambas cada 30 días, con avisos habituales a las 22:00. La periodicidad de ngrok es una instrucción del usuario, no una comprobación del proveedor. No se presume importe, medio de pago ni pagos históricos.

Las tarjetas de clientes se registran inmediatamente con la fecha Argentina actual. Un segundo registro rápido el mismo día no duplica el historial. El menú permite Registrar en otra fecha, con notas opcionales y validación de fechas. Seguimientos organiza las mismas tarjetas en una grilla compacta.

Validación: tests/client-subscriptions.test.mjs; scripts/client-subscriptions-sql-check.mjs (PostgreSQL aislado); modos client-subscriptions y maintenance de scripts/ui-smoke.cjs, 1440/390 px y claro/oscuro. Se conserva el backup completo con los nuevos campos. Verificar siempre identidad QA antes de escribir; la carga personal autorizada se limita a las dos suscripciones anteriores.
