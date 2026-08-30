-- Enforce every bounded LifeCycle collection at the authoritative synchronized
-- document boundary. UI checks improve feedback; this trigger prevents bypasses
-- through backups, stale clients or direct RPC calls.

set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function private.lifecycle_stored_json(
    p_document jsonb,
    p_key text,
    p_expected_type text,
    p_default jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
    v_stored jsonb;
    v_value jsonb;
begin
    v_stored := coalesce(p_document, '{}'::jsonb) -> p_key;
    if v_stored is null or jsonb_typeof(v_stored) = 'null' then
        return p_default;
    end if;

    begin
        v_value := case
            when jsonb_typeof(v_stored) = 'string'
                then (v_stored #>> '{}')::jsonb
            else v_stored
        end;
    exception
        when others then
            raise exception 'LifeCycle synchronized value is invalid: %', p_key
                using
                    errcode = '22023',
                    hint = format('Synchronize a valid %s JSON value.', p_key);
    end;

    if jsonb_typeof(v_value) <> p_expected_type then
        raise exception 'LifeCycle synchronized value has an invalid type: %', p_key
            using
                errcode = '22023',
                detail = format(
                    'key=%s expected=%s current=%s',
                    p_key,
                    p_expected_type,
                    coalesce(jsonb_typeof(v_value), 'null')
                );
    end if;

    return v_value;
end;
$$;

revoke all on function private.lifecycle_stored_json(jsonb, text, text, jsonb)
from public, anon, authenticated, service_role;

create or replace function private.lifecycle_json_array(
    p_value jsonb,
    p_context text
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
begin
    if p_value is null or jsonb_typeof(p_value) = 'null' then
        return '[]'::jsonb;
    end if;
    if jsonb_typeof(p_value) <> 'array' then
        raise exception 'LifeCycle synchronized collection is invalid: %', p_context
            using errcode = '22023';
    end if;
    return p_value;
end;
$$;

revoke all on function private.lifecycle_json_array(jsonb, text)
from public, anon, authenticated, service_role;

create or replace function private.enforce_lifecycle_user_document_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_access_tier text;
    v_limits jsonb := jsonb_build_object(
        'synced_document_bytes', 5242880,
        'custom_modules', 30,
        'tracker_cards', 500,
        'reminders', 500,
        'tasks', 5000,
        'projects', 500,
        'project_templates', 100,
        'finance_transactions', 25000,
        'finance_recurring_rules', 500,
        'trading_events', 1000,
        'gym_routine_exercises', 1000,
        'gym_meal_templates', 1000,
        'gym_supplements', 500,
        'vehicle_issues', 2000,
        'blood_test_files', 1000
    );
    v_configured_limits jsonb;
    v_counts jsonb;
    v_document_bytes bigint;
    v_document_limit bigint;
    v_resource_key text;
    v_current bigint;
    v_limit bigint;
    v_hygiene jsonb;
    v_tracker_registry jsonb;
    v_custom_modules jsonb;
    v_tracker_cards jsonb;
    v_alerts jsonb;
    v_reminder_registry jsonb;
    v_reminders jsonb;
    v_tasks jsonb;
    v_projects jsonb;
    v_project_history jsonb;
    v_template_registry jsonb;
    v_templates jsonb;
    v_finances jsonb;
    v_income_entries jsonb;
    v_expense_entries jsonb;
    v_recurring_rules jsonb;
    v_trading_events jsonb;
    v_routine jsonb;
    v_meals jsonb;
    v_fixed_meals jsonb;
    v_general_meals jsonb;
    v_supplements jsonb;
    v_vitamin_history jsonb;
    v_painkiller_history jsonb;
    v_vehicle_issues jsonb;
    v_blood_tests jsonb;
    v_project_task_count bigint := 0;
    v_history_task_count bigint := 0;
    v_tracker_count bigint := 0;
    v_blood_file_count bigint := 0;
begin
    if jsonb_typeof(coalesce(new.data, '{}'::jsonb)) <> 'object' then
        raise exception 'LifeCycle synchronized document must be a JSON object'
            using errcode = '22023';
    end if;

    select profile.access_tier
    into v_access_tier
    from private.lifecycle_access_profiles as profile
    where profile.user_id = new.user_id;

    v_access_tier := coalesce(v_access_tier, 'friend');
    if v_access_tier = 'owner' then
        return new;
    end if;

    select coalesce(
        jsonb_object_agg(limit_row.resource_key, limit_row.limit_value),
        '{}'::jsonb
    )
    into v_configured_limits
    from private.lifecycle_resource_limits as limit_row
    where limit_row.access_tier = v_access_tier;
    v_limits := v_limits || v_configured_limits;

    v_document_bytes := octet_length(
        convert_to(coalesce(new.data, '{}'::jsonb)::text, 'UTF8')
    );
    v_document_limit := (v_limits ->> 'synced_document_bytes')::bigint;
    if v_document_bytes > v_document_limit then
        raise exception 'LifeCycle synchronized data limit exceeded'
            using
                errcode = '54000',
                detail = format(
                    'resource_key=synced_document_bytes current=%s limit=%s',
                    v_document_bytes,
                    v_document_limit
                ),
                hint = 'Reduce synchronized content before trying again.';
    end if;

    v_hygiene := private.lifecycle_stored_json(
        new.data, 'hygiene_tracker_data', 'object', '{}'::jsonb
    );
    v_tracker_registry := coalesce(v_hygiene -> '__trackers_v2', '{}'::jsonb);
    if jsonb_typeof(v_tracker_registry) <> 'object' then
        raise exception 'LifeCycle tracker registry is invalid'
            using errcode = '22023';
    end if;
    v_custom_modules := private.lifecycle_json_array(
        v_tracker_registry -> 'customModules',
        'hygiene_tracker_data.__trackers_v2.customModules'
    );
    v_tracker_cards := private.lifecycle_json_array(
        v_tracker_registry -> 'trackers',
        'hygiene_tracker_data.__trackers_v2.trackers'
    );
    select count(*)
    into v_tracker_count
    from jsonb_array_elements(v_tracker_cards) as tracker(value)
    where coalesce(tracker.value ->> 'deleted', 'false') <> 'true';

    v_alerts := private.lifecycle_stored_json(
        new.data, 'alerts_config', 'object', '{}'::jsonb
    );
    v_reminder_registry := coalesce(
        v_alerts -> '__recurring_reminders',
        '{}'::jsonb
    );
    if jsonb_typeof(v_reminder_registry) <> 'object' then
        raise exception 'LifeCycle reminder registry is invalid'
            using errcode = '22023';
    end if;
    v_reminders := private.lifecycle_json_array(
        v_reminder_registry -> 'reminders',
        'alerts_config.__recurring_reminders.reminders'
    );

    v_tasks := private.lifecycle_stored_json(
        new.data, 'tareas_list', 'array', '[]'::jsonb
    );
    v_projects := private.lifecycle_stored_json(
        new.data, 'projectPulseData', 'array', '[]'::jsonb
    );
    v_project_history := private.lifecycle_stored_json(
        new.data, 'projectPulseHistory', 'array', '[]'::jsonb
    );
    if exists (
        select 1
        from jsonb_array_elements(v_projects) as project(value)
        where project.value ? 'tasks'
          and jsonb_typeof(project.value -> 'tasks') <> 'array'
    ) or exists (
        select 1
        from jsonb_array_elements(v_project_history) as project(value)
        where project.value ? 'tasks'
          and jsonb_typeof(project.value -> 'tasks') <> 'array'
    ) then
        raise exception 'LifeCycle project tasks are invalid'
            using errcode = '22023';
    end if;
    select coalesce(sum(jsonb_array_length(coalesce(project.value -> 'tasks', '[]'::jsonb))), 0)
    into v_project_task_count
    from jsonb_array_elements(v_projects) as project(value);
    select coalesce(sum(jsonb_array_length(coalesce(project.value -> 'tasks', '[]'::jsonb))), 0)
    into v_history_task_count
    from jsonb_array_elements(v_project_history) as project(value);

    v_template_registry := private.lifecycle_stored_json(
        new.data, 'projectPulseTemplates', 'object', '{}'::jsonb
    );
    v_templates := private.lifecycle_json_array(
        v_template_registry -> 'templates',
        'projectPulseTemplates.templates'
    );

    v_finances := private.lifecycle_stored_json(
        new.data, 'finanzasData', 'object', '{}'::jsonb
    );
    v_income_entries := private.lifecycle_json_array(
        v_finances -> 'entries', 'finanzasData.entries'
    );
    v_expense_entries := private.lifecycle_json_array(
        v_finances -> 'expenses', 'finanzasData.expenses'
    );
    v_recurring_rules := private.lifecycle_json_array(
        v_finances -> 'recurringRules', 'finanzasData.recurringRules'
    );
    v_trading_events := private.lifecycle_json_array(
        v_finances -> 'tradingEvents', 'finanzasData.tradingEvents'
    );

    v_routine := private.lifecycle_stored_json(
        new.data, 'gym_routine', 'array', '[]'::jsonb
    );
    v_meals := private.lifecycle_stored_json(
        new.data, 'gym_meals', 'object', '{}'::jsonb
    );
    v_fixed_meals := private.lifecycle_json_array(
        v_meals -> 'fixed', 'gym_meals.fixed'
    );
    v_general_meals := private.lifecycle_stored_json(
        new.data, 'gym_general_meals', 'array', '[]'::jsonb
    );
    v_supplements := private.lifecycle_stored_json(
        new.data, 'gym_supplements', 'object', '{}'::jsonb
    );
    v_vitamin_history := private.lifecycle_json_array(
        v_supplements -> 'vit_d_history', 'gym_supplements.vit_d_history'
    );
    v_painkiller_history := private.lifecycle_json_array(
        v_supplements -> 'painkillers_history', 'gym_supplements.painkillers_history'
    );

    v_vehicle_issues := private.lifecycle_stored_json(
        new.data, 'vehicle_issues', 'array', '[]'::jsonb
    );
    v_blood_tests := private.lifecycle_stored_json(
        new.data, 'health_blood_tests', 'array', '[]'::jsonb
    );
    select count(*)
    into v_blood_file_count
    from jsonb_array_elements(v_blood_tests) as study(value)
    where nullif(btrim(study.value ->> 'storagePath'), '') is not null
       or nullif(btrim(study.value ->> 'fileData'), '') is not null
       or nullif(btrim(study.value ->> 'pdfUrl'), '') is not null;

    v_counts := jsonb_build_object(
        'custom_modules', jsonb_array_length(v_custom_modules),
        'tracker_cards', v_tracker_count,
        'reminders', jsonb_array_length(v_reminders),
        'tasks', jsonb_array_length(v_tasks) + v_project_task_count + v_history_task_count,
        'projects', jsonb_array_length(v_projects) + jsonb_array_length(v_project_history),
        'project_templates', jsonb_array_length(v_templates),
        'finance_transactions', jsonb_array_length(v_income_entries) + jsonb_array_length(v_expense_entries),
        'finance_recurring_rules', jsonb_array_length(v_recurring_rules),
        'trading_events', jsonb_array_length(v_trading_events),
        'gym_routine_exercises', jsonb_array_length(v_routine),
        'gym_meal_templates', jsonb_array_length(v_fixed_meals) + jsonb_array_length(v_general_meals),
        'gym_supplements', jsonb_array_length(v_vitamin_history) + jsonb_array_length(v_painkiller_history),
        'vehicle_issues', jsonb_array_length(v_vehicle_issues),
        'blood_test_files', v_blood_file_count
    );

    for v_resource_key, v_current in
        select item.key, item.value::bigint
        from jsonb_each_text(v_counts) as item(key, value)
    loop
        v_limit := (v_limits ->> v_resource_key)::bigint;
        if v_current > v_limit then
            raise exception 'LifeCycle resource limit exceeded'
                using
                    errcode = '54000',
                    detail = format(
                        'resource_key=%s current=%s limit=%s',
                        v_resource_key,
                        v_current,
                        v_limit
                    ),
                    hint = 'Reduce this resource before trying again.';
        end if;
    end loop;

    return new;
end;
$$;

revoke all on function private.enforce_lifecycle_user_document_limit()
from public, anon, authenticated, service_role;

comment on function private.enforce_lifecycle_user_document_limit() is
    'Rejects oversized synchronized documents and every bounded LifeCycle collection; owner is unlimited.';
