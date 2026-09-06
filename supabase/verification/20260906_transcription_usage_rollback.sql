-- Real SQL behavior test; only generated fixtures are touched, then rolled back.
-- No audio, real account changes, provider calls or preexisting jobs are used.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $checks$
declare
    v_owner uuid;
    v_friend uuid;
    v_session_a uuid := gen_random_uuid();
    v_session_b uuid := gen_random_uuid();
    v_job_a uuid := gen_random_uuid();
    v_job_b uuid := gen_random_uuid();
    v_attempt bigint;
    v_before integer;
    v_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    v_denied boolean;
begin
    select user_id into strict v_owner from private.lifecycle_access_profiles where access_tier = 'owner';
    select id into strict v_friend from auth.users where id <> v_owner order by id limit 1;
    perform pg_advisory_xact_lock(hashtextextended('lifecycle-transcription-provider-daily', 0));
    select count(*) into v_before from public.transcription_provider_attempts where started_at >= v_day_start;
    if v_before >= 999 then raise exception 'Daily usage too high for isolated quota test'; end if;

    insert into public.transcription_sessions (id, user_id, title, status)
    values (v_session_a, v_owner, 'QA usage rollback A', 'uploaded'),
           (v_session_b, v_owner, 'QA usage rollback B', 'uploaded');
    insert into public.transcription_jobs (id, session_id, user_id, job_type, status, locked_at, locked_by)
    values (v_job_a, v_session_a, v_owner, 'summary', 'processing', now(), 'qa-usage-rollback'),
           (v_job_b, v_session_b, v_owner, 'summary', 'processing', now(), 'qa-usage-rollback');

    set local role service_role;
    if public.reserve_transcription_provider_attempt(v_job_a, v_before + 1) is distinct from true then
        raise exception 'First provider attempt was unexpectedly refused';
    end if;
    select id into strict v_attempt from public.transcription_provider_attempts where job_id = v_job_a;
    reset role;

    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    set local role authenticated;
    delete from public.transcription_sessions where id = v_session_a;
    v_denied := false;
    begin
        delete from public.transcription_provider_attempts where id = v_attempt;
    exception when insufficient_privilege then v_denied := true;
    end;
    if not v_denied then raise exception 'Client can manipulate the private usage ledger'; end if;
    reset role;

    if exists (select 1 from public.transcription_jobs where id = v_job_a) then
        raise exception 'Session deletion did not clean its job';
    end if;
    if not exists (
        select 1 from public.transcription_provider_attempts
        where id = v_attempt and job_id is null and user_id = v_owner and operation = 'summary'
    ) then raise exception 'Deleting content lost the private usage record or owner'; end if;
    if (select count(*) from public.transcription_provider_attempts where started_at >= v_day_start) <> v_before + 1 then
        raise exception 'Deleting a session refunded daily usage';
    end if;

    set local role service_role;
    if public.reserve_transcription_provider_attempt(v_job_b, v_before + 1) is distinct from false then
        raise exception 'Content deletion bypassed the daily safety limit';
    end if;
    reset role;
    v_denied := false;
    begin
        insert into public.transcription_provider_attempts (job_id, user_id, operation)
        values (v_job_b, v_friend, 'summary');
    exception when foreign_key_violation then v_denied := true;
    end;
    if not v_denied then raise exception 'A remaining job accepted another account in its usage record'; end if;
end;
$checks$;

rollback;
select true as content_deletion_keeps_usage, true as daily_limit_cannot_be_refunded,
       true as ledger_remains_private, true as composite_owner_fk_preserved,
       true as all_test_writes_rolled_back;
