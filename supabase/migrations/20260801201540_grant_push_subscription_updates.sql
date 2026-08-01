-- Device delivery metadata is maintained exclusively by the trusted backend.
-- The table predated these UPDATE-based metrics and did not grant this
-- privilege to service_role, so successful pushes could not persist their
-- last_success_at / last_seen_at state.
grant update on table public.push_subscriptions to service_role;
