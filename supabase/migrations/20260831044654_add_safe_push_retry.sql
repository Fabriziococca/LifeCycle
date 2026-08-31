-- Allow one freshness-bounded retry after a provider-accepted Push has no
-- device receipt. The retry is a separate auditable attempt and cannot extend
-- the original notification expiry.
alter table public.notification_delivery_log
    add column if not exists attempt_no smallint not null default 1,
    add column if not exists retry_of_id bigint
        references public.notification_delivery_log(id) on delete cascade;

alter table public.notification_delivery_log
    drop constraint if exists notification_delivery_log_attempt_no_check;
alter table public.notification_delivery_log
    add constraint notification_delivery_log_attempt_no_check
    check (attempt_no in (1, 2));

alter table public.notification_delivery_log
    drop constraint if exists notification_delivery_log_retry_link_check;
alter table public.notification_delivery_log
    add constraint notification_delivery_log_retry_link_check
    check (
        (attempt_no = 1 and retry_of_id is null)
        or (attempt_no = 2 and retry_of_id is not null)
    );

drop index if exists public.notification_delivery_log_dispatch_once_idx;
create unique index notification_delivery_log_dispatch_once_idx
    on public.notification_delivery_log (
        user_id,
        alert_key,
        scheduled_at,
        endpoint_fingerprint
    )
    where attempt_no = 1
      and status in ('pending', 'accepted')
      and scheduled_at is not null
      and endpoint_fingerprint is not null;

create unique index if not exists notification_delivery_log_retry_once_idx
    on public.notification_delivery_log (retry_of_id)
    where retry_of_id is not null;

create index if not exists notification_delivery_log_retry_candidates_idx
    on public.notification_delivery_log (attempted_at, expires_at)
    where attempt_no = 1
      and status = 'accepted'
      and received_at is null
      and displayed_at is null;

create or replace function public.claim_notification_delivery_retry(
    p_delivery_id bigint,
    p_receipt_token_hash text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_original public.notification_delivery_log%rowtype;
    v_retry_id bigint;
begin
    if p_delivery_id is null
       or p_receipt_token_hash is null
       or p_receipt_token_hash !~ '^[a-f0-9]{64}$' then
        return null;
    end if;

    select delivery.*
    into v_original
    from public.notification_delivery_log as delivery
    where delivery.id = p_delivery_id
      and delivery.attempt_no = 1
      and delivery.status = 'accepted'
      and delivery.received_at is null
      and delivery.displayed_at is null
      and delivery.discarded_at is null
      and delivery.attempted_at <= clock_timestamp() - interval '5 minutes'
      and delivery.expires_at > clock_timestamp()
    for update;

    if not found then
        return null;
    end if;

    insert into public.notification_delivery_log (
        user_id,
        alert_key,
        context,
        title,
        body,
        subscription_row_id,
        endpoint_fingerprint,
        device_name,
        status,
        provider_status,
        error_message,
        attempted_at,
        scheduled_at,
        expires_at,
        receipt_token_hash,
        attempt_no,
        retry_of_id
    ) values (
        v_original.user_id,
        v_original.alert_key,
        v_original.context,
        v_original.title,
        v_original.body,
        v_original.subscription_row_id,
        v_original.endpoint_fingerprint,
        v_original.device_name,
        'pending',
        null,
        null,
        clock_timestamp(),
        v_original.scheduled_at,
        v_original.expires_at,
        p_receipt_token_hash,
        2,
        v_original.id
    )
    on conflict do nothing
    returning id into v_retry_id;

    return v_retry_id;
end;
$$;

comment on column public.notification_delivery_log.attempt_no is
    '1 for the original provider request and 2 for the only allowed device-receipt retry.';
comment on column public.notification_delivery_log.retry_of_id is
    'Original delivery retried inside the same freshness window; unique when present.';
comment on function public.claim_notification_delivery_retry(bigint, text) is
    'Atomically reserves one retry only while the original accepted Push is fresh and has no device receipt.';

revoke all on function public.claim_notification_delivery_retry(bigint, text)
from public, anon, authenticated;
grant execute on function public.claim_notification_delivery_retry(bigint, text)
to service_role;

alter table public.notification_delivery_log enable row level security;
revoke all on table public.notification_delivery_log from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_delivery_log to service_role;

notify pgrst, 'reload schema';
