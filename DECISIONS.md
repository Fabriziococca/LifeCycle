# Decisiones vigentes de LifeCycle

Consolidación 17/11/2026. Mantener el detalle funcional en sus fuentes enlazadas; esta lista fija la precedencia para continuar.

| Decisión | Estado y fuente |
| --- | --- |
| Una aplicación y cuenta, espacios Personal / Trabajo | Vigente desde 21/10. Seguridad, dispositivos, apariencia y backups compartidos; no duplicar perfiles o datos por presentación. docs/ORGANIZACION_Y_DISENO_2026-10-21.md |
| Misma UX entre dominios | Reutilizar controles y formularios; registro frecuente de tarjeta en un toque, otra fecha en menú, detalles secundarios colapsados. docs/UX_CONVENTIONS.md; módulos de Clientes/Salud |
| Diseño blanco/negro y cereza/rosa | Propuesta aprobada 25/10 aplicada a toda la app, ambos temas y PC/móvil. Sustituye carbón/piedra y azules anteriores. Navegación sin destellos ni entradas animadas. docs/REDISENO_VISUAL_2026-10-25.md |
| Antonio/Clenia excluido | Fue referencia visual. En el trabajo actual no leer/editar/ejecutar ese proyecto ni interferir con su chat. Usar la propuesta preservada en LifeCycle |
| Backend único y datos conservados | Supabase es fuente principal; sincronización por claves/RPC con ownership y revisiones. No copiar al propietario ni reasignar proyectos automáticamente para QA |
| Tareas regulares entre dispositivos | Desde el 19/11 se combinan altas y cambios por tarea y campo. Dos textos incompatibles conservan ambas versiones. Una edición concurrente con un borrado conserva la edición. El servidor protege la lista ante clientes anteriores. Ver task-sync-utils.mjs y la migración 20261119185830. |
| Mantenimiento cobrado al cliente | Período pendiente sólo crea ingreso al confirmar recepción. Impago no avanza, múltiples proyectos no multiplican el ingreso. docs/CLIENTES_Y_MANTENIMIENTOS_2026-10-21.md |
| Suscripciones del cliente pagadas por el cliente | Confirmado 04/11: precio informativo opcional; nunca gasto propio, incluso para registros legacy paid. Guard en cliente, Finanzas, worker y SQL. Sustituye cualquier interpretación previa que permitiese convertirlas a gasto propio. docs/SUSCRIPCIONES_DE_CLIENTES_2026-11-01.md |
| Ciclos exactos y avisos progresivos | Cada 30 días no es mes calendario. Avisos 7/5/3/2/1/0; último día antes de rollover. Avanzar un calendario no acredita pago ni renovación real del proveedor |
| Diego Webshare/ngrok | Altas expresamente autorizadas y realizadas 01/11. No recrear ni reiniciar anclas históricas. La frecuencia ngrok de 30 días es elección del usuario, no comprobación del proveedor |
| Finanzas multimoneda | Conservar moneda/importe original. Histórico usa el tipo del cobro si existe; actual usa referencia actual. Ausentes se distinguen como estimados. No inventar ARS históricos desde un equivalente USD. Conversión entre cuentas es opcional y no otro ingreso. docs/FINANZAS_MULTIMONEDA_2026-10-23.md |
| Gráfico de ingresos combinado | Finanzas reúne manuales, Software/clientes, Mantenimientos y resultados realizados de Saylor. No contar capital, posiciones abiertas, recordatorios de Trading ni traspasos como ingresos |
| Transcripciones archivadas / APK diferido | Decisión producto 27/09, conservada y confirmada por flag/código/health al 17/11. No reactivar grabadora/biblioteca/IA ni desarrollar APK por indicaciones antiguas del roadmap |
| Recuperación cifrada sólo lectura | Permitida y existente; no habilita edición offline nueva. Clave elegida por el usuario, por dispositivo; no puerta trasera. docs/ESTABILIDAD_Y_FINANZAS_2026-09-27.md |
| Presupuesto | Objetivo cero/casi cero; techo deseado aproximado USD 5/mes no autoriza pagos ni contratación. No reducir integridad o puntualidad por ahorro |
| Publicación y QA | QA soyfabr aislada de propietario contacto; identidad antes de escribir. Manual Deploy para entregas funcionales y prueba exacta de commit/CI/health/logs. Diferenciar proveedor Push, dispositivo y confirmación humana |
| Migración de chat 17/11 | Sólo continuidad/documentación. No nueva tanda ni deploy, cambios de cuentas, datos, permisos o automatizaciones; conservar qa-preview/ y recibos ignorados |
