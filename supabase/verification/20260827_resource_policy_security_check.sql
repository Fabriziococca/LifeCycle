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
    'tracker_resource_limits' as check_name,
    procedures.prosecdef
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and pg_get_functiondef(procedures.oid) ~ '''custom_modules'''
    and pg_get_functiondef(procedures.oid) ~ '''tracker_cards'''
    and pg_get_functiondef(procedures.oid) ~ '''reminders'''
    and pg_get_functiondef(procedures.oid) ~ 'hygiene_tracker_data'
    and pg_get_functiondef(procedures.oid) ~ 'alerts_config'
    and not has_function_privilege(
        'authenticated',
        'private.enforce_lifecycle_user_document_limit()',
        'execute'
    ) as passed
from pg_catalog.pg_proc as procedures
where procedures.oid = 'private.enforce_lifecycle_user_document_limit()'::regprocedure;

select
    'all_resource_limits' as check_name,
    procedures.prosecdef
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and pg_get_functiondef(procedures.oid) ~ 'resource_key=synced_document_bytes'
    and pg_get_functiondef(procedures.oid) ~ '''tasks'''
    and pg_get_functiondef(procedures.oid) ~ '''projects'''
    and pg_get_functiondef(procedures.oid) ~ '''project_templates'''
    and pg_get_functiondef(procedures.oid) ~ '''finance_transactions'''
    and pg_get_functiondef(procedures.oid) ~ '''finance_recurring_rules'''
    and pg_get_functiondef(procedures.oid) ~ '''trading_events'''
    and pg_get_functiondef(procedures.oid) ~ '''gym_routine_exercises'''
    and pg_get_functiondef(procedures.oid) ~ '''gym_meal_templates'''
    and pg_get_functiondef(procedures.oid) ~ '''gym_supplements'''
    and pg_get_functiondef(procedures.oid) ~ '''vehicle_issues'''
    and pg_get_functiondef(procedures.oid) ~ '''blood_test_files'''
    and not has_function_privilege(
        'authenticated',
        'private.enforce_lifecycle_user_document_limit()',
        'execute'
    ) as passed
from pg_catalog.pg_proc as procedures
where procedures.oid = 'private.enforce_lifecycle_user_document_limit()'::regprocedure;

select
    'medical_storage_limits' as check_name,
    buckets.public = false
    and buckets.file_size_limit = 15728640
    and procedures.prosecdef
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and pg_get_functiondef(procedures.oid) ~ 'auth\.uid\(\)'
    and pg_get_functiondef(procedures.oid) ~ 'blood_test_files'
    and has_function_privilege(
        'authenticated',
        'public.can_upload_lifecycle_medical_file(text)',
        'execute'
    )
    and not has_function_privilege(
        'anon',
        'public.can_upload_lifecycle_medical_file(text)',
        'execute'
    ) as passed
from storage.buckets as buckets
cross join pg_catalog.pg_proc as procedures
where buckets.id = 'blood-tests'
  and procedures.oid = 'public.can_upload_lifecycle_medical_file(text)'::regprocedure;

select
    'medical_storage_insert_policy' as check_name,
    count(*) = 1
    and bool_and(policies.roles = array['authenticated']::name[])
    and bool_and(policies.with_check ~ 'can_upload_lifecycle_medical_file') as passed
from pg_catalog.pg_policies as policies
where policies.schemaname = 'storage'
  and policies.tablename = 'objects'
  and policies.policyname = 'Users can insert their own blood tests';

select
    'push_device_limit' as check_name,
    procedures.prosecdef
    and procedures.proconfig @> array['search_path=pg_catalog, pg_temp']
    and pg_get_functiondef(procedures.oid) ~ 'v_limit constant bigint := 20'
    and pg_get_functiondef(procedures.oid) ~ 'pg_advisory_xact_lock'
    and not has_function_privilege(
        'authenticated',
        'private.enforce_lifecycle_push_subscription_limit()',
        'execute'
    )
    and exists (
        select 1
        from pg_catalog.pg_trigger as triggers
        where triggers.tgrelid = 'public.push_subscriptions'::regclass
          and triggers.tgname = 'push_subscriptions_enforce_user_limit_before_insert'
          and not triggers.tgisinternal
    ) as passed
from pg_catalog.pg_proc as procedures
where procedures.oid = 'private.enforce_lifecycle_push_subscription_limit()'::regprocedure;

select
    'owner_profile_cardinality' as check_name,
    count(*) = 1 as passed
from private.lifecycle_access_profiles
where access_tier = 'owner';
