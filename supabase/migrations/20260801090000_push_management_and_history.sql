-- Add user-friendly device metadata to existing Web Push subscriptions.
alter table public.push_subscriptions
    add column if not exists device_name text,
    add column if not exists platform text,
    add column if not exists browser text,
    add column if not exists user_agent text,
    add column if not exists endpoint_fingerprint text,
    add column if not exists last_seen_at timestamptz,
    add column if not exists last_success_at timestamptz,
    add column if not exists last_failure_at timestamptz,
    add column if not exists consecutive_failures integer not null default 0;

create index if not exists push_subscriptions_user_last_seen_idx
    on public.push_subscriptions (user_id, last_seen_at desc);

create index if not exists push_subscriptions_endpoint_fingerprint_idx
    on public.push_subscriptions (user_id, endpoint_fingerprint);

-- The backend records one row for each endpoint it actually attempts to notify.
-- "accepted" means the Web Push provider accepted the request; browsers do not
-- expose a reliable confirmation that the person saw the notification.
create table if not exists public.notification_delivery_log (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    alert_key text not null,
    context text,
    title text,
    body text,
    subscription_row_id text,
    endpoint_fingerprint text not null,
    device_name text,
    status text not null check (status in ('accepted', 'failed', 'expired')),
    provider_status integer,
    error_message text,
    attempted_at timestamptz not null default now()
);

create index if not exists notification_delivery_log_user_attempted_idx
    on public.notification_delivery_log (user_id, attempted_at desc);

create index if not exists notification_delivery_log_user_status_idx
    on public.notification_delivery_log (user_id, status, attempted_at desc);

alter table public.notification_delivery_log enable row level security;

revoke all on table public.notification_delivery_log from public, anon, authenticated;
revoke all on sequence public.notification_delivery_log_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_delivery_log to service_role;
grant usage, select on sequence public.notification_delivery_log_id_seq to service_role;
