-- Read-only checks to run in Supabase SQL Editor after the 2026-08-01 and 2026-08-21 migrations.
with expected_columns(column_name) as (
    values
        ('device_name'),
        ('platform'),
        ('browser'),
        ('user_agent'),
        ('endpoint_fingerprint'),
        ('last_seen_at'),
        ('last_success_at'),
        ('last_failure_at'),
        ('consecutive_failures')
)
select
    'push_subscription_columns' as check_name,
    bool_and(columns.column_name is not null) as passed,
    string_agg(expected.column_name, ', ' order by expected.column_name)
        filter (where columns.column_name is null) as missing
from expected_columns as expected
left join information_schema.columns as columns
    on columns.table_schema = 'public'
    and columns.table_name = 'push_subscriptions'
    and columns.column_name = expected.column_name;

select
    'notification_history_rls' as check_name,
    coalesce(classes.relrowsecurity, false) as passed,
    classes.relforcerowsecurity as forced
from pg_catalog.pg_class as classes
join pg_catalog.pg_namespace as namespaces
    on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'public'
  and classes.relname = 'notification_delivery_log';

select
    'private_snapshot_rls' as check_name,
    coalesce(classes.relrowsecurity, false)
        and coalesce(classes.relforcerowsecurity, false) as passed,
    classes.relrowsecurity as enabled,
    classes.relforcerowsecurity as forced
from pg_catalog.pg_class as classes
join pg_catalog.pg_namespace as namespaces
    on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'private'
  and classes.relname = 'user_data_snapshots';

select
    'notification_history_client_privileges' as check_name,
    not (
        has_table_privilege('anon', 'public.notification_delivery_log', 'select')
        or has_table_privilege('authenticated', 'public.notification_delivery_log', 'select')
        or has_table_privilege('anon', 'public.notification_delivery_log', 'insert')
        or has_table_privilege('authenticated', 'public.notification_delivery_log', 'insert')
    ) as passed;

select
    'push_subscription_service_update' as check_name,
    has_table_privilege(
        'service_role',
        'public.push_subscriptions',
        'update'
    ) as passed;

select
    'notification_history_semantics' as check_name,
    exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'notification_delivery_log'
          and column_name = 'confirmed_at'
    )
    and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'notification_delivery_log'
          and column_name = 'endpoint_fingerprint'
          and is_nullable = 'YES'
    )
    and exists (
        select 1
        from pg_catalog.pg_constraint as constraints
        join pg_catalog.pg_class as classes on classes.oid = constraints.conrelid
        join pg_catalog.pg_namespace as namespaces on namespaces.oid = classes.relnamespace
        where namespaces.nspname = 'public'
          and classes.relname = 'notification_delivery_log'
          and constraints.contype = 'c'
          and pg_get_constraintdef(constraints.oid) like '%no_devices%'
    ) as passed;

with expected_columns(column_name) as (
    values
        ('scheduled_at'),
        ('expires_at'),
        ('received_at'),
        ('displayed_at'),
        ('discarded_at'),
        ('receipt_token_hash')
)
select
    'notification_delivery_telemetry' as check_name,
    bool_and(columns.column_name is not null)
        and to_regclass('public.notification_delivery_log_dispatch_once_idx') is not null
        as passed,
    string_agg(expected.column_name, ', ' order by expected.column_name)
        filter (where columns.column_name is null) as missing
from expected_columns as expected
left join information_schema.columns as columns
    on columns.table_schema = 'public'
    and columns.table_name = 'notification_delivery_log'
    and columns.column_name = expected.column_name;

select
    'project_templates_sync_allowlist' as check_name,
    position(
        '''projectPulseTemplates'''
        in pg_get_functiondef('public.merge_user_data_keys(jsonb,text[])'::regprocedure)
    ) > 0 as passed;
