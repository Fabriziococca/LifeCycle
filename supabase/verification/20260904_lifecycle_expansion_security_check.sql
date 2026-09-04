-- Read-only production verification for subscriptions and the transcription pipeline.
with checks as (
    select
        'subscription_sync_and_limit'::text as check_name,
        exists (
            select 1
            from pg_catalog.pg_proc as procedure
            where procedure.oid = 'public.merge_user_data_keys(jsonb,text[])'::regprocedure
              and pg_catalog.pg_get_functiondef(procedure.oid) ~ '''lifecycle_subscriptions'''
        )
        and exists (
            select 1
            from private.lifecycle_resource_limits as resource_limit
            where resource_limit.access_tier = 'friend'
              and resource_limit.resource_key = 'subscriptions'
              and resource_limit.limit_value = 500
              and resource_limit.limit_unit = 'count'
        )
        and exists (
            select 1
            from pg_catalog.pg_trigger as trigger
            where trigger.tgrelid = 'public.user_data'::regclass
              and trigger.tgname = 'user_data_subscription_limit_before_write'
              and not trigger.tgisinternal
        )
        and not pg_catalog.has_function_privilege(
            'authenticated',
            'private.enforce_lifecycle_subscription_limit()',
            'execute'
        ) as ok

    union all

    select
        'subscription_expense_rpc_security',
        procedure.prosecdef
        and procedure.proconfig @> array['search_path=pg_catalog, pg_temp']
        and pg_catalog.pg_get_functiondef(procedure.oid) ~ 'for update'
        and pg_catalog.pg_get_functiondef(procedure.oid) ~ 'subscriptionOccurrenceKey'
        and pg_catalog.has_function_privilege('authenticated', procedure.oid, 'execute')
        and not pg_catalog.has_function_privilege('anon', procedure.oid, 'execute')
        and not pg_catalog.has_function_privilege('service_role', procedure.oid, 'execute')
    from pg_catalog.pg_proc as procedure
    where procedure.oid = (
        'public.record_subscription_expense(text,text,numeric,date,text,text,boolean)'
    )::regprocedure

    union all

    select
        'transcription_rls',
        count(*) = 6
        and pg_catalog.bool_and(relation.relrowsecurity)
        and pg_catalog.bool_and(relation.relforcerowsecurity)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
          'transcription_folders',
          'transcription_sessions',
          'transcription_chunks',
          'transcription_jobs',
          'transcription_provider_attempts',
          'transcription_documents'
      )

    union all

    select
        'transcription_client_privileges',
        pg_catalog.has_table_privilege(
            'authenticated', 'public.transcription_folders', 'select,insert,update,delete'
        )
        and pg_catalog.has_table_privilege(
            'authenticated', 'public.transcription_sessions', 'select,insert,update,delete'
        )
        and pg_catalog.has_table_privilege(
            'authenticated', 'public.transcription_chunks', 'select,insert,update,delete'
        )
        and pg_catalog.has_table_privilege(
            'authenticated', 'public.transcription_documents', 'select,update,delete'
        )
        and not pg_catalog.has_table_privilege(
            'authenticated', 'public.transcription_documents', 'insert'
        )
        and not pg_catalog.has_table_privilege(
            'authenticated', 'public.transcription_jobs', 'select,insert,update,delete'
        )
        and not pg_catalog.has_table_privilege(
            'authenticated', 'public.transcription_provider_attempts', 'select,insert,update,delete'
        )
        and not pg_catalog.has_table_privilege(
            'anon', 'public.transcription_sessions', 'select,insert,update,delete'
        )

    union all

    select
        'transcription_rpc_security',
        (
            select count(*) = 2
                   and pg_catalog.bool_and(procedure.prosecdef)
                   and pg_catalog.bool_and(
                       procedure.proconfig @> array['search_path=pg_catalog, pg_temp']
                   )
                   and pg_catalog.bool_and(
                       pg_catalog.has_function_privilege('authenticated', procedure.oid, 'execute')
                   )
                   and pg_catalog.bool_and(
                       not pg_catalog.has_function_privilege('anon', procedure.oid, 'execute')
                   )
                   and pg_catalog.bool_and(
                       not pg_catalog.has_function_privilege('service_role', procedure.oid, 'execute')
                   )
            from pg_catalog.pg_proc as procedure
            where procedure.oid in (
                'public.enqueue_transcription_session(uuid)'::regprocedure,
                'public.enqueue_transcription_artifact(uuid,text)'::regprocedure
            )
        )
        and (
            select count(*) = 6
                   and pg_catalog.bool_and(procedure.prosecdef)
                   and pg_catalog.bool_and(
                       procedure.proconfig @> array['search_path=pg_catalog, pg_temp']
                   )
                   and pg_catalog.bool_and(
                       pg_catalog.has_function_privilege('service_role', procedure.oid, 'execute')
                   )
                   and pg_catalog.bool_and(
                       not pg_catalog.has_function_privilege('authenticated', procedure.oid, 'execute')
                   )
                   and pg_catalog.bool_and(
                       not pg_catalog.has_function_privilege('anon', procedure.oid, 'execute')
                   )
            from pg_catalog.pg_proc as procedure
            where procedure.oid in (
                'public.reserve_transcription_provider_attempt(uuid,integer)'::regprocedure,
                'public.claim_transcription_job(text)'::regprocedure,
                'public.complete_transcription_prepare_job(uuid,jsonb)'::regprocedure,
                'public.complete_transcription_chunk_job(uuid,text,text)'::regprocedure,
                'public.complete_transcription_artifact_job(uuid,text)'::regprocedure,
                'public.fail_transcription_job(uuid,text,timestamptz,text,text)'::regprocedure
            )
        )

    union all

    select
        'transcription_relationship_constraints',
        count(*) = 7 and pg_catalog.bool_and(constraint_row.convalidated)
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conname in (
        'transcription_sessions_folder_owner_fkey',
        'transcription_chunks_session_owner_fkey',
        'transcription_jobs_session_owner_fkey',
        'transcription_jobs_chunk_owner_fkey',
        'transcription_provider_attempts_job_owner_fkey',
        'transcription_documents_session_owner_fkey',
        'transcription_chunks_storage_path_unique'
    )

    union all

    select
        'transcription_indexes',
        count(*) = 12
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'i'
      and relation.relname in (
          'transcription_folders_user_idx',
          'transcription_sessions_user_idx',
          'transcription_sessions_folder_idx',
          'transcription_sessions_cleanup_idx',
          'transcription_chunks_session_idx',
          'transcription_chunks_user_idx',
          'transcription_jobs_queue_idx',
          'transcription_jobs_session_idx',
          'transcription_jobs_chunk_idx',
          'transcription_jobs_user_idx',
          'transcription_provider_attempts_daily_idx',
          'transcription_documents_user_idx'
      )

    union all

    select
        'transcription_storage_bucket',
        bucket.public = false
        and bucket.file_size_limit = 52428800
        and bucket.allowed_mime_types @> array[
            'audio/mp4', 'audio/webm', 'video/mp4', 'video/webm'
        ]::text[]
    from storage.buckets as bucket
    where bucket.id = 'transcription-audio'

    union all

    select
        'transcription_storage_policies',
        count(*) = 4
        and pg_catalog.bool_and(policy.roles = array['authenticated']::name[])
        and pg_catalog.bool_and(
            coalesce(policy.qual, '') || coalesce(policy.with_check, '')
                ~ 'transcription_sessions'
        )
        and pg_catalog.bool_and(
            coalesce(policy.qual, '') || coalesce(policy.with_check, '')
                ~ 'foldername'
        )
        and pg_catalog.bool_and(
            coalesce(policy.qual, '') || coalesce(policy.with_check, '')
                ~ 'is_lifecycle_owner'
        )
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname in (
          'transcription_audio_owner_select',
          'transcription_audio_owner_insert',
          'transcription_audio_owner_update',
          'transcription_audio_owner_delete'
      )

    union all

    select
        'transcription_data_invariants',
        not exists (
            select 1
            from public.transcription_sessions as session
            join public.transcription_folders as folder on folder.id = session.folder_id
            where folder.user_id <> session.user_id
        )
        and not exists (
            select 1
            from public.transcription_chunks as chunk
            join public.transcription_sessions as session on session.id = chunk.session_id
            where session.user_id <> chunk.user_id
               or chunk.storage_path not like
                  chunk.user_id::text || '/' || chunk.session_id::text || '/%'
        )
        and not exists (
            select 1
            from public.transcription_jobs as job
            join public.transcription_sessions as session on session.id = job.session_id
            left join public.transcription_chunks as chunk on chunk.id = job.chunk_id
            where session.user_id <> job.user_id
               or (job.chunk_id is not null and chunk.user_id <> job.user_id)
        )
        and not exists (
            select 1
            from public.transcription_provider_attempts as attempt
            join public.transcription_jobs as job on job.id = attempt.job_id
            where job.user_id <> attempt.user_id
        )
        and not exists (
            select 1
            from public.transcription_documents as document
            join public.transcription_sessions as session on session.id = document.session_id
            where session.user_id <> document.user_id
        )

    union all

    select
        'transcription_storage_metadata',
        not exists (
            select 1
            from storage.objects as object
            where object.bucket_id = 'transcription-audio'
              and not exists (
                  select 1
                  from public.transcription_sessions as session
                  where session.user_id::text = (storage.foldername(object.name))[1]
                    and session.id::text = (storage.foldername(object.name))[2]
              )
        )

    union all

    select
        'owner_profile_cardinality',
        count(*) = 1
    from private.lifecycle_access_profiles
    where access_tier = 'owner'
)
select check_name, ok
from checks
order by check_name;
