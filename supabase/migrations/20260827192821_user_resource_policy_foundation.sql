-- Central per-user resource policy. This migration only exposes the policy;
-- feature-specific enforcement is added in bounded follow-up migrations.

set lock_timeout = '5s';
set statement_timeout = '30s';

create table if not exists private.lifecycle_access_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    access_tier text not null default 'friend',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint lifecycle_access_profiles_tier_check
        check (access_tier in ('owner', 'friend'))
);

comment on table private.lifecycle_access_profiles is
    'Server-managed access tier for LifeCycle users. Missing rows default to friend.';

create table if not exists private.lifecycle_resource_limits (
    access_tier text not null,
    resource_key text not null,
    limit_value bigint not null,
    limit_unit text not null default 'count',
    description text not null,
    updated_at timestamptz not null default now(),
    constraint lifecycle_resource_limits_pkey
        primary key (access_tier, resource_key),
    constraint lifecycle_resource_limits_tier_check
        check (access_tier in ('friend')),
    constraint lifecycle_resource_limits_key_check
        check (resource_key ~ '^[a-z][a-z0-9_]{1,62}$'),
    constraint lifecycle_resource_limits_value_check
        check (limit_value > 0),
    constraint lifecycle_resource_limits_unit_check
        check (limit_unit in ('count', 'bytes'))
);

comment on table private.lifecycle_resource_limits is
    'Central generous safety limits. The owner tier is unlimited and needs no rows.';

alter table private.lifecycle_access_profiles enable row level security;
alter table private.lifecycle_access_profiles force row level security;
alter table private.lifecycle_resource_limits enable row level security;
alter table private.lifecycle_resource_limits force row level security;

revoke all on table private.lifecycle_access_profiles
from public, anon, authenticated, service_role;
revoke all on table private.lifecycle_resource_limits
from public, anon, authenticated, service_role;

insert into private.lifecycle_resource_limits (
    access_tier,
    resource_key,
    limit_value,
    limit_unit,
    description
)
values
    ('friend', 'custom_modules', 30, 'count', 'Módulos personalizados'),
    ('friend', 'tracker_cards', 500, 'count', 'Tarjetas configurables'),
    ('friend', 'reminders', 500, 'count', 'Recordatorios'),
    ('friend', 'tasks', 5000, 'count', 'Tareas'),
    ('friend', 'projects', 500, 'count', 'Proyectos'),
    ('friend', 'project_templates', 100, 'count', 'Plantillas de proyectos'),
    ('friend', 'finance_transactions', 25000, 'count', 'Movimientos financieros'),
    ('friend', 'finance_recurring_rules', 500, 'count', 'Reglas financieras recurrentes'),
    ('friend', 'trading_events', 1000, 'count', 'Eventos de trading'),
    ('friend', 'gym_routine_exercises', 1000, 'count', 'Ejercicios de rutinas'),
    ('friend', 'gym_meal_templates', 1000, 'count', 'Comidas y plantillas'),
    ('friend', 'gym_supplements', 500, 'count', 'Suplementos'),
    ('friend', 'vehicle_issues', 2000, 'count', 'Fallas de vehículo'),
    ('friend', 'blood_test_files', 1000, 'count', 'Adjuntos de análisis'),
    ('friend', 'synced_document_bytes', 5242880, 'bytes', 'Documento sincronizado por usuario'),
    ('friend', 'blood_test_file_bytes', 15728640, 'bytes', 'Tamaño máximo por adjunto')
on conflict (access_tier, resource_key) do update
set
    limit_value = excluded.limit_value,
    limit_unit = excluded.limit_unit,
    description = excluded.description,
    updated_at = now();

create or replace function public.get_my_resource_policy()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_access_tier text;
    v_limits jsonb;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '28000';
    end if;

    select profile.access_tier
    into v_access_tier
    from private.lifecycle_access_profiles as profile
    where profile.user_id = v_user_id;

    v_access_tier := coalesce(v_access_tier, 'friend');

    select coalesce(
        jsonb_object_agg(limit_row.resource_key, limit_row.limit_value),
        '{}'::jsonb
    )
    into v_limits
    from private.lifecycle_resource_limits as limit_row
    where limit_row.access_tier = v_access_tier;

    return jsonb_build_object(
        'tier', v_access_tier,
        'unlimited', v_access_tier = 'owner',
        'limits', v_limits
    );
end;
$$;

revoke all on function public.get_my_resource_policy()
from public, anon, service_role;
grant execute on function public.get_my_resource_policy()
to authenticated;

comment on function public.get_my_resource_policy() is
    'Returns the authenticated LifeCycle user tier and centrally managed limits.';
