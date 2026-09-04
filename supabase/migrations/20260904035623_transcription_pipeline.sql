-- Phases D/E: owner-only, persistent transcription pipeline. Source media and audio are kept in
-- a private Storage bucket; the synchronized user document never contains
-- binary audio or long transcripts.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function private.is_lifecycle_owner(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
    select p_user_id is not null and exists (
        select 1
        from private.lifecycle_access_profiles as profile
        where profile.user_id = p_user_id
          and profile.access_tier = 'owner'
    );
$$;

revoke all on function private.is_lifecycle_owner(uuid)
from public, anon;
grant execute on function private.is_lifecycle_owner(uuid)
to authenticated, service_role;

create table if not exists public.transcription_folders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint transcription_folders_name_check
        check (char_length(btrim(name)) between 1 and 120),
    constraint transcription_folders_user_name_unique unique (user_id, name),
    constraint transcription_folders_id_user_unique unique (id, user_id)
);

create table if not exists public.transcription_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    folder_id uuid,
    title text not null default 'Transcripción sin título',
    source_type text not null default 'recording',
    status text not null default 'draft',
    language text not null default 'es-AR',
    context text not null default '',
    auto_process boolean not null default true,
    mime_type text,
    duration_ms bigint not null default 0,
    total_bytes bigint not null default 0,
    expected_chunks integer not null default 0,
    completed_chunks integer not null default 0,
    error_code text,
    error_message text,
    audio_delete_after timestamptz,
    audio_deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint transcription_sessions_title_check
        check (char_length(btrim(title)) between 1 and 160),
    constraint transcription_sessions_source_check
        check (source_type in ('recording', 'import')),
    constraint transcription_sessions_status_check
        check (status in (
            'draft', 'recording', 'uploading', 'uploaded', 'queued',
            'processing', 'completed', 'partial', 'failed', 'canceled'
        )),
    constraint transcription_sessions_language_check
        check (language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
    constraint transcription_sessions_context_check
        check (char_length(context) <= 2000),
    constraint transcription_sessions_duration_check
        check (duration_ms between 0 and 10800000),
    constraint transcription_sessions_bytes_check
        check (total_bytes between 0 and 268435456),
    constraint transcription_sessions_chunks_check
        check (
            expected_chunks between 0 and 60
            and completed_chunks between 0 and expected_chunks
        ),
    constraint transcription_sessions_id_user_unique unique (id, user_id),
    constraint transcription_sessions_folder_owner_fkey
        foreign key (folder_id, user_id)
        references public.transcription_folders(id, user_id)
        on delete set null (folder_id)
);

create table if not exists public.transcription_chunks (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    sequence_number integer not null,
    storage_path text not null,
    mime_type text not null,
    media_role text not null default 'recorded',
    byte_size bigint not null,
    duration_ms bigint not null default 0,
    sha256 text,
    status text not null default 'uploaded',
    transcript_text text,
    finish_reason text,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint transcription_chunks_sequence_check
        check (
            sequence_number between 0 and 59
            or (sequence_number = -1 and media_role = 'import_source')
        ),
    constraint transcription_chunks_path_check
        check (
            char_length(storage_path) between 10 and 500
            and storage_path like user_id::text || '/' || session_id::text || '/%'
        ),
    constraint transcription_chunks_mime_check
        check (mime_type in (
            'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
            'audio/wav', 'audio/aac', 'audio/flac', 'audio/aiff',
            'audio/opus', 'video/mp4', 'video/quicktime',
            'video/x-matroska', 'video/webm', 'video/mpeg', 'video/x-m4v'
        )),
    constraint transcription_chunks_media_role_check
        check (media_role in ('recorded', 'import_source', 'prepared')),
    constraint transcription_chunks_size_check
        check (byte_size between 1 and 52428800),
    constraint transcription_chunks_duration_check
        check (duration_ms between 0 and 10800000),
    constraint transcription_chunks_sha_check
        check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
    constraint transcription_chunks_status_check
        check (status in ('uploaded', 'queued', 'processing', 'completed', 'failed', 'deleted')),
    constraint transcription_chunks_transcript_size_check
        check (transcript_text is null or octet_length(transcript_text) <= 2097152),
    constraint transcription_chunks_session_sequence_unique unique (session_id, sequence_number),
    constraint transcription_chunks_storage_path_unique unique (storage_path),
    constraint transcription_chunks_id_user_unique unique (id, user_id),
    constraint transcription_chunks_session_owner_fkey
        foreign key (session_id, user_id)
        references public.transcription_sessions(id, user_id)
        on delete cascade
);

create table if not exists public.transcription_jobs (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null,
    chunk_id uuid,
    user_id uuid not null references auth.users(id) on delete cascade,
    job_type text not null default 'transcribe',
    status text not null default 'queued',
    attempts integer not null default 0,
    max_attempts integer not null default 3,
    available_at timestamptz not null default now(),
    locked_at timestamptz,
    locked_by text,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint transcription_jobs_type_check
        check (job_type in ('prepare', 'transcribe', 'summary', 'notes')),
    constraint transcription_jobs_status_check
        check (status in ('queued', 'processing', 'waiting_quota', 'completed', 'failed', 'canceled')),
    constraint transcription_jobs_attempts_check
        check (attempts between 0 and 10 and max_attempts between 1 and 10),
    constraint transcription_jobs_lock_check
        check (locked_by is null or char_length(locked_by) <= 120),
    constraint transcription_jobs_error_check
        check (error_message is null or char_length(error_message) <= 2000),
    constraint transcription_jobs_chunk_kind_check
        check (
            (job_type in ('prepare', 'transcribe') and chunk_id is not null)
            or (job_type in ('summary', 'notes') and chunk_id is null)
        ),
    constraint transcription_jobs_unique
        unique nulls not distinct (session_id, chunk_id, job_type),
    constraint transcription_jobs_id_user_unique unique (id, user_id),
    constraint transcription_jobs_session_owner_fkey
        foreign key (session_id, user_id)
        references public.transcription_sessions(id, user_id)
        on delete cascade,
    constraint transcription_jobs_chunk_owner_fkey
        foreign key (chunk_id, user_id)
        references public.transcription_chunks(id, user_id)
        on delete cascade
);

-- One row represents one provider generation attempt. Keeping this ledger
-- separate from job retries makes the daily safety limit exact and durable.
create table if not exists public.transcription_provider_attempts (
    id bigint generated always as identity primary key,
    job_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    operation text not null,
    started_at timestamptz not null default now(),
    constraint transcription_provider_attempts_operation_check
        check (operation in ('transcribe', 'summary', 'notes')),
    constraint transcription_provider_attempts_job_owner_fkey
        foreign key (job_id, user_id)
        references public.transcription_jobs(id, user_id)
        on delete cascade
);

create table if not exists public.transcription_documents (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    kind text not null,
    content text not null default '',
    source_revision integer not null default 1,
    user_edited boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint transcription_documents_kind_check
        check (kind in ('transcript', 'summary', 'notes')),
    constraint transcription_documents_content_size_check
        check (octet_length(content) <= 10485760),
    constraint transcription_documents_revision_check
        check (source_revision > 0),
    constraint transcription_documents_session_kind_unique unique (session_id, kind),
    constraint transcription_documents_session_owner_fkey
        foreign key (session_id, user_id)
        references public.transcription_sessions(id, user_id)
        on delete cascade
);

create index if not exists transcription_folders_user_idx
on public.transcription_folders (user_id, updated_at desc);
create index if not exists transcription_sessions_user_idx
on public.transcription_sessions (user_id, created_at desc);
create index if not exists transcription_sessions_folder_idx
on public.transcription_sessions (folder_id)
where folder_id is not null;
create index if not exists transcription_sessions_cleanup_idx
on public.transcription_sessions (audio_delete_after)
where audio_deleted_at is null and audio_delete_after is not null;
create index if not exists transcription_chunks_session_idx
on public.transcription_chunks (session_id, sequence_number);
create index if not exists transcription_chunks_user_idx
on public.transcription_chunks (user_id);
create index if not exists transcription_jobs_queue_idx
on public.transcription_jobs (status, available_at, created_at)
where status in ('queued', 'waiting_quota', 'processing');
create index if not exists transcription_jobs_session_idx
on public.transcription_jobs (session_id);
create index if not exists transcription_jobs_chunk_idx
on public.transcription_jobs (chunk_id)
where chunk_id is not null;
create index if not exists transcription_jobs_user_idx
on public.transcription_jobs (user_id);
create index if not exists transcription_provider_attempts_daily_idx
on public.transcription_provider_attempts (started_at desc);
create index if not exists transcription_provider_attempts_job_idx
on public.transcription_provider_attempts (job_id);
create index if not exists transcription_provider_attempts_user_idx
on public.transcription_provider_attempts (user_id);
create index if not exists transcription_documents_user_idx
on public.transcription_documents (user_id, updated_at desc);

alter table public.transcription_folders enable row level security;
alter table public.transcription_folders force row level security;
alter table public.transcription_sessions enable row level security;
alter table public.transcription_sessions force row level security;
alter table public.transcription_chunks enable row level security;
alter table public.transcription_chunks force row level security;
alter table public.transcription_jobs enable row level security;
alter table public.transcription_jobs force row level security;
alter table public.transcription_provider_attempts enable row level security;
alter table public.transcription_provider_attempts force row level security;
alter table public.transcription_documents enable row level security;
alter table public.transcription_documents force row level security;

revoke all on table public.transcription_folders from public, anon, authenticated, service_role;
revoke all on table public.transcription_sessions from public, anon, authenticated, service_role;
revoke all on table public.transcription_chunks from public, anon, authenticated, service_role;
revoke all on table public.transcription_jobs from public, anon, authenticated, service_role;
revoke all on table public.transcription_provider_attempts from public, anon, authenticated, service_role;
revoke all on table public.transcription_documents from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.transcription_folders to authenticated;
grant select, insert, update, delete on table public.transcription_sessions to authenticated;
grant select, insert, update, delete on table public.transcription_chunks to authenticated;
grant select, update, delete on table public.transcription_documents to authenticated;
grant select, insert, update, delete on table public.transcription_folders to service_role;
grant select, insert, update, delete on table public.transcription_sessions to service_role;
grant select, insert, update, delete on table public.transcription_chunks to service_role;
grant select, insert, update, delete on table public.transcription_jobs to service_role;
grant select, insert, update, delete on table public.transcription_provider_attempts to service_role;
grant usage, select on sequence public.transcription_provider_attempts_id_seq to service_role;
grant select, insert, update, delete on table public.transcription_documents to service_role;

drop policy if exists transcription_folders_owner_all on public.transcription_folders;
create policy transcription_folders_owner_all
on public.transcription_folders
for all
to authenticated
using ((select auth.uid()) = user_id and (select private.is_lifecycle_owner()))
with check ((select auth.uid()) = user_id and (select private.is_lifecycle_owner()));

drop policy if exists transcription_sessions_owner_all on public.transcription_sessions;
create policy transcription_sessions_owner_all
on public.transcription_sessions
for all
to authenticated
using ((select auth.uid()) = user_id and (select private.is_lifecycle_owner()))
with check (
    (select auth.uid()) = user_id
    and (select private.is_lifecycle_owner())
    and (
        folder_id is null
        or exists (
            select 1
            from public.transcription_folders as folder
            where folder.id = folder_id
              and folder.user_id = (select auth.uid())
        )
    )
);

drop policy if exists transcription_chunks_owner_all on public.transcription_chunks;
create policy transcription_chunks_owner_all
on public.transcription_chunks
for all
to authenticated
using ((select auth.uid()) = user_id and (select private.is_lifecycle_owner()))
with check (
    (select auth.uid()) = user_id
    and (select private.is_lifecycle_owner())
    and exists (
        select 1
        from public.transcription_sessions as session
        where session.id = session_id
          and session.user_id = (select auth.uid())
    )
);

drop policy if exists transcription_documents_owner_all on public.transcription_documents;
create policy transcription_documents_owner_all
on public.transcription_documents
for all
to authenticated
using ((select auth.uid()) = user_id and (select private.is_lifecycle_owner()))
with check (
    (select auth.uid()) = user_id
    and (select private.is_lifecycle_owner())
    and exists (
        select 1
        from public.transcription_sessions as session
        where session.id = session_id
          and session.user_id = (select auth.uid())
    )
);

-- Jobs deliberately have no authenticated policy. Only trusted backend code
-- can observe prompts, retry state and provider errors.

create or replace function private.enforce_transcription_audio_budget()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_session_count bigint;
    v_session_bytes bigint;
    v_user_bytes bigint;
begin
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

    select count(*), coalesce(sum(chunk.byte_size), 0)
    into v_session_count, v_session_bytes
    from public.transcription_chunks as chunk
    where chunk.session_id = new.session_id
      and chunk.id <> new.id
      and chunk.status <> 'deleted';

    v_session_count := v_session_count + 1;
    v_session_bytes := v_session_bytes + new.byte_size;
    if v_session_count > 60 or v_session_bytes > 268435456 then
        raise exception 'Transcription session audio limit exceeded'
            using errcode = '54000';
    end if;

    select coalesce(sum(chunk.byte_size), 0)
    into v_user_bytes
    from public.transcription_chunks as chunk
    where chunk.user_id = new.user_id
      and chunk.id <> new.id
      and chunk.status <> 'deleted';

    if v_user_bytes + new.byte_size > 786432000 then
        raise exception 'Transcription temporary storage budget exceeded'
            using
                errcode = '54000',
                hint = 'Download or process existing recordings before uploading more audio.';
    end if;

    return new;
end;
$$;

revoke all on function private.enforce_transcription_audio_budget()
from public, anon, authenticated, service_role;

drop trigger if exists transcription_chunks_budget_before_write
on public.transcription_chunks;
create trigger transcription_chunks_budget_before_write
before insert or update of byte_size, status, session_id on public.transcription_chunks
for each row
when (new.status <> 'deleted')
execute function private.enforce_transcription_audio_budget();

create or replace function public.enqueue_transcription_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_inserted integer;
begin
    if not private.is_lifecycle_owner(v_user_id) then
        raise exception 'Transcriptions are not enabled for this account'
            using errcode = '42501';
    end if;
    if not exists (
        select 1
        from public.transcription_sessions as session
        where session.id = p_session_id
          and session.user_id = v_user_id
          and session.status in ('uploaded', 'partial', 'failed')
    ) then
        raise exception 'Transcription session is not ready'
            using errcode = '22023';
    end if;
    if not exists (
        select 1
        from public.transcription_chunks as chunk
        where chunk.session_id = p_session_id
          and chunk.user_id = v_user_id
          and chunk.status in ('uploaded', 'failed')
    ) then
        raise exception 'Transcription session has no uploaded chunks'
            using errcode = '22023';
    end if;

    insert into public.transcription_jobs (
        session_id, chunk_id, user_id, job_type, status, attempts,
        available_at, error_code, error_message
    )
    select
        chunk.session_id,
        chunk.id,
        chunk.user_id,
        case when chunk.media_role = 'import_source' then 'prepare' else 'transcribe' end,
        'queued',
        0,
        now(),
        null,
        null
    from public.transcription_chunks as chunk
    where chunk.session_id = p_session_id
      and chunk.user_id = v_user_id
      and chunk.status in ('uploaded', 'failed')
    on conflict (session_id, chunk_id, job_type) do update
    set
        status = case
            when public.transcription_jobs.status in ('completed', 'queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.status
            else 'queued'
        end,
        attempts = case
            when public.transcription_jobs.status in ('completed', 'queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.attempts
            else 0
        end,
        available_at = case
            when public.transcription_jobs.status in ('completed', 'queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.available_at
            else now()
        end,
        locked_at = case when public.transcription_jobs.status = 'processing' then public.transcription_jobs.locked_at else null end,
        locked_by = case when public.transcription_jobs.status = 'processing' then public.transcription_jobs.locked_by else null end,
        error_code = case
            when public.transcription_jobs.status in ('completed', 'queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.error_code
            else null
        end,
        error_message = case
            when public.transcription_jobs.status in ('completed', 'queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.error_message
            else null
        end,
        updated_at = now();
    get diagnostics v_inserted = row_count;

    update public.transcription_sessions
    set status = 'queued',
        error_code = null,
        error_message = null,
        updated_at = now()
    where id = p_session_id
      and user_id = v_user_id;
    update public.transcription_chunks
    set status = case when status = 'completed' then status else 'queued' end,
        error_code = null,
        error_message = null,
        updated_at = now()
    where session_id = p_session_id
      and user_id = v_user_id;

    return v_inserted;
end;
$$;

revoke all on function public.enqueue_transcription_session(uuid)
from public, anon, service_role;
grant execute on function public.enqueue_transcription_session(uuid)
to authenticated;

create or replace function public.enqueue_transcription_artifact(
    p_session_id uuid,
    p_kind text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_job_id uuid;
begin
    if not private.is_lifecycle_owner(v_user_id) then
        raise exception 'Transcriptions are not enabled for this account'
            using errcode = '42501';
    end if;
    if p_kind not in ('summary', 'notes') then
        raise exception 'Unsupported transcription artifact'
            using errcode = '22023';
    end if;
    if not exists (
        select 1
        from public.transcription_sessions as session
        join public.transcription_documents as document
          on document.session_id = session.id
         and document.kind = 'transcript'
        where session.id = p_session_id
          and session.user_id = v_user_id
          and session.status = 'completed'
          and nullif(btrim(document.content), '') is not null
    ) then
        raise exception 'A complete transcript is required first'
            using errcode = '22023';
    end if;

    insert into public.transcription_jobs (
        session_id, chunk_id, user_id, job_type, status, attempts,
        available_at, error_code, error_message
    )
    values (
        p_session_id, null, v_user_id, p_kind, 'queued', 0,
        now(), null, null
    )
    on conflict (session_id, chunk_id, job_type) do update
    set
        status = case
            when public.transcription_jobs.status in ('queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.status
            else 'queued'
        end,
        attempts = case
            when public.transcription_jobs.status in ('queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.attempts
            else 0
        end,
        available_at = case
            when public.transcription_jobs.status in ('queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.available_at
            else now()
        end,
        locked_at = case when public.transcription_jobs.status = 'processing' then public.transcription_jobs.locked_at else null end,
        locked_by = case when public.transcription_jobs.status = 'processing' then public.transcription_jobs.locked_by else null end,
        error_code = case
            when public.transcription_jobs.status in ('queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.error_code
            else null
        end,
        error_message = case
            when public.transcription_jobs.status in ('queued', 'processing', 'waiting_quota')
                then public.transcription_jobs.error_message
            else null
        end,
        updated_at = now()
    returning id into v_job_id;

    return v_job_id;
end;
$$;

revoke all on function public.enqueue_transcription_artifact(uuid, text)
from public, anon, service_role;
grant execute on function public.enqueue_transcription_artifact(uuid, text)
to authenticated;

create or replace function public.reserve_transcription_provider_attempt(
    p_job_id uuid,
    p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_job public.transcription_jobs%rowtype;
    v_day_start timestamptz;
    v_attempt_count bigint;
begin
    if current_user <> 'postgres' and not pg_has_role(current_user, 'service_role', 'member') then
        raise exception 'Trusted backend role required'
            using errcode = '42501';
    end if;
    if p_daily_limit not between 1 and 1000 then
        raise exception 'Invalid daily provider limit'
            using errcode = '22023';
    end if;

    select job.* into v_job
    from public.transcription_jobs as job
    where job.id = p_job_id
      and job.status = 'processing'
      and job.job_type in ('transcribe', 'summary', 'notes')
    for update;
    if v_job.id is null then
        raise exception 'Provider job is not processing'
            using errcode = '55000';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('lifecycle-transcription-provider-daily', 0));
    v_day_start := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    select count(*) into v_attempt_count
    from public.transcription_provider_attempts as attempt
    where attempt.started_at >= v_day_start;
    if v_attempt_count >= p_daily_limit then
        return false;
    end if;

    insert into public.transcription_provider_attempts (job_id, user_id, operation)
    values (v_job.id, v_job.user_id, v_job.job_type);
    return true;
end;
$$;

revoke all on function public.reserve_transcription_provider_attempt(uuid, integer)
from public, anon, authenticated;
grant execute on function public.reserve_transcription_provider_attempt(uuid, integer)
to service_role;

create or replace function public.claim_transcription_job(p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_job public.transcription_jobs%rowtype;
    v_stale_job public.transcription_jobs%rowtype;
    v_now timestamptz := now();
begin
    if current_user <> 'postgres' and not pg_has_role(current_user, 'service_role', 'member') then
        raise exception 'Trusted backend role required'
            using errcode = '42501';
    end if;
    if nullif(btrim(p_worker_id), '') is null or char_length(p_worker_id) > 120 then
        raise exception 'Invalid worker identifier'
            using errcode = '22023';
    end if;

    for v_stale_job in
        select job.*
        from public.transcription_jobs as job
        where job.status = 'processing'
          and job.locked_at < v_now - interval '15 minutes'
          and job.attempts >= job.max_attempts
        for update skip locked
    loop
        update public.transcription_jobs
        set status = 'failed',
            locked_at = null,
            locked_by = null,
            error_code = 'worker_timeout',
            error_message = 'El proceso se interrumpió y agotó sus reintentos seguros.',
            updated_at = v_now
        where id = v_stale_job.id;

        if v_stale_job.job_type in ('prepare', 'transcribe') then
            update public.transcription_chunks
            set status = 'failed',
                error_code = 'worker_timeout',
                error_message = 'El proceso se interrumpió y agotó sus reintentos seguros.',
                updated_at = v_now
            where id = v_stale_job.chunk_id
              and status <> 'completed';
            update public.transcription_sessions
            set status = 'partial',
                error_code = 'worker_timeout',
                error_message = 'El proceso se interrumpió y agotó sus reintentos seguros.',
                audio_delete_after = coalesce(audio_delete_after, v_now + interval '7 days'),
                updated_at = v_now
            where id = v_stale_job.session_id
              and status <> 'completed';
        end if;
    end loop;

    update public.transcription_jobs
    set status = 'queued',
        locked_at = null,
        locked_by = null,
        available_at = v_now,
        updated_at = v_now
    where status = 'processing'
      and locked_at < v_now - interval '15 minutes'
      and attempts < max_attempts;

    select job.*
    into v_job
    from public.transcription_jobs as job
    where job.status in ('queued', 'waiting_quota')
      and job.available_at <= v_now
      and job.attempts < job.max_attempts
    order by job.available_at, job.created_at
    for update skip locked
    limit 1;

    if v_job.id is null then
        return null;
    end if;

    update public.transcription_jobs
    set status = 'processing',
        attempts = attempts + 1,
        locked_at = v_now,
        locked_by = p_worker_id,
        updated_at = v_now
    where id = v_job.id
    returning * into v_job;

    update public.transcription_sessions
    set status = 'processing', updated_at = v_now
    where id = v_job.session_id and status <> 'completed';
    update public.transcription_chunks
    set status = 'processing', updated_at = v_now
    where id = v_job.chunk_id and status <> 'completed';

    return to_jsonb(v_job);
end;
$$;

revoke all on function public.claim_transcription_job(text)
from public, anon, authenticated;
grant execute on function public.claim_transcription_job(text)
to service_role;

create or replace function public.complete_transcription_prepare_job(
    p_job_id uuid,
    p_segments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_job public.transcription_jobs%rowtype;
    v_segment jsonb;
    v_segment_count integer;
    v_sequence integer;
    v_storage_path text;
    v_mime_type text;
    v_byte_size bigint;
    v_duration_ms bigint;
    v_sha256 text;
    v_total_bytes bigint := 0;
    v_total_duration bigint := 0;
    v_now timestamptz := now();
begin
    if jsonb_typeof(p_segments) <> 'array' then
        raise exception 'Prepared segments must be an array'
            using errcode = '22023';
    end if;
    v_segment_count := jsonb_array_length(p_segments);
    if v_segment_count not between 1 and 60 then
        raise exception 'Invalid prepared segment count'
            using errcode = '22023';
    end if;

    select job.* into v_job
    from public.transcription_jobs as job
    where job.id = p_job_id
      and job.job_type = 'prepare'
    for update;
    if v_job.id is null then
        raise exception 'Preparation job not found'
            using errcode = '22023';
    end if;
    if v_job.status = 'completed' then
        return jsonb_build_object('completed', true, 'alreadyCompleted', true);
    end if;
    if v_job.status <> 'processing' then
        raise exception 'Preparation job is not processing'
            using errcode = '55000';
    end if;

    update public.transcription_chunks
    set sequence_number = -1,
        status = 'deleted',
        error_code = null,
        error_message = null,
        updated_at = v_now
    where id = v_job.chunk_id
      and session_id = v_job.session_id
      and user_id = v_job.user_id
      and media_role = 'import_source';
    if not found then
        raise exception 'Imported source chunk not found'
            using errcode = '22023';
    end if;

    for v_segment in select value from jsonb_array_elements(p_segments)
    loop
        v_sequence := (v_segment->>'sequenceNumber')::integer;
        v_storage_path := v_segment->>'storagePath';
        v_mime_type := v_segment->>'mimeType';
        v_byte_size := (v_segment->>'byteSize')::bigint;
        v_duration_ms := coalesce((v_segment->>'durationMs')::bigint, 0);
        v_sha256 := v_segment->>'sha256';
        if v_sequence not between 0 and v_segment_count - 1
           or v_storage_path is null
           or char_length(v_storage_path) not between 10 and 500
           or v_storage_path not like v_job.user_id::text || '/' || v_job.session_id::text || '/%'
           or v_mime_type <> 'audio/mp4'
           or v_byte_size not between 1 and 52428800
           or v_duration_ms not between 0 and 900000
           or v_sha256 is null
           or v_sha256 !~ '^[a-f0-9]{64}$' then
            raise exception 'Invalid prepared segment metadata'
                using errcode = '22023';
        end if;

        insert into public.transcription_chunks (
            session_id, user_id, sequence_number, storage_path, mime_type,
            media_role, byte_size, duration_ms, sha256, status, updated_at
        ) values (
            v_job.session_id, v_job.user_id, v_sequence, v_storage_path, v_mime_type,
            'prepared', v_byte_size, v_duration_ms, v_sha256, 'queued', v_now
        );
        v_total_bytes := v_total_bytes + v_byte_size;
        v_total_duration := v_total_duration + v_duration_ms;
    end loop;

    insert into public.transcription_jobs (
        session_id, chunk_id, user_id, job_type, status, attempts,
        available_at, error_code, error_message
    )
    select
        chunk.session_id, chunk.id, chunk.user_id, 'transcribe', 'queued', 0,
        v_now, null, null
    from public.transcription_chunks as chunk
    where chunk.session_id = v_job.session_id
      and chunk.user_id = v_job.user_id
      and chunk.media_role = 'prepared'
      and chunk.status = 'queued'
    on conflict (session_id, chunk_id, job_type) do nothing;

    update public.transcription_jobs
    set status = 'completed', completed_at = v_now,
        locked_at = null, locked_by = null,
        error_code = null, error_message = null, updated_at = v_now
    where id = v_job.id;

    update public.transcription_sessions
    set status = 'queued',
        total_bytes = v_total_bytes,
        duration_ms = case when v_total_duration > 0 then v_total_duration else duration_ms end,
        expected_chunks = v_segment_count,
        completed_chunks = 0,
        error_code = null,
        error_message = null,
        updated_at = v_now
    where id = v_job.session_id
      and user_id = v_job.user_id;

    return jsonb_build_object('completed', true, 'segments', v_segment_count);
end;
$$;

revoke all on function public.complete_transcription_prepare_job(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.complete_transcription_prepare_job(uuid, jsonb)
to service_role;

create or replace function public.complete_transcription_chunk_job(
    p_job_id uuid,
    p_transcript text,
    p_finish_reason text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_job public.transcription_jobs%rowtype;
    v_chunk_count integer;
    v_completed_count integer;
    v_combined text;
    v_now timestamptz := now();
begin
    if nullif(btrim(p_transcript), '') is null
       or octet_length(p_transcript) > 2097152 then
        raise exception 'Invalid transcription result'
            using errcode = '22023';
    end if;

    select job.* into v_job
    from public.transcription_jobs as job
    where job.id = p_job_id
      and job.job_type = 'transcribe'
    for update;

    if v_job.id is null then
        raise exception 'Transcription job not found'
            using errcode = '22023';
    end if;
    if v_job.status = 'completed' then
        return jsonb_build_object('completed', true, 'alreadyCompleted', true);
    end if;
    if v_job.status <> 'processing' then
        raise exception 'Transcription job is not processing'
            using errcode = '55000';
    end if;

    update public.transcription_chunks
    set status = 'completed',
        transcript_text = btrim(p_transcript),
        finish_reason = left(coalesce(p_finish_reason, 'completed'), 120),
        error_code = null,
        error_message = null,
        completed_at = v_now,
        updated_at = v_now
    where id = v_job.chunk_id
      and session_id = v_job.session_id
      and user_id = v_job.user_id;
    if not found then
        raise exception 'Transcription chunk not found'
            using errcode = '22023';
    end if;

    update public.transcription_jobs
    set status = 'completed',
        completed_at = v_now,
        locked_at = null,
        locked_by = null,
        error_code = null,
        error_message = null,
        updated_at = v_now
    where id = v_job.id;

    select count(*), count(*) filter (where chunk.status = 'completed')
    into v_chunk_count, v_completed_count
    from public.transcription_chunks as chunk
    where chunk.session_id = v_job.session_id
      and chunk.status <> 'deleted';

    if v_chunk_count > 0 and v_completed_count = v_chunk_count then
        select string_agg(btrim(chunk.transcript_text), E'\n\n' order by chunk.sequence_number)
        into v_combined
        from public.transcription_chunks as chunk
        where chunk.session_id = v_job.session_id
          and chunk.status = 'completed';

        if nullif(v_combined, '') is null or octet_length(v_combined) > 10485760 then
            raise exception 'Combined transcription exceeds the safe document limit'
                using errcode = '54000';
        end if;

        insert into public.transcription_documents (
            session_id, user_id, kind, content, user_edited, updated_at
        ) values (
            v_job.session_id, v_job.user_id, 'transcript', v_combined, false, v_now
        )
        on conflict (session_id, kind) do update
        set content = excluded.content,
            user_edited = false,
            updated_at = excluded.updated_at;

        update public.transcription_sessions
        set status = 'completed',
            completed_chunks = v_completed_count,
            completed_at = v_now,
            audio_delete_after = v_now + interval '24 hours',
            error_code = null,
            error_message = null,
            updated_at = v_now
        where id = v_job.session_id
          and user_id = v_job.user_id;
    else
        update public.transcription_sessions
        set completed_chunks = v_completed_count,
            error_code = null,
            error_message = null,
            updated_at = v_now
        where id = v_job.session_id
          and user_id = v_job.user_id;
    end if;

    return jsonb_build_object(
        'completed', true,
        'sessionCompleted', v_chunk_count > 0 and v_completed_count = v_chunk_count,
        'completedChunks', v_completed_count,
        'expectedChunks', v_chunk_count
    );
end;
$$;

revoke all on function public.complete_transcription_chunk_job(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.complete_transcription_chunk_job(uuid, text, text)
to service_role;

create or replace function public.complete_transcription_artifact_job(
    p_job_id uuid,
    p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_job public.transcription_jobs%rowtype;
    v_now timestamptz := now();
begin
    if nullif(btrim(p_content), '') is null
       or octet_length(p_content) > 10485760 then
        raise exception 'Invalid transcription artifact'
            using errcode = '22023';
    end if;

    select job.* into v_job
    from public.transcription_jobs as job
    where job.id = p_job_id
      and job.job_type in ('summary', 'notes')
    for update;

    if v_job.id is null then
        raise exception 'Transcription artifact job not found'
            using errcode = '22023';
    end if;
    if v_job.status = 'completed' then
        return jsonb_build_object('completed', true, 'alreadyCompleted', true);
    end if;
    if v_job.status <> 'processing' then
        raise exception 'Transcription artifact job is not processing'
            using errcode = '55000';
    end if;

    insert into public.transcription_documents (
        session_id, user_id, kind, content, user_edited, updated_at
    ) values (
        v_job.session_id, v_job.user_id, v_job.job_type, btrim(p_content), false, v_now
    )
    on conflict (session_id, kind) do update
    set content = excluded.content,
        user_edited = false,
        updated_at = excluded.updated_at;

    update public.transcription_jobs
    set status = 'completed',
        completed_at = v_now,
        locked_at = null,
        locked_by = null,
        error_code = null,
        error_message = null,
        updated_at = v_now
    where id = v_job.id;

    return jsonb_build_object('completed', true, 'kind', v_job.job_type);
end;
$$;

revoke all on function public.complete_transcription_artifact_job(uuid, text)
from public, anon, authenticated;
grant execute on function public.complete_transcription_artifact_job(uuid, text)
to service_role;

create or replace function public.fail_transcription_job(
    p_job_id uuid,
    p_status text,
    p_available_at timestamptz,
    p_error_code text,
    p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_job public.transcription_jobs%rowtype;
    v_retryable boolean;
    v_now timestamptz := now();
begin
    if p_status not in ('queued', 'waiting_quota', 'failed') then
        raise exception 'Invalid transcription failure status'
            using errcode = '22023';
    end if;
    if char_length(coalesce(p_error_code, '')) > 120
       or char_length(coalesce(p_error_message, '')) > 2000 then
        raise exception 'Transcription failure detail is too large'
            using errcode = '22023';
    end if;

    select job.* into v_job
    from public.transcription_jobs as job
    where job.id = p_job_id
    for update;

    if v_job.id is null then
        raise exception 'Transcription job not found'
            using errcode = '22023';
    end if;
    if v_job.status = 'completed' then
        return false;
    end if;
    if v_job.status <> 'processing' then
        return false;
    end if;

    v_retryable := p_status in ('queued', 'waiting_quota');
    update public.transcription_jobs
    set status = p_status,
        attempts = case
            when p_status = 'waiting_quota' and p_error_code = 'daily_safety_limit'
                then greatest(attempts - 1, 0)
            else attempts
        end,
        available_at = greatest(coalesce(p_available_at, v_now), v_now),
        locked_at = null,
        locked_by = null,
        error_code = nullif(left(coalesce(p_error_code, ''), 120), ''),
        error_message = nullif(left(coalesce(p_error_message, ''), 2000), ''),
        updated_at = v_now
    where id = v_job.id;

    if v_job.job_type in ('prepare', 'transcribe') and v_job.chunk_id is not null then
        update public.transcription_chunks
        set status = case when v_retryable then 'uploaded' else 'failed' end,
            error_code = nullif(left(coalesce(p_error_code, ''), 120), ''),
            error_message = nullif(left(coalesce(p_error_message, ''), 2000), ''),
            updated_at = v_now
        where id = v_job.chunk_id
          and status <> 'completed';

        update public.transcription_sessions
        set status = case when v_retryable then 'queued' else 'partial' end,
            error_code = nullif(left(coalesce(p_error_code, ''), 120), ''),
            error_message = nullif(left(coalesce(p_error_message, ''), 2000), ''),
            audio_delete_after = case
                when v_retryable then audio_delete_after
                else coalesce(audio_delete_after, v_now + interval '7 days')
            end,
            updated_at = v_now
        where id = v_job.session_id
          and status <> 'completed';
    end if;

    return true;
end;
$$;

revoke all on function public.fail_transcription_job(uuid, text, timestamptz, text, text)
from public, anon, authenticated;
grant execute on function public.fail_transcription_job(uuid, text, timestamptz, text, text)
to service_role;

insert into storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
)
values (
    'transcription-audio',
    'transcription-audio',
    false,
    52428800,
    array[
        'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
        'audio/wav', 'audio/aac', 'audio/flac', 'audio/aiff',
        'audio/opus', 'video/mp4', 'video/quicktime',
        'video/x-matroska', 'video/webm', 'video/mpeg', 'video/x-m4v'
    ]::text[]
)
on conflict (id) do update
set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists transcription_audio_owner_select on storage.objects;
create policy transcription_audio_owner_select
on storage.objects for select to authenticated
using (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_lifecycle_owner())
    and exists (
        select 1
        from public.transcription_sessions as session
        where session.id::text = (storage.foldername(name))[2]
          and session.user_id = (select auth.uid())
    )
);

drop policy if exists transcription_audio_owner_insert on storage.objects;
create policy transcription_audio_owner_insert
on storage.objects for insert to authenticated
with check (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_lifecycle_owner())
    and exists (
        select 1
        from public.transcription_sessions as session
        where session.id::text = (storage.foldername(name))[2]
          and session.user_id = (select auth.uid())
    )
);

drop policy if exists transcription_audio_owner_update on storage.objects;
create policy transcription_audio_owner_update
on storage.objects for update to authenticated
using (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_lifecycle_owner())
    and exists (
        select 1
        from public.transcription_sessions as session
        where session.id::text = (storage.foldername(name))[2]
          and session.user_id = (select auth.uid())
    )
)
with check (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_lifecycle_owner())
    and exists (
        select 1
        from public.transcription_sessions as session
        where session.id::text = (storage.foldername(name))[2]
          and session.user_id = (select auth.uid())
    )
);

drop policy if exists transcription_audio_owner_delete on storage.objects;
create policy transcription_audio_owner_delete
on storage.objects for delete to authenticated
using (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_lifecycle_owner())
    and exists (
        select 1
        from public.transcription_sessions as session
        where session.id::text = (storage.foldername(name))[2]
          and session.user_id = (select auth.uid())
    )
);
