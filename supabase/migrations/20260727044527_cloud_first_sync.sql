-- Preserve a private snapshot before changing the synchronization strategy.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.user_data_snapshots (
    id bigint generated always as identity primary key,
    user_id uuid not null,
    data jsonb not null,
    captured_at timestamptz not null default now(),
    reason text not null,
    unique (user_id, reason)
);

revoke all on table private.user_data_snapshots from public, anon, authenticated;
revoke all on sequence private.user_data_snapshots_id_seq from public, anon, authenticated;

insert into private.user_data_snapshots (user_id, data, reason)
select user_id, data, 'before_cloud_first_sync_v1'
from public.user_data
on conflict (user_id, reason) do nothing;

-- Merge only the changed top-level keys instead of replacing the whole JSON document.
create or replace function public.merge_user_data_keys(
    p_updates jsonb default '{}'::jsonb,
    p_delete_keys text[] default '{}'::text[]
)
returns timestamptz
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_updated_at timestamptz;
    v_delete_keys text[];
    v_protected_keys constant text[] := array[
        'alerts_sent_log',
        'very_urgent_last_notified_at'
    ];
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '28000';
    end if;

    if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
        raise exception 'p_updates must be a JSON object'
            using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct key), '{}'::text[])
    into v_delete_keys
    from unnest(coalesce(p_delete_keys, '{}'::text[])) as key
    where key is not null and btrim(key) <> '';

    if p_updates ?| v_protected_keys or v_delete_keys && v_protected_keys then
        raise exception 'Server-managed keys cannot be modified by the client'
            using errcode = '42501';
    end if;

    insert into public.user_data as target (user_id, data, updated_at)
    values (v_user_id, p_updates, now())
    on conflict (user_id) do update
    set
        data = (coalesce(target.data, '{}'::jsonb) - v_delete_keys) || excluded.data,
        updated_at = now()
    returning updated_at into v_updated_at;

    return v_updated_at;
end;
$$;

revoke execute on function public.merge_user_data_keys(jsonb, text[]) from public, anon;
grant execute on function public.merge_user_data_keys(jsonb, text[]) to authenticated;
