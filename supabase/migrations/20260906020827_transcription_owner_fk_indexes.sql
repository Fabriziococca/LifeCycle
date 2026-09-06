-- Cover the composite ownership foreign keys reported by the production
-- advisor. Tables are new/empty; lock time is bounded and no data is rewritten.
set lock_timeout = '3s';
set statement_timeout = '30s';

create index if not exists transcription_chunks_session_owner_idx
on public.transcription_chunks (session_id, user_id);
create index if not exists transcription_documents_session_owner_idx
on public.transcription_documents (session_id, user_id);
create index if not exists transcription_jobs_chunk_owner_idx
on public.transcription_jobs (chunk_id, user_id);
create index if not exists transcription_jobs_session_owner_idx
on public.transcription_jobs (session_id, user_id);
create index if not exists transcription_provider_attempts_job_owner_idx
on public.transcription_provider_attempts (job_id, user_id);
create index if not exists transcription_sessions_folder_owner_idx
on public.transcription_sessions (folder_id, user_id);
