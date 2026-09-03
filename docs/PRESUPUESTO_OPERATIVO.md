# Presupuesto Operativo Global y Límites de Capa Gratuita
**LifeCycle — Fase D (Tandas 16A y 16B)**
**Última actualización:** Septiembre 2026

Este documento detalla el modelo de costos operativos proyectados, los límites técnicos de cada proveedor gratuito y las reglas de resguardo para garantizar que LifeCycle opere con costo **$0/mes**, evitando cualquier desborde de cuota o activación accidental de cargos de facturación.

---

## 1. Servicios y Capas Gratuitas (Free Tiers)

| Proveedor | Servicio | Límite Gratuito Mensual | Consumo Estimado LifeCycle | Margen de Seguridad |
|---|---|---|---|---|
| **Google AI Studio (Gemini)** | Gemini 1.5/2.0 Flash (Transcripciones) | • 15 solicitudes / minuto (RPM)<br>• 1.500 solicitudes / día (RPD)<br>• 1.000.000 tokens / minuto (TPM) | • ~5 a 20 notas de voz / día<br>• ~15.000 tokens / día | **> 98% libre** (riesgo nulo de saturación diaria) |
| **Supabase** | Base de datos PostgreSQL | • 500 MB almacenamiento de datos<br>• 1 GB almacenamiento de archivos<br>• 50.000 usuarios activos mensuales | • ~12 a 25 MB en base de datos<br>• Cero audio persistido (efímero) | **> 95% libre** |
| **Render** | Web Service (Node.js backend) | • 750 horas de cómputo / mes<br>• 512 MB memoria RAM<br>• 100 GB ancho de banda | • 1 servicio continuo (720-744 hs/mes)<br>• ~85-130 MB RAM en uso | **Dentro de la cuota mensual gratuita** |

---

## 2. Modelo de Notas de Voz y Audio

### Compresión y Consumo de Datos
* **Códec:** Opus en contenedor WebM (audio/webm;codecs=opus).
* **Canal:** Mono (1 canal, óptimo para voz humana).
* **Tasa de bits (Bitrate):** 32 kbps (4 KB/segundo).
* **Tamaño por duración:**
  * 1 minuto de audio: **~240 KB**.
  * 5 minutos de audio: **~1.2 MB**.
  * 15 minutos de audio: **~3.6 MB**.
  * 30 minutos de audio (límite máximo permitido por nota): **~7.2 MB**.

### Política de Retención Efímera de Audios
1. El archivo de audio se almacena temporalmente en el backend únicamente para ser enviado a Gemini.
2. Una vez que Gemini retorna la transcripción validada, el audio original **se elimina automáticamente del servidor**.
3. En la base de datos de Supabase únicamente se persiste el **texto transcrito**, notas y metadatos (tamaño promedio: 2 a 8 KB por nota).
4. Esto garantiza que el almacenamiento de base de datos nunca crezca por acumulación de archivos binarios de audio.

---

## 3. Umbrales de Alerta y Control de Cuotas

Para evitar interrupciones o superar límites, el sistema implementa tres niveles de protección:

1. **Nivel 1 (Umbral Preventivo - 70% de cuota):**
   * El sistema registra advertencia en diagnósticos y notifica en el panel de administración.
2. **Nivel 2 (Umbral de Restricción - 85% de cuota):**
   * El intervalo de captura de audio limita las notas a un máximo de 10 minutos por sesión.
   * Se espacian las solicitudes a Gemini a un máximo de 5 por minuto.
3. **Nivel 3 (Pausa de Seguridad - 95% de cuota):**
   * Se suspenden temporalmente nuevas solicitudes de transcripción hasta la renovación de la cuota diaria (00:00 UTC).
   * La aplicación informa al usuario en pantalla con mensaje claro: "Límite gratuito diario alcanzado. Podrás transcribir nuevas notas a partir de mañana".
   * **Bajo ninguna circunstancia se activan tarjetas de crédito ni servicios de pago.**

---

## 4. Conclusión Técnica

Con una arquitectura orientada a texto en base de datos, compresión Opus a 32 kbps en cliente, retención efímera de audios y respeto de los 15 RPM de Gemini Free Tier, LifeCycle puede operar con estabilidad absoluta para el usuario propietario y usuarios de prueba manteniendo el costo en **$0.00 USD**.