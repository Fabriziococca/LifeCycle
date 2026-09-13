-- Contain the sync feedback incident without disabling cross-device updates.
-- No user data, ownership rules, return types or client permissions change.
set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function public.merge_user_data_keys(
    p_updates jsonb default '{}'::jsonb,
    p_delete_keys text[] default '{}'::text[]
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_updated_at timestamptz;
    v_delete_keys text[];
    v_invalid_key text;
    v_allowed_keys constant text[] := array[
        'hygiene_tracker_data',
        'groomingData_v2',
        'lensesStartTime',
        'lensesHistory',
        'lensStock',
        'lensDate',
        'solutionDate',
        'caseDate',
        'systaneDate',
        'clothWashDate',
        'clothChangeDate',
        'health_medical_data',
        'health_blood_tests',
        'vehicle_odometer',
        'vehicle_maintenance_log',
        'gym_records',
        'gym_routine',
        'gym_routine_focus',
        'gym_sessions',
        'gym_active_session',
        'gym_meals',
        'gym_general_meals',
        'gym_supplements',
        'gym_weight',
        'projectPulseData',
        'projectPulseHistory',
        'projectPulseSubscription',
        'lifecycle_subscriptions',
        'projectPulseTemplates',
        'alerts_config',
        'finanzasData',
        'vehicle_tracker_data',
        'vehicle_issues',
        'tareas_list',
        'tareas_categories',
        'tareas_pinned_projects',
        'tareas_pinned_project_ids',
        'tareas_removed_project_ids'
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

    select candidate.key
    into v_invalid_key
    from jsonb_object_keys(p_updates) as candidate(key)
    where not (candidate.key = any(v_allowed_keys))
    limit 1;

    if v_invalid_key is not null then
        raise exception 'Unsupported user_data key: %', v_invalid_key
            using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct candidate.key), '{}'::text[])
    into v_delete_keys
    from unnest(coalesce(p_delete_keys, '{}'::text[])) as candidate(key)
    where candidate.key is not null and btrim(candidate.key) <> '';

    select candidate.key
    into v_invalid_key
    from unnest(v_delete_keys) as candidate(key)
    where not (candidate.key = any(v_allowed_keys))
    limit 1;

    if v_invalid_key is not null then
        raise exception 'Unsupported user_data key: %', v_invalid_key
            using errcode = '22023';
    end if;

    insert into public.user_data as target (user_id, data, updated_at)
    values (v_user_id, p_updates, now())
    on conflict (user_id) do update
    set
        data = (coalesce(target.data, '{}'::jsonb) - v_delete_keys) || excluded.data,
        updated_at = now()
    -- An identical save must not emit a full-document Realtime UPDATE.
    -- The conflict row is locked before this comparison, so concurrent writes
    -- still merge into the latest row instead of a stale client snapshot.
    where target.data is distinct from (
        (coalesce(target.data, '{}'::jsonb) - v_delete_keys) || excluded.data
    )
    returning updated_at into v_updated_at;

    if v_updated_at is null then
        -- Preserve the timestamptz contract for older installed PWAs on a no-op.
        select row_data.updated_at into v_updated_at
        from public.user_data as row_data
        where row_data.user_id = v_user_id;
    end if;

    return v_updated_at;
end;
$$;

revoke all on function public.merge_user_data_keys(jsonb, text[])
from public, anon, service_role;
grant execute on function public.merge_user_data_keys(jsonb, text[])
to authenticated;
