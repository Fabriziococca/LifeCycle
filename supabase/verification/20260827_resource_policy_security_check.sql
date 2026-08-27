-- Read-only verification for the private LifeCycle access policy.

select
    'private_policy_tables' as check_name,
    count(*) = 2
        and bool_and(classes.relrowsecurity)
        and bool_and(classes.relforcerowsecurity) as passed
from pg_catalog.pg_class as classes
join pg_catalog.pg_namespace as namespaces
  on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'private'
  and classes.relname in (
      'lifecycle_access_profiles',
      'lifecycle_resource_limits'
  );

select
    'private_policy_client_privileges' as check_name,
    not has_table_privilege(
        'authenticated',
        'private.lifecycle_access_profiles',
        'select,insert,update,delete'
    )
    and not has_table_privilege(
        'authenticated',
        'private.lifecycle_resource_limits',
        'select,insert,update,delete'
    ) as passed;

select
    'effective_policy_rpc' as check_name,
    procedures.prosecdef
    and procedures.pronargs = 0
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and has_function_privilege(
        'authenticated',
        'public.get_my_resource_policy()',
        'execute'
    )
    and not has_function_privilege(
        'anon',
        'public.get_my_resource_policy()',
        'execute'
    ) as passed
from pg_catalog.pg_proc as procedures
where procedures.oid = 'public.get_my_resource_policy()'::regprocedure;

select
    'isolated_sync_rpc' as check_name,
    procedures.prosecdef
    and procedures.pronargs = 2
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and pg_get_functiondef(procedures.oid) ~ 'auth\.uid\(\)'
    and pg_get_functiondef(procedures.oid) !~ 'p_user_id'
    and has_function_privilege(
        'authenticated',
        'public.merge_user_data_keys(jsonb,text[])',
        'execute'
    ) as passed
from pg_catalog.pg_proc as procedures
where procedures.oid = 'public.merge_user_data_keys(jsonb,text[])'::regprocedure;

select
    'document_limit_trigger' as check_name,
    count(*) = 1 as passed
from pg_catalog.pg_trigger as triggers
where triggers.tgrelid = 'public.user_data'::regclass
  and triggers.tgname = 'user_data_enforce_resource_policy_before_write'
  and not triggers.tgisinternal;

select
    'owner_profile_cardinality' as check_name,
    count(*) = 1 as passed
from private.lifecycle_access_profiles
where access_tier = 'owner';
