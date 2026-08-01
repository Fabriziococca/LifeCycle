-- Complete the notification history semantics without exposing any Push secret.
-- Rows without an endpoint represent an alert that was due while the account had
-- no registered devices. Manual confirmation is deliberately separate from the
-- provider status: Web Push acceptance and human receipt are different facts.
alter table public.notification_delivery_log
    alter column endpoint_fingerprint drop not null,
    add column if not exists confirmed_at timestamptz;

alter table public.notification_delivery_log
    drop constraint if exists notification_delivery_log_status_check;

alter table public.notification_delivery_log
    add constraint notification_delivery_log_status_check
    check (status in ('accepted', 'failed', 'expired', 'no_devices'));

create index if not exists notification_delivery_log_retention_idx
    on public.notification_delivery_log (attempted_at);

comment on column public.notification_delivery_log.confirmed_at is
    'Manual confirmation that the signed-in user saw the notification; null is unknown.';
