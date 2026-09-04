# Presupuesto operativo de transcripciones

**LifeCycle — revisión técnica del 4 de septiembre de 2026**

## Objetivo

El modo inicial busca costo adicional **USD 0**, sin activar automáticamente facturación ni cambiar a proveedores pagos. Esto es un objetivo operativo, no una garantía absoluta: las cuotas y condiciones comerciales pertenecen a Google, Supabase y Render y pueden cambiar. Antes de ampliar uso se deben consultar los paneles reales del proyecto.

## Límites propios de LifeCycle

| Recurso | Límite de seguridad |
|---|---:|
| Duración por sesión grabada | 3 horas |
| Duración nominal de cada fragmento | 5 minutos |
| Tamaño máximo por objeto/importación | 50 MB |
| Audio temporal contabilizado por sesión | 256 MB |
| Audio temporal total del propietario | 750 MiB |
| Intentos de proveedor por día | 100, configurable |
| Retención tras transcripción correcta | 24 horas |
| Retención de una sesión fallida | hasta 7 días |

El límite diario de 100 cuenta cada llamada de transcripción, resumen o apuntes. Es independiente de la cuota que Google aplique al proyecto. Cuando se alcanza, los trabajos pasan a espera hasta las 00:05 UTC; el audio no se borra ni se contrata capacidad.

## Tamaños esperables

La grabación Android usa AAC mono a 48 kbit/s. Sin contar pequeños encabezados:

- cinco minutos: aproximadamente 1,8 MB;
- una hora: aproximadamente 21,6 MB;
- tres horas: aproximadamente 64,8 MB.

Por eso una sesión larga cabe en muchos objetos pequeños aunque su suma supere 50 MB. Los archivos ya existentes importados desde web sí deben caber individualmente en 50 MB. Los formatos sin compresión y los videos consumen mucho más y se normalizan en Render antes de enviarse al proveedor.

El borrado reduce el almacenamiento ocupado, pero no revierte la transferencia ya consumida. Además, una importación necesita temporalmente el original y los fragmentos preparados, por lo que su pico de almacenamiento puede ser cercano al doble del audio normalizado.

## Google Gemini

- Modelo de transcripción predeterminado: `gemini-3.5-transcribe`.
- Modelo para resumen/apuntes: `gemini-2.5-flash`.
- La clave vive sólo en Render como `GEMINI_API_KEY`.
- LifeCycle reintenta únicamente errores temporales y registra cada intento antes de llamar al proveedor.
- Un error 429 espera; no cambia a una API paga.

Las cuotas gratuitas no se codifican como “15 RPM” o “1.500 solicitudes diarias” porque dependen del modelo, la cuenta y el proyecto. El límite local de 100 es un freno conservador, no una afirmación sobre la cuota oficial.

La modalidad gratuita puede tratar los datos conforme a las condiciones de Google. La interfaz exige consentimiento y advierte no usar material confidencial mientras no se adopte una vía contractual, local o paga más apropiada.

## Supabase y Render

- Supabase conserva metadatos y documentos en PostgreSQL, y audio temporal en un bucket privado con RLS.
- El bucket restringe cada archivo a 50 MB y LifeCycle frena nuevas cargas al llegar a 750 MiB contabilizados.
- El worker de Render usa FFmpeg y puede necesitar CPU y memoria apreciables con video o formatos pesados.
- En un servicio gratuito, una suspensión o reinicio puede demorar el procesamiento; la cola persistente permite recuperarlo.

Antes de aumentar límites hay que revisar almacenamiento, egreso, uso de base, memoria del servicio y consumo real de Gemini. Borrar archivos no reemplaza esa medición.

## Cuándo considerar un servicio pago

Evaluar una alternativa paga o local si ocurre cualquiera de estas condiciones:

- material confidencial que no deba procesarse bajo condiciones gratuitas;
- calidad insuficiente en muestras reales;
- cuotas recurrentemente agotadas;
- necesidad de tiempos de respuesta garantizados;
- almacenamiento o transferencia sostenidos cerca de los topes del proyecto.
