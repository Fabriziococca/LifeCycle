-- Let the service-role backend update only notification-engine state.
create or replace function public.merge_server_user_data_keys(
    p_user_id uuid,
    p_updates jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_updated_at timestamptz;
    v_invalid_key text;
    v_allowed_keys constant text[] := array[
        'alerts_sent_log',
        'robot_last_notified_at',
        'very_urgent_last_notified_at'
    ];
begin
    if p_user_id is null then
        raise exception 'p_user_id is required'
            using errcode = '22023';
    end if;

    if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
        raise exception 'p_updates must be a JSON object'
            using errcode = '22023';
    end if;

    select candidate.key
    into v_invalid_key
    from jsonb_object_keys(p_updates) as candidate(key)
    where not (candidate.key = any(v_allowed_keys))
    limit 1;

    if v_invalid_key is not null then
        raise exception 'Unsupported server-managed user_data key: %', v_invalid_key
            using errcode = '22023';
    end if;

    if p_updates ? 'alerts_sent_log'
       and jsonb_typeof(p_updates -> 'alerts_sent_log') <> 'object' then
        raise exception 'alerts_sent_log must be a JSON object'
            using errcode = '22023';
    end if;

    update public.user_data as target
    set
        data = (
            coalesce(target.data, '{}'::jsonb)
            || (p_updates - 'alerts_sent_log')
            || case
                when p_updates ? 'alerts_sent_log' then jsonb_build_object(
                    'alerts_sent_log',
                    coalesce(target.data -> 'alerts_sent_log', '{}'::jsonb)
                    || (p_updates -> 'alerts_sent_log')
                )
                else '{}'::jsonb
            end
        ),
        updated_at = now()
    where target.user_id = p_user_id
    returning target.updated_at into v_updated_at;

    if v_updated_at is null then
        raise exception 'user_data row not found'
            using errcode = 'P0002';
    end if;

    return v_updated_at;
end;
$$;

revoke execute on function public.merge_server_user_data_keys(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.merge_server_user_data_keys(uuid, jsonb)
to service_role;
