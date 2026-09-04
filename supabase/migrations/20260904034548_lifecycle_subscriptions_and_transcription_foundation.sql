-- Phase C: synchronize subscriptions as a first-class resource and make linked
-- finance writes idempotent across devices. Transcription tables intentionally
-- live in a separate migration so this boundary can be verified independently.

set lock_timeout = '5s';
set statement_timeout = '30s';

insert into private.lifecycle_resource_limits (
    access_tier,
    resource_key,
    limit_value,
    limit_unit,
    description
)
values ('friend', 'subscriptions', 500, 'count', 'Suscripciones')
on conflict (access_tier, resource_key) do update
set
    limit_value = excluded.limit_value,
    limit_unit = excluded.limit_unit,
    description = excluded.description,
    updated_at = now();

-- Keep this allowlist aligned with sync-config.mjs. Values remain strings on
-- purpose because they are restored directly into localStorage by the client.
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
    returning updated_at into v_updated_at;

    return v_updated_at;
end;
$$;

revoke all on function public.merge_user_data_keys(jsonb, text[])
from public, anon, service_role;
grant execute on function public.merge_user_data_keys(jsonb, text[])
to authenticated;

create or replace function private.enforce_lifecycle_subscription_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_access_tier text;
    v_registry jsonb;
    v_subscriptions jsonb;
    v_current bigint;
    v_limit bigint;
begin
    select profile.access_tier
    into v_access_tier
    from private.lifecycle_access_profiles as profile
    where profile.user_id = new.user_id;

    v_access_tier := coalesce(v_access_tier, 'friend');
    if v_access_tier = 'owner' then
        return new;
    end if;

    v_registry := private.lifecycle_stored_json(
        new.data,
        'lifecycle_subscriptions',
        'object',
        '{"version":2,"subscriptions":[]}'::jsonb
    );
    v_subscriptions := private.lifecycle_json_array(
        v_registry -> 'subscriptions',
        'lifecycle_subscriptions.subscriptions'
    );
    v_current := jsonb_array_length(v_subscriptions);

    select limit_row.limit_value
    into v_limit
    from private.lifecycle_resource_limits as limit_row
    where limit_row.access_tier = v_access_tier
      and limit_row.resource_key = 'subscriptions';
    v_limit := coalesce(v_limit, 500);

    if v_current > v_limit then
        raise exception 'LifeCycle resource limit exceeded'
            using
                errcode = '54000',
                detail = format(
                    'resource_key=subscriptions current=%s limit=%s',
                    v_current,
                    v_limit
                ),
                hint = 'Reduce this resource before trying again.';
    end if;

    return new;
end;
$$;

revoke all on function private.enforce_lifecycle_subscription_limit()
from public, anon, authenticated, service_role;

drop trigger if exists user_data_subscription_limit_before_write
on public.user_data;
create trigger user_data_subscription_limit_before_write
before insert or update of data on public.user_data
for each row
execute function private.enforce_lifecycle_subscription_limit();

-- One row lock protects the read/check/append sequence. The stable occurrence
-- key is the cross-device idempotency boundary for each billing period.
create or replace function public.record_subscription_expense(
    p_subscription_id text,
    p_subscription_name text,
    p_amount_usd numeric,
    p_expense_date date,
    p_occurrence_key text,
    p_period text default 'Renovación',
    p_automatic boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_document jsonb;
    v_stored jsonb;
    v_finances jsonb;
    v_expenses jsonb;
    v_expense_id text;
    v_duplicate boolean;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '28000';
    end if;
    if p_subscription_id is null
       or p_subscription_id !~ '^[A-Za-z0-9_-]{1,120}$'
       or nullif(btrim(p_subscription_name), '') is null
       or char_length(p_subscription_name) > 160
       or p_amount_usd is null
       or p_amount_usd <= 0
       or p_amount_usd > 1000000000
       or p_expense_date is null
       or nullif(btrim(p_occurrence_key), '') is null
       or char_length(p_occurrence_key) > 180
       or char_length(coalesce(p_period, '')) > 120 then
        raise exception 'Invalid subscription expense payload'
            using errcode = '22023';
    end if;

    insert into public.user_data (user_id, data, updated_at)
    values (v_user_id, '{}'::jsonb, now())
    on conflict (user_id) do nothing;

    select coalesce(row_data.data, '{}'::jsonb)
    into v_document
    from public.user_data as row_data
    where row_data.user_id = v_user_id
    for update;

    v_stored := v_document -> 'finanzasData';
    if v_stored is null or jsonb_typeof(v_stored) = 'null' then
        v_finances := '{"entries":[],"expenses":[],"recurringRules":[],"tradingEvents":[]}'::jsonb;
    else
        begin
            v_finances := case
                when jsonb_typeof(v_stored) = 'string'
                    then (v_stored #>> '{}')::jsonb
                else v_stored
            end;
        exception
            when others then
                raise exception 'finanzasData contains invalid JSON'
                    using errcode = '22023';
        end;
    end if;

    if jsonb_typeof(v_finances) <> 'object' then
        raise exception 'finanzasData must be a JSON object'
            using errcode = '22023';
    end if;
    v_expenses := coalesce(v_finances -> 'expenses', '[]'::jsonb);
    if jsonb_typeof(v_expenses) <> 'array' then
        raise exception 'finanzasData.expenses must be a JSON array'
            using errcode = '22023';
    end if;

    select exists (
        select 1
        from jsonb_array_elements(v_expenses) as expense(value)
        where expense.value ->> 'subscriptionOccurrenceKey' = p_occurrence_key
           or (
               not (expense.value ? 'subscriptionOccurrenceKey')
               and expense.value ->> 'subscriptionId' = p_subscription_id
               and expense.value ->> 'date' = p_expense_date::text
           )
    ) into v_duplicate;

    if v_duplicate then
        return jsonb_build_object(
            'created', false,
            'duplicate', true,
            'finance_data', v_finances
        );
    end if;

    v_expense_id := format(
        'subexpense_%s_%s',
        regexp_replace(p_subscription_id, '[^A-Za-z0-9_-]', '_', 'g'),
        p_expense_date::text
    );
    v_expenses := v_expenses || jsonb_build_array(jsonb_build_object(
        'id', v_expense_id,
        'category', 'servicios',
        'date', p_expense_date::text,
        'amount', round(p_amount_usd, 2),
        'description', format(
            '[Suscripción: %s] %s',
            btrim(p_subscription_name),
            coalesce(nullif(btrim(p_period), ''), 'Renovación')
        ),
        'subscriptionId', p_subscription_id,
        'subscriptionOccurrenceKey', p_occurrence_key,
        'autoRecorded', p_automatic
    ));
    v_finances := jsonb_set(v_finances, '{expenses}', v_expenses, true);
    v_document := jsonb_set(
        v_document,
        '{finanzasData}',
        to_jsonb(v_finances::text),
        true
    );

    update public.user_data
    set data = v_document,
        updated_at = now()
    where user_id = v_user_id;

    return jsonb_build_object(
        'created', true,
        'duplicate', false,
        'finance_data', v_finances
    );
end;
$$;

revoke all on function public.record_subscription_expense(
    text, text, numeric, date, text, text, boolean
) from public, anon, service_role;
grant execute on function public.record_subscription_expense(
    text, text, numeric, date, text, text, boolean
) to authenticated;

comment on function public.record_subscription_expense(
    text, text, numeric, date, text, text, boolean
) is 'Atomically records at most one finance expense per subscription billing occurrence.';
