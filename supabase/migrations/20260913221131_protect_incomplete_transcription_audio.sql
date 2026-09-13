-- Retain the only recoverable audio until a complete transcript is durable.
-- Older workers also filter on this deadline, so null protects unfinished jobs.
set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function private.enforce_transcription_audio_retention()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
    if new.status = 'completed' and new.completed_at is not null then
        new.audio_delete_after := new.completed_at + interval '24 hours';
    else
        new.audio_delete_after := null;
    end if;
    return new;
end;
$$;
revoke all on function private.enforce_transcription_audio_retention()
from public, anon, authenticated, service_role;

create trigger transcription_audio_retention_guard
before insert or update of status, completed_at, audio_delete_after
on public.transcription_sessions
for each row execute function private.enforce_transcription_audio_retention();

-- Metadata-only correction. No audio or transcript is deleted or overwritten.
update public.transcription_sessions
set audio_delete_after = null
where status <> 'completed' and audio_delete_after is not null;
