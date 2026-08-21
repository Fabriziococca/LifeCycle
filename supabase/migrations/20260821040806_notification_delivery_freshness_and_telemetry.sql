-- Keep time-sensitive Web Push messages fresh and distinguish provider
-- acceptance from receipt/display by the target browser.
alter table public.notification_delivery_log
    add column if not exists scheduled_at timestamptz,
    add column if not exists expires_at timestamptz,
    add column if not exists received_at timestamptz,
    add column if not exists displayed_at timestamptz,
    add column if not exists discarded_at timestamptz,
    add column if not exists receipt_token_hash text;

alter table public.notification_delivery_log
    drop constraint if exists notification_delivery_log_status_check;

alter table public.notification_delivery_log
    add constraint notification_delivery_log_status_check
    check (status in ('pending', 'accepted', 'failed', 'expired', 'unknown', 'no_devices'));

alter table public.notification_delivery_log
    drop constraint if exists notification_delivery_log_freshness_check;

alter table public.notification_delivery_log
    add constraint notification_delivery_log_freshness_check
    check (
        scheduled_at is null
        or expires_at is null
        or expires_at > scheduled_at
    );

create unique index if not exists notification_delivery_log_receipt_token_idx
    on public.notification_delivery_log (receipt_token_hash)
    where receipt_token_hash is not null;

create index if not exists notification_delivery_log_pending_idx
    on public.notification_delivery_log (attempted_at)
    where status = 'pending';

-- A restart or overlapping process cannot deliver the same scheduled alert to
-- the same endpoint twice. Failed/unknown attempts leave the index and may be
-- retried while the freshness window is still open.
create unique index if not exists notification_delivery_log_dispatch_once_idx
    on public.notification_delivery_log (
        user_id,
        alert_key,
        scheduled_at,
        endpoint_fingerprint
    )
    where status in ('pending', 'accepted')
      and scheduled_at is not null
      and endpoint_fingerprint is not null;

-- The capability token is generated per delivery, stored only as a SHA-256
-- hash, and never returned by authenticated history endpoints.
comment on column public.notification_delivery_log.receipt_token_hash is
    'SHA-256 of the one-use delivery capability embedded in the encrypted Push payload.';
comment on column public.notification_delivery_log.received_at is
    'Automatic timestamp reported when the service worker received the Push event.';
comment on column public.notification_delivery_log.displayed_at is
    'Automatic timestamp reported after showNotification resolved; this is not proof the person saw it.';
comment on column public.notification_delivery_log.discarded_at is
    'Automatic timestamp reported when the service worker discarded an already expired payload.';

alter table public.notification_delivery_log enable row level security;
revoke all on table public.notification_delivery_log from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_delivery_log to service_role;
