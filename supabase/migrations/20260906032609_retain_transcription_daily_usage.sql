-- Deleting content must not refund provider attempts already consumed today.
-- Retain only the private usage row; unlink its job, not its owner. Existing
-- RLS, grants, daily-window accounting and composite FK indexes stay unchanged.
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.transcription_provider_attempts
    alter column job_id drop not null,
    drop constraint transcription_provider_attempts_job_owner_fkey,
    add constraint transcription_provider_attempts_job_owner_fkey
        foreign key (job_id, user_id)
        references public.transcription_jobs (id, user_id)
        on delete set null (job_id);

comment on column public.transcription_provider_attempts.job_id is
    'Nullable after deleting the source job/session. The private usage row still counts toward the daily safety limit; it stores no audio or transcript.';
