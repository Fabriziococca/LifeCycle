-- Enforce the first synchronized resource quotas (modules, configurable cards
-- and reminders). Client checks provide UX; this trigger is the
-- non-bypassable guard.

set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function private.enforce_lifecycle_user_document_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_access_tier text;
    v_document_limit_bytes bigint;
    v_module_limit bigint;
    v_tracker_limit bigint;
    v_reminder_limit bigint;
    v_document_bytes bigint;
    v_hygiene_stored jsonb;
    v_hygiene_data jsonb;
    v_tracker_registry jsonb;
    v_custom_modules jsonb;
    v_tracker_cards jsonb;
    v_module_count bigint := 0;
    v_tracker_count bigint := 0;
    v_alerts_stored jsonb;
    v_alerts_data jsonb;
    v_reminder_registry jsonb;
    v_reminders jsonb;
    v_reminder_count bigint := 0;
begin
    select profile.access_tier
    into v_access_tier
    from private.lifecycle_access_profiles as profile
    where profile.user_id = new.user_id;

    v_access_tier := coalesce(v_access_tier, 'friend');

    if v_access_tier = 'owner' then
        return new;
    end if;

    select
        max(limit_row.limit_value) filter (
            where limit_row.resource_key = 'synced_document_bytes'
              and limit_row.limit_unit = 'bytes'
        ),
        max(limit_row.limit_value) filter (
            where limit_row.resource_key = 'custom_modules'
              and limit_row.limit_unit = 'count'
        ),
        max(limit_row.limit_value) filter (
            where limit_row.resource_key = 'tracker_cards'
              and limit_row.limit_unit = 'count'
        ),
        max(limit_row.limit_value) filter (
            where limit_row.resource_key = 'reminders'
              and limit_row.limit_unit = 'count'
        )
    into
        v_document_limit_bytes,
        v_module_limit,
        v_tracker_limit,
        v_reminder_limit
    from private.lifecycle_resource_limits as limit_row
    where limit_row.access_tier = v_access_tier;

    -- Fail closed with the same generous defaults used by the client.
    v_document_limit_bytes := coalesce(v_document_limit_bytes, 5242880);
    v_module_limit := coalesce(v_module_limit, 30);
    v_tracker_limit := coalesce(v_tracker_limit, 500);
    v_reminder_limit := coalesce(v_reminder_limit, 500);
    v_document_bytes := octet_length(
        convert_to(coalesce(new.data, '{}'::jsonb)::text, 'UTF8')
    );

    if v_document_bytes > v_document_limit_bytes then
        raise exception 'LifeCycle synchronized data limit exceeded'
            using
                errcode = '54000',
                detail = format(
                    'resource_key=synced_document_bytes current=%s limit=%s',
                    v_document_bytes,
                    v_document_limit_bytes
                ),
                hint = 'Reduce synchronized content before trying again.';
    end if;

    v_hygiene_stored := new.data -> 'hygiene_tracker_data';
    if v_hygiene_stored is not null
       and jsonb_typeof(v_hygiene_stored) <> 'null' then
        begin
            v_hygiene_data := case
                when jsonb_typeof(v_hygiene_stored) = 'string'
                    then (v_hygiene_stored #>> '{}')::jsonb
                else v_hygiene_stored
            end;
        exception
            when others then
                raise exception 'LifeCycle tracker data is invalid'
                    using
                        errcode = '22023',
                        hint = 'Synchronize a valid hygiene_tracker_data JSON value.';
        end;

        if jsonb_typeof(v_hygiene_data) <> 'object' then
            raise exception 'LifeCycle tracker data is invalid'
                using errcode = '22023';
        end if;

        v_tracker_registry := v_hygiene_data -> '__trackers_v2';
        if v_tracker_registry is not null
           and jsonb_typeof(v_tracker_registry) <> 'null' then
            if jsonb_typeof(v_tracker_registry) <> 'object' then
                raise exception 'LifeCycle tracker registry is invalid'
                    using errcode = '22023';
            end if;

            v_custom_modules := coalesce(
                v_tracker_registry -> 'customModules',
                '[]'::jsonb
            );
            v_tracker_cards := coalesce(
                v_tracker_registry -> 'trackers',
                '[]'::jsonb
            );
            if jsonb_typeof(v_custom_modules) <> 'array'
               or jsonb_typeof(v_tracker_cards) <> 'array' then
                raise exception 'LifeCycle tracker registry arrays are invalid'
                    using errcode = '22023';
            end if;

            v_module_count := jsonb_array_length(v_custom_modules);
            v_tracker_count := jsonb_array_length(v_tracker_cards);

            if v_module_count > v_module_limit then
                raise exception 'LifeCycle resource limit exceeded'
                    using
                        errcode = '54000',
                        detail = format(
                            'resource_key=custom_modules current=%s limit=%s',
                            v_module_count,
                            v_module_limit
                        ),
                        hint = 'Permanently delete an archived custom module before retrying.';
            end if;

            if v_tracker_count > v_tracker_limit then
                raise exception 'LifeCycle resource limit exceeded'
                    using
                        errcode = '54000',
                        detail = format(
                            'resource_key=tracker_cards current=%s limit=%s',
                            v_tracker_count,
                            v_tracker_limit
                        ),
                        hint = 'Permanently delete an archived tracker card before retrying.';
            end if;
        end if;
    end if;

    v_alerts_stored := new.data -> 'alerts_config';
    if v_alerts_stored is not null
       and jsonb_typeof(v_alerts_stored) <> 'null' then
        begin
            v_alerts_data := case
                when jsonb_typeof(v_alerts_stored) = 'string'
                    then (v_alerts_stored #>> '{}')::jsonb
                else v_alerts_stored
            end;
        exception
            when others then
                raise exception 'LifeCycle reminder data is invalid'
                    using
                        errcode = '22023',
                        hint = 'Synchronize a valid alerts_config JSON value.';
        end;

        if jsonb_typeof(v_alerts_data) <> 'object' then
            raise exception 'LifeCycle reminder data is invalid'
                using errcode = '22023';
        end if;

        v_reminder_registry := v_alerts_data -> '__recurring_reminders';
        if v_reminder_registry is not null
           and jsonb_typeof(v_reminder_registry) <> 'null' then
            if jsonb_typeof(v_reminder_registry) <> 'object' then
                raise exception 'LifeCycle reminder registry is invalid'
                    using errcode = '22023';
            end if;

            v_reminders := coalesce(
                v_reminder_registry -> 'reminders',
                '[]'::jsonb
            );
            if jsonb_typeof(v_reminders) <> 'array' then
                raise exception 'LifeCycle reminder registry array is invalid'
                    using errcode = '22023';
            end if;

            v_reminder_count := jsonb_array_length(v_reminders);
            if v_reminder_count > v_reminder_limit then
                raise exception 'LifeCycle resource limit exceeded'
                    using
                        errcode = '54000',
                        detail = format(
                            'resource_key=reminders current=%s limit=%s',
                            v_reminder_count,
                            v_reminder_limit
                        ),
                        hint = 'Delete a reminder before retrying.';
            end if;
        end if;
    end if;

    return new;
end;
$$;

revoke all on function private.enforce_lifecycle_user_document_limit()
from public, anon, authenticated, service_role;

comment on function private.enforce_lifecycle_user_document_limit() is
    'Rejects oversized synchronized documents, tracker resources and reminders for bounded users; owner is unlimited.';
