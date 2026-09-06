-- Transactional acceptance test. Nothing is committed and no real audio is
-- uploaded. Refuse to run if the transcription queue already contains work.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $checks$
declare
    v_owner uuid;
    v_friend uuid;
    v_folder uuid := gen_random_uuid();
    v_session uuid := gen_random_uuid();
    v_chunk uuid := gen_random_uuid();
    v_job jsonb;
    v_job_id uuid;
    v_result jsonb;
    v_count integer;
    v_attempts integer;
    v_waits integer;
    v_denied boolean;
    v_iteration integer;
    v_expense_key text := 'qa_rollback_' || gen_random_uuid()::text;
begin
    if exists (select 1 from public.transcription_jobs) then
        raise exception 'Behavior check requires an empty transcription queue; do not interrupt real jobs';
    end if;
    select user_id into strict v_owner from private.lifecycle_access_profiles where access_tier = 'owner';
    select account.id into strict v_friend from auth.users as account
    where account.id <> v_owner order by account.id limit 1;

    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    set local role authenticated;
    insert into public.transcription_folders (id, user_id, name)
    values (v_folder, v_owner, 'QA rollback ' || v_folder::text);
    insert into public.transcription_sessions (
        id, user_id, folder_id, title, source_type, status, expected_chunks, duration_ms, total_bytes
    ) values (v_session, v_owner, v_folder, 'QA rollback', 'recording', 'uploaded', 1, 1000, 100);
    insert into public.transcription_chunks (
        id, session_id, user_id, sequence_number, storage_path, mime_type, byte_size, duration_ms, status
    ) values (
        v_chunk, v_session, v_owner, 0, v_owner::text || '/' || v_session::text || '/qa.aac',
        'audio/aac', 100, 1000, 'uploaded'
    );
    if public.enqueue_transcription_session(v_session) <> 1 then raise exception 'Enqueue failed'; end if;
    v_result := public.record_subscription_expense(v_expense_key, 'QA rollback', 1, current_date, v_expense_key, 'Prueba', false);
    if (v_result->>'created')::boolean is distinct from true then raise exception 'Expense insert failed'; end if;
    v_result := public.record_subscription_expense(v_expense_key, 'QA rollback', 1, current_date, v_expense_key, 'Prueba', false);
    if (v_result->>'duplicate')::boolean is distinct from true then raise exception 'Expense duplicated'; end if;

    reset role;
    perform set_config('request.jwt.claim.sub', v_friend::text, true);
    set local role authenticated;
    select count(*) into v_count from public.transcription_sessions where id = v_session;
    if v_count <> 0 then raise exception 'Cross-account read was allowed'; end if;
    v_denied := false;
    begin
        insert into public.transcription_folders (user_id, name) values (v_friend, 'QA must be denied');
    exception when insufficient_privilege then v_denied := true;
    end;
    if not v_denied then raise exception 'Non-owner experimental feature write was allowed'; end if;
    v_denied := false;
    begin
        perform public.enqueue_transcription_session(v_session);
    exception when insufficient_privilege then v_denied := true;
    end;
    if not v_denied then raise exception 'Cross-account enqueue was allowed'; end if;
    v_denied := false;
    begin
        perform public.claim_transcription_job('unauthorized');
    exception when insufficient_privilege then v_denied := true;
    end;
    if not v_denied then raise exception 'Authenticated client claimed a backend job'; end if;

    reset role;
    set local role service_role;
    v_job := public.claim_transcription_job('qa-rollback-worker');
    v_job_id := (v_job->>'id')::uuid;
    if v_job_id is null or (v_job->>'chunk_id')::uuid <> v_chunk then raise exception 'Claim failed'; end if;
    insert into public.transcription_jobs (session_id, user_id, job_type)
    values (v_session, v_owner, 'summary');
    for v_iteration in 1..5 loop
        perform public.fail_transcription_job(v_job_id, 'waiting_quota', now() + interval '1 hour', '429', 'QA quota', 'qa-rollback-worker');
        select attempts, quota_waits into v_attempts, v_waits from public.transcription_jobs where id = v_job_id;
        if v_attempts <> 0 or v_waits <> v_iteration then raise exception 'Quota consumed retry attempts'; end if;
        if public.claim_transcription_job('qa-rollback-worker') is not null then raise exception 'Other provider jobs ignored the quota pause'; end if;
        if exists (select 1 from public.transcription_sessions where id = v_session and audio_delete_after is not null) then
            raise exception 'Waiting audio was scheduled for deletion';
        end if;
        update public.transcription_jobs set available_at = now() - interval '1 hour' where id = v_job_id;
        v_job := public.claim_transcription_job('qa-rollback-worker');
        if (v_job->>'id')::uuid is distinct from v_job_id then raise exception 'Quota did not resume'; end if;
    end loop;
    if public.fail_transcription_job(v_job_id, 'failed', now(), 'stale', 'QA stale', 'stale-worker') then
        raise exception 'Stale worker modified a job';
    end if;
    v_denied := false;
    begin
        perform public.complete_transcription_chunk_job(v_job_id, 'Texto incorrecto', 'completed', 'stale-worker');
    exception when object_not_in_prerequisite_state then v_denied := true;
    end;
    if not v_denied then raise exception 'Stale worker completed a job'; end if;
    perform public.complete_transcription_chunk_job(v_job_id, 'Transcripción completa de prueba.', 'completed', 'qa-rollback-worker');
    if not exists (
        select 1 from public.transcription_sessions as session
        join public.transcription_documents as document on document.session_id = session.id and document.kind = 'transcript'
        where session.id = v_session and session.status = 'completed'
          and document.content = 'Transcripción completa de prueba.'
          and session.audio_delete_after = now() + interval '24 hours'
    ) then raise exception 'Final document or retention is incorrect'; end if;
    reset role;
end;
$checks$;

rollback;
select true as two_account_isolation, true as client_permissions,
       true as expense_idempotency, true as quota_pause_resume,
       true as project_cooldown, true as worker_lease_guard,
       true as transcript_and_retention, true as all_test_writes_rolled_back;
