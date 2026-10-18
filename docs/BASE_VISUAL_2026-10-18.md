# Base visual de LifeCycle

Autorizada por Fabrizio después de la revisión de referencias del 17/10.
Objetivo: más claridad y personalidad conservando rapidez y acceso inmediato.

## Implementación

- Base compartida en `visual.css`: superficies opacas, contraste, pestañas,
  botones, foco y variantes claras/oscuras; acento discreto en Trabajo.
- Higiene y tarjetas configurables: jerarquía de estado, fechas y registro;
  confirmación visual breve después de la sincronización confirmada.
- Cargas: conexión SVG finita al iniciar, tiempo/plazo y estado real del último
  aviso, ayuda secundaria desplegable. Sin más consultas ni polling.
- Proyectos: alta desplegable debajo de los activos y acceso directo arriba;
  atajo de Hoy conserva el foco. Estados reales de curso/entrega; fases continúan
  siendo texto libre, sin progreso de trabajo inventado.
- Saylor: tres cargadores de treinta segmentos; reglas desplegables.
- Preferencia local de movimiento reducido, siempre subordinada a la preferencia
  de accesibilidad del dispositivo. Se elimina el fondo animado continuo.
- Salud, bloqueo, recuperación y Finanzas conservan todos sus controles y
  confirmaciones; no se agregan efectos que retrasen tareas sensibles.

No hay cambios de esquema, datos personales, permisos, facturación, motor Push
ni dependencias de animación. El frontend se puede revertir con Git conservando
los documentos e historiales.

## Validación

Pendiente de completar antes de la publicación: suite, QA visual y funcional
aislada en escritorio/móvil y claro/oscuro, sesión QA autenticada y comprobación
del commit publicado, `/api/health` y logs posteriores.
