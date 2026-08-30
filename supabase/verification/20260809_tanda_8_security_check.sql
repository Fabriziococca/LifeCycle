-- Read-only production checks for the Tanda 8 database foundation.
-- Accounts created after the snapshot are intentionally excluded from the
-- recovery-point cardinality check.
with snapshot_boundary as (
    select max(captured_at) as captured_at
    from private.user_data_snapshots
    where reason = 'before_tanda_8_20260809'
), missing_preexisting_documents as (
    select documents.user_id
    from public.user_data as documents
    join auth.users as users on users.id = documents.user_id
    cross join snapshot_boundary
    where users.created_at <= snapshot_boundary.captured_at
      and not exists (
          select 1
          from private.user_data_snapshots as snapshots
          where snapshots.reason = 'before_tanda_8_20260809'
            and snapshots.user_id = documents.user_id
      )
)
select
    'tanda_8_recovery_snapshot' as check_name,
    count(*) > 0
        and not exists (select 1 from missing_preexisting_documents) as passed,
    count(*) as snapshot_rows,
    (select count(*) from missing_preexisting_documents) as missing_rows,
    string_agg(md5(data::text), ', ' order by user_id) as snapshot_hashes
from private.user_data_snapshots
where reason = 'before_tanda_8_20260809';

select
    'user_data_revision_contract' as check_name,
    exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'user_data'
          and column_name = 'revision'
          and data_type = 'bigint'
          and is_nullable = 'NO'
    )
    and exists (
        select 1
        from pg_catalog.pg_trigger
        where tgrelid = 'public.user_data'::regclass
          and tgname = 'user_data_revision_before_update'
          and not tgisinternal
    ) as passed;

select
    'user_data_client_privileges' as check_name,
    has_table_privilege('authenticated', 'public.user_data', 'select')
    and not has_table_privilege('authenticated', 'public.user_data', 'insert')
    and not has_table_privilege('authenticated', 'public.user_data', 'update')
    and not has_table_privilege('authenticated', 'public.user_data', 'delete')
    and not has_table_privilege('anon', 'public.user_data', 'select')
    and not has_table_privilege('anon', 'public.user_data', 'insert')
    and not has_table_privilege('anon', 'public.user_data', 'update')
    and not has_table_privilege('anon', 'public.user_data', 'delete') as passed;

select
    'user_data_rls_policy' as check_name,
    count(*) = 1
    and bool_and('authenticated' = any(roles)) as passed,
    array_agg(policyname order by policyname) as policies
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'user_data';

select
    'user_data_rpc_security' as check_name,
    procedures.prosecdef
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and has_function_privilege(
        'authenticated',
        'public.merge_user_data_keys(jsonb,text[])',
        'execute'
    )
    and not has_function_privilege(
        'anon',
        'public.merge_user_data_keys(jsonb,text[])',
        'execute'
    )
    and not has_function_privilege(
        'service_role',
        'public.merge_user_data_keys(jsonb,text[])',
        'execute'
    ) as passed
from pg_catalog.pg_proc as procedures
where procedures.oid = 'public.merge_user_data_keys(jsonb,text[])'::regprocedure;

select
    'owned_rows_cascade' as check_name,
    count(*) = 2 and bool_and(constraints.confdeltype = 'c') as passed,
    array_agg(classes.relname order by classes.relname) as tables
from pg_catalog.pg_constraint as constraints
join pg_catalog.pg_class as classes
    on classes.oid = constraints.conrelid
join pg_catalog.pg_namespace as namespaces
    on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'public'
  and classes.relname in ('user_data', 'push_subscriptions')
  and constraints.contype = 'f'
  and constraints.confrelid = 'auth.users'::regclass;

select
    'trading_events_security' as check_name,
    classes.relrowsecurity
    and has_table_privilege('authenticated', 'public.trading_events', 'select')
    and not has_table_privilege('authenticated', 'public.trading_events', 'insert')
    and not has_table_privilege('authenticated', 'public.trading_events', 'update')
    and not has_table_privilege('authenticated', 'public.trading_events', 'delete')
    and not has_table_privilege('anon', 'public.trading_events', 'select')
    and exists (
        select 1
        from pg_catalog.pg_indexes
        where schemaname = 'public'
          and tablename = 'trading_events'
          and indexname = 'trading_events_active_schedule_idx'
    ) as passed
from pg_catalog.pg_class as classes
where classes.oid = 'public.trading_events'::regclass;

select
    'trading_projection_capacity' as check_name,
    procedures.prosecdef
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and pg_get_functiondef(procedures.oid) ~ 'candidate.position <= 10000'
    and not has_function_privilege(
        'authenticated',
        'private.sync_trading_events_for_user(uuid,jsonb)',
        'execute'
    ) as passed
from pg_catalog.pg_proc as procedures
where procedures.oid =
    'private.sync_trading_events_for_user(uuid,jsonb)'::regprocedure;

with json_events as (
    select source.user_id, event.value ->> 'id' as id
    from public.user_data as source
    cross join lateral jsonb_array_elements(
        private.extract_trading_events(source.data)
    ) as event(value)
    where jsonb_typeof(event.value) = 'object'
      and event.value ->> 'id' ~ '^[a-z0-9][a-z0-9_-]{2,95}$'
      and btrim(coalesce(event.value ->> 'company', '')) <> ''
      and btrim(coalesce(event.value ->> 'name', '')) <> ''
), parity_delta as (
    (select user_id, id from json_events
     except
     select user_id, id from public.trading_events)
    union all
    (select user_id, id from public.trading_events
     except
     select user_id, id from json_events)
)
select
    'trading_projection_parity' as check_name,
    not exists (select 1 from parity_delta) as passed,
    (select count(*) from json_events) as json_rows,
    (select count(*) from public.trading_events) as relational_rows;

select
    'trading_dispatch_security' as check_name,
    classes.relrowsecurity
    and classes.relforcerowsecurity
    and not has_table_privilege(
        'authenticated',
        'private.trading_notification_dispatches',
        'select'
    )
    and not has_table_privilege(
        'anon',
        'private.trading_notification_dispatches',
        'select'
    ) as passed
from pg_catalog.pg_class as classes
where classes.oid = 'private.trading_notification_dispatches'::regclass;

select
    'trading_dispatch_rpc_security' as check_name,
    has_function_privilege(
        'service_role',
        'public.claim_trading_notification_dispatch(uuid,text,text,timestamptz,integer)',
        'execute'
    )
    and has_function_privilege(
        'service_role',
        'public.complete_trading_notification_dispatch(uuid,text,text,text)',
        'execute'
    )
    and not has_function_privilege(
        'authenticated',
        'public.claim_trading_notification_dispatch(uuid,text,text,timestamptz,integer)',
        'execute'
    )
    and not has_function_privilege(
        'anon',
        'public.complete_trading_notification_dispatch(uuid,text,text,text)',
        'execute'
    ) as passed;
