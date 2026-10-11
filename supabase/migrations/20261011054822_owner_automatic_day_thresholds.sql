-- Owner explicitly requested existing day-based cards at 70% / 85%.
-- Data-only, one-time operation. Never changes history, due periods, pauses,
-- alerts, unrelated document keys or other accounts. Future manual edits remain
-- available; no trigger or recurring enforcement is installed.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $migration$
declare
    v_owner_count integer;
    v_owner uuid;
    v_document jsonb;
    v_hygiene jsonb;
    v_was_string boolean;
    v_registry jsonb;
    v_cards jsonb;
    v_card jsonb;
    v_updated jsonb;
    v_red integer;
    v_changed integer := 0;
begin
    select count(*) into v_owner_count
    from private.lifecycle_access_profiles where access_tier = 'owner';
    -- Fresh installations have no owner's existing cards to convert.
    if v_owner_count = 0 then return; end if;
    if v_owner_count <> 1 then
        raise exception 'Expected one owner account; no data changed';
    end if;
    select user_id into v_owner
    from private.lifecycle_access_profiles where access_tier = 'owner';
    select data into v_document
    from public.user_data where user_id = v_owner for update;
    if not found or v_document->'hygiene_tracker_data' is null then return; end if;
    v_was_string := jsonb_typeof(v_document->'hygiene_tracker_data') = 'string';
    v_hygiene := case when v_was_string then (v_document->>'hygiene_tracker_data')::jsonb
        else v_document->'hygiene_tracker_data' end;
    v_registry := v_hygiene->'__trackers_v2';
    if v_registry is null then return; end if;
    if jsonb_typeof(v_registry->'trackers') <> 'array' then
        raise exception 'Tracker registry is not an array; no data changed';
    end if;
    v_cards := '[]'::jsonb;
    for v_card in select value from jsonb_array_elements(v_registry->'trackers') loop
        v_updated := v_card;
        if coalesce(v_card->>'template', 'routine') <> 'state-reminder'
           and coalesce(v_card#>>'{cadence,unit}', 'days') = 'days'
           and coalesce(v_card->>'deleted', 'false') <> 'true' then
            v_red := coalesce((v_card#>>'{thresholds,red}')::integer,
                (v_card->>'intervalDays')::integer, (v_card#>>'{cadence,value}')::integer);
            if v_red is null or v_red < 1 or v_red > 3650 then
                raise exception 'Invalid due period; no data changed';
            end if;
            v_updated := jsonb_set(v_card, '{thresholds}',
                coalesce(v_card->'thresholds', '{}'::jsonb) || jsonb_build_object(
                    'mode', 'automatic',
                    'yellow', greatest(1, floor(v_red * 0.70)::integer),
                    'orange', greatest(1, floor(v_red * 0.85)::integer)));
            if v_updated is distinct from v_card then
                v_updated := jsonb_set(v_updated, '{updatedAt}', to_jsonb(
                    to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
                v_changed := v_changed + 1;
            end if;
            -- Reject rather than silently adjust any definition of expiry.
            if v_updated->'cadence' is distinct from v_card->'cadence'
               or v_updated->'intervalDays' is distinct from v_card->'intervalDays'
               or v_updated#>'{thresholds,red}' is distinct from v_card#>'{thresholds,red}' then
                raise exception 'Due period preservation failed; no data changed';
            end if;
        end if;
        v_cards := v_cards || jsonb_build_array(v_updated);
    end loop;
    if v_changed = 0 then return; end if;
    v_hygiene := jsonb_set(v_hygiene, '{__trackers_v2,trackers}', v_cards);
    update public.user_data
    set data = jsonb_set(v_document, '{hygiene_tracker_data}',
            case when v_was_string then to_jsonb(v_hygiene::text) else v_hygiene end),
        updated_at = now()
    where user_id = v_owner;
    raise notice 'Converted % existing day cards to automatic thresholds', v_changed;
end;
$migration$;
