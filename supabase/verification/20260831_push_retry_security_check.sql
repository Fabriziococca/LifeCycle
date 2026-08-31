-- Read-only production verification for the bounded Push retry migration.
with checks as (
    select
        'push_retry_columns'::text as check_name,
        (
            select count(*) = 2
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'notification_delivery_log'
              and column_name in ('attempt_no', 'retry_of_id')
        ) as ok

    union all

    select
        'push_retry_constraints',
        (
            select count(*) = 3
            from pg_catalog.pg_constraint as constraint_row
            join pg_catalog.pg_class as relation
              on relation.oid = constraint_row.conrelid
            join pg_catalog.pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = 'public'
              and relation.relname = 'notification_delivery_log'
              and constraint_row.conname in (
                  'notification_delivery_log_attempt_no_check',
                  'notification_delivery_log_retry_link_check',
                  'notification_delivery_log_retry_of_id_fkey'
              )
              and constraint_row.convalidated
        )

    union all

    select
        'push_retry_indexes',
        pg_catalog.to_regclass('public.notification_delivery_log_dispatch_once_idx') is not null
        and pg_catalog.to_regclass('public.notification_delivery_log_retry_once_idx') is not null
        and pg_catalog.to_regclass('public.notification_delivery_log_retry_candidates_idx') is not null

    union all

    select
        'push_retry_function_security',
        exists (
            select 1
            from pg_catalog.pg_proc as function_row
            join pg_catalog.pg_namespace as namespace
              on namespace.oid = function_row.pronamespace
            where namespace.nspname = 'public'
              and function_row.proname = 'claim_notification_delivery_retry'
              and pg_catalog.pg_get_function_identity_arguments(function_row.oid) = 'p_delivery_id bigint, p_receipt_token_hash text'
              and not function_row.prosecdef
              and pg_catalog.has_function_privilege(
                  'service_role',
                  function_row.oid,
                  'EXECUTE'
              )
              and not pg_catalog.has_function_privilege(
                  'anon',
                  function_row.oid,
                  'EXECUTE'
              )
              and not pg_catalog.has_function_privilege(
                  'authenticated',
                  function_row.oid,
                  'EXECUTE'
              )
        )

    union all

    select
        'push_retry_data_invariants',
        not exists (
            select 1
            from public.notification_delivery_log as delivery
            where delivery.attempt_no not in (1, 2)
               or (delivery.attempt_no = 1 and delivery.retry_of_id is not null)
               or (delivery.attempt_no = 2 and delivery.retry_of_id is null)
        )
        and not exists (
            select retry_of_id
            from public.notification_delivery_log
            where retry_of_id is not null
            group by retry_of_id
            having count(*) > 1
        )
)
select check_name, ok
from checks
order by check_name;
