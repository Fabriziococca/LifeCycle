-- Tanda 8: normalized Trading projection and durable notification idempotency.
-- `user_data.data.finanzasData.tradingEvents` remains the compatibility source;
-- this migration projects it transactionally into relational rows.

set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function private.valid_trading_notice_days(p_days smallint[])
returns boolean
language sql
immutable
strict
parallel safe
security invoker
set search_path = pg_catalog, pg_temp
as $$
    select cardinality(p_days) between 1 and 12
       and array_position(p_days, null) is null
       and not exists (
           select 1
           from unnest(p_days) as notice(day)
           where notice.day < 1 or notice.day > 365
       )
       and cardinality(p_days) = (
           select count(distinct notice.day)
           from unnest(p_days) as notice(day)
       );
$$;

revoke all on function private.valid_trading_notice_days(smallint[])
from public, anon, authenticated, service_role;

create table if not exists public.trading_events (
    user_id uuid not null
        references auth.users(id) on delete cascade,
    id text not null,
    company text not null,
    ticker text not null default '',
    name text not null,
    scheduled_at timestamptz not null,
    notes text not null default '',
    source_url text not null default '',
    notice_days smallint[] not null,
    status text not null default 'active',
    created_at timestamptz not null,
    updated_at timestamptz not null,
    primary key (user_id, id),
    constraint trading_events_id_format_check
        check (id ~ '^[a-z0-9][a-z0-9_-]{2,95}$'),
    constraint trading_events_company_length_check
        check (char_length(company) between 1 and 100),
    constraint trading_events_ticker_length_check
        check (char_length(ticker) <= 20),
    constraint trading_events_name_length_check
        check (char_length(name) between 1 and 120),
    constraint trading_events_notes_length_check
        check (char_length(notes) <= 800),
    constraint trading_events_source_url_length_check
        check (char_length(source_url) <= 500),
    constraint trading_events_notice_days_check
        check (private.valid_trading_notice_days(notice_days)),
    constraint trading_events_status_check
        check (status in ('active', 'paused'))
);

comment on table public.trading_events is
    'Relational projection of the Trading events retained inside finanzasData for offline compatibility.';

alter table public.trading_events enable row level security;

drop policy if exists "Users can read their own trading events"
on public.trading_events;
create policy "Users can read their own trading events"
on public.trading_events
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.trading_events
from public, anon, authenticated, service_role;
grant select on table public.trading_events to authenticated, service_role;

create index if not exists trading_events_active_schedule_idx
on public.trading_events (user_id, scheduled_at)
where status = 'active';

create or replace function private.safe_timestamptz(
    p_value text,
    p_fallback timestamptz
)
returns timestamptz
language plpgsql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
    if p_value is null or btrim(p_value) = '' then
        return p_fallback;
    end if;

    begin
        return p_value::timestamptz;
    exception when data_exception then
        return p_fallback;
    end;
end;
$$;

revoke all on function private.safe_timestamptz(text, timestamptz)
from public, anon, authenticated, service_role;

create or replace function private.extract_trading_events(p_data jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
    v_finance_raw jsonb;
    v_finance jsonb;
begin
    if p_data is null or jsonb_typeof(p_data) <> 'object' then
        return '[]'::jsonb;
    end if;

    v_finance_raw := p_data -> 'finanzasData';
    if jsonb_typeof(v_finance_raw) = 'object' then
        v_finance := v_finance_raw;
    elsif jsonb_typeof(v_finance_raw) = 'string' then
        begin
            v_finance := (v_finance_raw #>> '{}')::jsonb;
        exception when data_exception then
            return '[]'::jsonb;
        end;
    else
        return '[]'::jsonb;
    end if;

    if jsonb_typeof(v_finance -> 'tradingEvents') <> 'array' then
        return '[]'::jsonb;
    end if;

    return v_finance -> 'tradingEvents';
end;
$$;

revoke all on function private.extract_trading_events(jsonb)
from public, anon, authenticated, service_role;

create or replace function private.sync_trading_events_for_user(
    p_user_id uuid,
    p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_events jsonb := private.extract_trading_events(p_data);
    v_event jsonb;
    v_id text;
    v_company text;
    v_ticker text;
    v_name text;
    v_notes text;
    v_source_url text;
    v_status text;
    v_scheduled_at timestamptz;
    v_created_at timestamptz;
    v_updated_at timestamptz;
    v_notice_days smallint[];
begin
    if p_user_id is null then
        raise exception 'p_user_id is required'
            using errcode = '22023';
    end if;

    delete from public.trading_events
    where user_id = p_user_id;

    for v_event in
        select candidate.value
        from jsonb_array_elements(v_events) with ordinality as candidate(value, position)
        where candidate.position <= 500
        order by candidate.position
    loop
        begin
            if jsonb_typeof(v_event) <> 'object' then
                continue;
            end if;

            v_id := lower(left(btrim(coalesce(v_event ->> 'id', '')), 96));
            v_company := left(btrim(regexp_replace(
                coalesce(v_event ->> 'company', ''),
                '[[:space:]]+', ' ', 'g'
            )), 100);
            v_ticker := upper(left(btrim(regexp_replace(
                coalesce(v_event ->> 'ticker', ''),
                '[[:space:]]+', ' ', 'g'
            )), 20));
            v_name := left(btrim(regexp_replace(
                coalesce(v_event ->> 'name', ''),
                '[[:space:]]+', ' ', 'g'
            )), 120);

            if v_id !~ '^[a-z0-9][a-z0-9_-]{2,95}$'
               or v_company = ''
               or v_name = '' then
                continue;
            end if;

            v_scheduled_at := private.safe_timestamptz(
                v_event ->> 'scheduledAt',
                null
            );
            if v_scheduled_at is null then
                continue;
            end if;

            v_created_at := private.safe_timestamptz(
                v_event ->> 'createdAt',
                v_scheduled_at
            );
            v_updated_at := private.safe_timestamptz(
                v_event ->> 'updatedAt',
                v_created_at
            );

            select coalesce(array_agg(valid.day order by valid.day desc), '{}'::smallint[])
            into v_notice_days
            from (
                select parsed.day::smallint as day
                from (
                    select case
                        when item.value ~ '^[0-9]{1,3}$'
                            then item.value::integer
                        else null
                    end as day
                    from jsonb_array_elements_text(
                        case
                            when jsonb_typeof(v_event -> 'noticeDays') = 'array'
                                then v_event -> 'noticeDays'
                            else '[]'::jsonb
                        end
                    ) as item(value)
                ) as parsed
                where parsed.day between 1 and 365
                group by parsed.day
                order by parsed.day desc
                limit 12
            ) as valid;

            if not private.valid_trading_notice_days(v_notice_days) then
                continue;
            end if;

            v_notes := left(btrim(regexp_replace(
                coalesce(v_event ->> 'notes', ''),
                '[[:space:]]+', ' ', 'g'
            )), 800);
            v_source_url := left(btrim(coalesce(v_event ->> 'sourceUrl', '')), 500);
            if v_source_url <> '' and v_source_url !~* '^https?://' then
                v_source_url := '';
            end if;
            v_status := case
                when v_event ->> 'status' = 'paused' then 'paused'
                else 'active'
            end;

            insert into public.trading_events (
                user_id,
                id,
                company,
                ticker,
                name,
                scheduled_at,
                notes,
                source_url,
                notice_days,
                status,
                created_at,
                updated_at
            ) values (
                p_user_id,
                v_id,
                v_company,
                v_ticker,
                v_name,
                v_scheduled_at,
                v_notes,
                v_source_url,
                v_notice_days,
                v_status,
                v_created_at,
                v_updated_at
            )
            on conflict (user_id, id) do nothing;
        exception
            when data_exception or integrity_constraint_violation then
                -- Compatibility data should never block the primary cloud save.
                null;
        end;
    end loop;
end;
$$;

revoke all on function private.sync_trading_events_for_user(uuid, jsonb)
from public, anon, authenticated, service_role;

create or replace function private.sync_trading_events_from_user_data()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
    if tg_op = 'UPDATE'
       and private.extract_trading_events(new.data)
           is not distinct from private.extract_trading_events(old.data) then
        return new;
    end if;

    perform private.sync_trading_events_for_user(new.user_id, new.data);
    return new;
end;
$$;

revoke all on function private.sync_trading_events_from_user_data()
from public, anon, authenticated, service_role;

drop trigger if exists user_data_sync_trading_events on public.user_data;
create trigger user_data_sync_trading_events
after insert or update of data on public.user_data
for each row
execute function private.sync_trading_events_from_user_data();

-- Backfill safely. The original JSON is deliberately retained for rollback and
-- for offline clients that have not yet received the new application version.
select private.sync_trading_events_for_user(user_id, data)
from public.user_data;

-- Durable per-alert claims prevent duplicate Trading notifications across
-- Render restarts or concurrent scheduler instances.
create table if not exists private.trading_notification_dispatches (
    user_id uuid not null
        references auth.users(id) on delete cascade,
    alert_key text not null,
    event_id text not null,
    scheduled_at timestamptz not null,
    notice_days smallint not null,
    status text not null,
    claimed_at timestamptz not null default now(),
    completed_at timestamptz,
    attempt_count integer not null default 1,
    last_error text,
    primary key (user_id, alert_key),
    constraint trading_dispatch_alert_key_length_check
        check (char_length(alert_key) between 1 and 220),
    constraint trading_dispatch_event_id_length_check
        check (char_length(event_id) between 1 and 96),
    constraint trading_dispatch_notice_days_check
        check (notice_days between 1 and 365),
    constraint trading_dispatch_status_check
        check (status in ('processing', 'sent', 'failed', 'no_devices')),
    constraint trading_dispatch_attempt_count_check
        check (attempt_count >= 1),
    constraint trading_dispatch_last_error_length_check
        check (last_error is null or char_length(last_error) <= 500)
);

alter table private.trading_notification_dispatches enable row level security;
alter table private.trading_notification_dispatches force row level security;

revoke all on table private.trading_notification_dispatches
from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete
on table private.trading_notification_dispatches to service_role;

create index if not exists trading_notification_dispatches_retention_idx
on private.trading_notification_dispatches (completed_at)
where completed_at is not null;

create or replace function public.claim_trading_notification_dispatch(
    p_user_id uuid,
    p_alert_key text,
    p_event_id text,
    p_scheduled_at timestamptz,
    p_notice_days integer
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
    v_claimed boolean := false;
begin
    if p_user_id is null
       or btrim(coalesce(p_alert_key, '')) = ''
       or btrim(coalesce(p_event_id, '')) = ''
       or p_scheduled_at is null
       or p_notice_days is null
       or p_notice_days not between 1 and 365 then
        raise exception 'Invalid Trading notification claim'
            using errcode = '22023';
    end if;

    insert into private.trading_notification_dispatches as target (
        user_id,
        alert_key,
        event_id,
        scheduled_at,
        notice_days,
        status,
        claimed_at,
        completed_at,
        attempt_count,
        last_error
    ) values (
        p_user_id,
        left(p_alert_key, 220),
        left(p_event_id, 96),
        p_scheduled_at,
        p_notice_days::smallint,
        'processing',
        now(),
        null,
        1,
        null
    )
    on conflict (user_id, alert_key) do update
    set
        event_id = excluded.event_id,
        scheduled_at = excluded.scheduled_at,
        notice_days = excluded.notice_days,
        status = 'processing',
        claimed_at = now(),
        completed_at = null,
        attempt_count = target.attempt_count + 1,
        last_error = null
    where target.status <> 'sent'
      and (
          target.claimed_at < now() - interval '15 minutes'
          and target.status in ('processing', 'failed')
          or target.claimed_at < now() - interval '1 hour'
          and target.status = 'no_devices'
      )
    returning true into v_claimed;

    return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_trading_notification_dispatch(
    uuid, text, text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.claim_trading_notification_dispatch(
    uuid, text, text, timestamptz, integer
) to service_role;

create or replace function public.complete_trading_notification_dispatch(
    p_user_id uuid,
    p_alert_key text,
    p_status text,
    p_error text default null
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
    if p_status not in ('sent', 'failed', 'no_devices') then
        raise exception 'Invalid Trading notification result status'
            using errcode = '22023';
    end if;

    update private.trading_notification_dispatches
    set
        status = p_status,
        completed_at = now(),
        last_error = nullif(left(coalesce(p_error, ''), 500), '')
    where user_id = p_user_id
      and alert_key = p_alert_key;

    return found;
end;
$$;

revoke all on function public.complete_trading_notification_dispatch(
    uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.complete_trading_notification_dispatch(
    uuid, text, text, text
) to service_role;

comment on table private.trading_notification_dispatches is
    'Server-only durable claims for idempotent Trading Push delivery.';
