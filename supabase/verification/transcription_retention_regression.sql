-- Synthetic metadata only. No Storage objects, jobs or provider calls.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
do $$
declare
    v_owner uuid;
    v_session uuid;
    v_status text;
    v_deadline timestamptz;
    v_completed timestamptz := '2026-09-13T12:00:00Z';
begin
    select user_id into strict v_owner from private.lifecycle_access_profiles where access_tier = 'owner' limit 1;
    insert into public.transcription_sessions(user_id, title, status, audio_delete_after)
    values(v_owner, 'Transactional retention regression', 'draft', now()) returning id into v_session;
    foreach v_status in array array['draft','recording','uploading','uploaded','queued','processing','partial','failed','canceled','completed'] loop
        update public.transcription_sessions set status = v_status, completed_at = null, audio_delete_after = now()
        where id = v_session returning audio_delete_after into v_deadline;
        if v_deadline is not null then raise exception 'Unfinished audio can expire: %', v_status; end if;
    end loop;
    update public.transcription_sessions set completed_at = v_completed, audio_delete_after = now() + interval '7 days'
    where id = v_session returning audio_delete_after into v_deadline;
    if v_deadline is distinct from v_completed + interval '24 hours' then
        raise exception 'Completed retention is not exactly 24 hours';
    end if;
    update public.transcription_sessions set status = 'processing' where id = v_session
    returning audio_delete_after into v_deadline;
    if v_deadline is not null then raise exception 'Retry did not clear retention deadline'; end if;
    if has_function_privilege('anon', 'private.enforce_transcription_audio_retention()', 'execute')
        or has_function_privilege('authenticated', 'private.enforce_transcription_audio_retention()', 'execute') then
        raise exception 'Retention trigger exposed as callable function';
    end if;
end $$;
rollback;
select 'transcription retention regression passed; all fixtures rolled back' as result;
