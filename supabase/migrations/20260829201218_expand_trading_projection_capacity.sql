-- Keep the relational Trading projection aligned with the synchronized JSON.
-- The 10,000-row ceiling is a parser/trigger safety guard, not an account
-- quota. Per-account limits are enforced at the user_data boundary.

set lock_timeout = '5s';
set statement_timeout = '30s';

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
        where candidate.position <= 10000
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

comment on function private.sync_trading_events_for_user(uuid, jsonb) is
    'Refreshes the bounded relational Trading projection from one synchronized user document.';

-- Rebuild existing projections so rows beyond the former 500-item ceiling are
-- available to the scheduler immediately after this migration is applied.
select private.sync_trading_events_for_user(user_id, data)
from public.user_data;
