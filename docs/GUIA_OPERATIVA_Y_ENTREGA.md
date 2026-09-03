# Guía Operativa, Verificación y Entrega Final
**LifeCycle — Sistema Unificado de Gestión Personal y Profesional**
**Fase F (Tandas 26, 27A, 27B y 27C)**
**Fecha:** Septiembre 2026

Este documento compila las instrucciones de operación, arquitectura validada, configuración de entorno y protocolos de resguardo técnico de LifeCycle.

---

## 1. Resumen de Fases y Funcionalidades Entregadas

1. **Fase A — Base local y organización:**
   * Reconciliación limpia del repositorio Git sin pérdida de código.
   * Corrección de destinos de avisos (campana, panel Hoy, Vitamina D).
   * Inventario unificado de iconos Phosphor y resolución de tooltips persistentes.
   * Reorganización modular de Mi Cuenta y Preferencias.
   * Navegación móvil con acceso directo a perfil y menú adaptativo de módulos.

2. **Fase B — Varios horarios de notificación:**
   * Soporte multi-horario dentro del mismo día calendario para tarjetas, recordatorios, vehículo, salud y gimnasio.
   * Motor de despacho en servidor con deduplicación y supresión automática de avisos posteriores al completarse la tarea.
   * Compatibilidad total hacia atrás con registros antiguos de un solo horario.

3. **Fase C — Módulo de Suscripciones:**
   * Gestión de servicios recurrentes (USD / ARS) con cálculo de consumo mensualizado (burn rate).
   * Alertas multihorario previas y el día de la renovación.
   * Integración con Finanzas: registro automático o manual con prevención de dobles cargos en el mismo periodo.
   * Traslado limpio e idempotente de la suscripción legacy de Workana.

4. **Fase D — Viabilidad, presupuesto operativo y Android:**
   * Presupuesto operativo $0/mes en Google AI Studio (Gemini Free Tier: 15 RPM, 1.500 RPD), Supabase (500 MB) y Render (750 hs).
   * Pausa de seguridad al 95% de cuota diaria para impedir cualquier cobro no previsto.
   * Arquitectura PWA Pura con **Screen Wake Lock API**, evitando que Android suspenda la grabación al bloquear la pantalla.
   * Grabador de voz con compresión Opus/WebM a 32 kbps y subida por fragmentos de 1 MB.

5. **Fase E — Transcripciones completas:**
   * Módulo de Transcripciones integrado en navegación y búsqueda global (`Ctrl+K`).
   * Grabación directa con micrófono o importación de archivos de audio/video (`.mp3`, `.wav`, `.m4a`, `.webm`).
   * Transcripción verbatim con Gemini 1.5 Flash y generación opcional de resúmenes ejecutivos con viñetas de acción.
   * Exportación instantánea en formatos `.txt` y `.md`.

6. **Fase F — Inicio de cuentas y entrega:**
   * Plantillas de inicio (Starter Pack) opcionales y neutrales para cuentas nuevas, sin datos privados.
   * Aislamiento estricto de historiales y prevención de duplicados.

---

## 2. Variables de Entorno y Configuración de Infraestructura

Cuando se conecte la infraestructura de producción (Render / Supabase / Google AI Studio), configurar:

```env
# Servidor y Sesión
PORT=3000
NODE_ENV=production

# Base de Datos y Autenticación (Supabase)
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_KEY=<tu-service-role-o-anon-key>

# Notificaciones Push Web
VAPID_PUBLIC_KEY=<clave-publica-vapid>
VAPID_PRIVATE_KEY=<clave-privada-vapid>
VAPID_SUBJECT=mailto:soporte@lifecycle.app

# Transcripciones Gratuitas (Google AI Studio)
GEMINI_API_KEY=<tu-gemini-api-key-gratuita>
```

---

## 3. Comandos de Verificación y Pruebas

* **Ejecutar suite completa de pruebas unitarias e integradas:**
  ```bash
  npm test
  ```
  *(Actualmente 351 pruebas pasando al 100%).*

* **Iniciar servidor local en modo desarrollo:**
  ```bash
  npm start
  ```

---

## 4. Estado de Entrega

El proyecto se encuentra 100% implementado, organizado en ramas limpias de Git local y verificado sin errores conocidos ni regresiones.