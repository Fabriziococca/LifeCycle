-- Migration: 20260903000000_allow_subscriptions_sync.sql
-- Fase C (Suscripciones)
-- Documenta y prepara la estructura de sincronización de suscripciones.
-- Nota: La aplicación actualmente ya sincroniza de forma transparente mediante 'projectPulseSubscription'
-- asegurando funcionamiento continuo previo a la ejecución remota de esta migración.

do $$
begin
    -- Registro de compatibilidad para el catálogo de base de datos
    comment on table public.user_data is 'Almacén de datos de usuario de LifeCycle (incluye soporte para suscripciones e historial)';
end $$;
