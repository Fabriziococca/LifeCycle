-- Additive charging records; no changes to existing cards, money or reminders.
set lock_timeout = '5s';
set statement_timeout = '30s';
create function private.guard_lifecycle_charging()
returns trigger language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare v jsonb; old_v jsonb; d jsonb; s jsonb; ids text[]:='{}'; session_ids text[]:='{}'; active_count integer; total_count integer:=0;
begin
 v:=new.data->'lifecycle_charging';
 if tg_op='INSERT' then
  if v is null then return new; end if;
  select data->'lifecycle_charging' into old_v from public.user_data where user_id=new.user_id for update;
 else old_v:=old.data->'lifecycle_charging'; end if;
 if v is not distinct from old_v then return new; end if;
 if v is null then raise exception 'Charging must be cleared with an explicit versioned workspace' using errcode='22023'; end if;
 if jsonb_typeof(v)='string' then v:=(v#>>'{}')::jsonb; end if;
 if jsonb_typeof(old_v)='string' then old_v:=(old_v#>>'{}')::jsonb; end if;
 if v is not distinct from old_v then return new; end if;
 if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'version') is distinct from 'number' or v->>'version' is distinct from '1'
    or jsonb_typeof(v->'revision') is distinct from 'number'
    or (v->>'revision')::bigint is distinct from coalesce((old_v->>'revision')::bigint,0)+1 then
  raise exception 'Charging revision conflict: refresh before saving' using errcode='40001'; end if;
 if octet_length(v::text)>2000000 or jsonb_typeof(v->'devices') is distinct from 'array' or jsonb_array_length(v->'devices')>100 then raise exception 'Invalid charging devices'; end if;
 for d in select value from jsonb_array_elements(v->'devices') loop
  if coalesce(d->>'id','')!~'^cd_[a-zA-Z0-9-]{3,90}$' or (d->>'id')=any(ids)
   or length(btrim(coalesce(d->>'name',''))) not between 1 and 120 or jsonb_typeof(d->'name') is distinct from 'string'
   or jsonb_typeof(d->'archived') is distinct from 'boolean' or jsonb_typeof(d->'deleted') is distinct from 'boolean'
   or jsonb_typeof(d->'paused') is distinct from 'boolean' or jsonb_typeof(d->'notify') is distinct from 'boolean'
   or jsonb_typeof(d->'repeatMinutes') is distinct from 'number' or coalesce(d->>'repeatMinutes','') not in ('0','30','60')
   or ((d->>'deleted')::boolean and not (d->>'archived')::boolean)
   or not(d ? 'maxMinutes') or (d->'maxMinutes'<>'null'::jsonb and (jsonb_typeof(d->'maxMinutes') is distinct from 'number' or coalesce(d->>'maxMinutes','')!~'^\d+$' or (d->>'maxMinutes')::integer not between 1 and 10080))
   or coalesce(d->>'createdAt','')!~'^\d{4}-\d\d-\d\dT'
   or jsonb_typeof(d->'sessions') is distinct from 'array' or jsonb_array_length(d->'sessions')>2000 then raise exception 'Invalid charging device'; end if;
  perform (d->>'createdAt')::timestamptz;
  ids:=array_append(ids,d->>'id');active_count:=0;total_count:=total_count+jsonb_array_length(d->'sessions');
  for s in select value from jsonb_array_elements(d->'sessions') loop
   if coalesce(s->>'id','')!~'^cs_[a-zA-Z0-9-]{3,90}$' or (s->>'id')=any(session_ids)
    or coalesce(s->>'startedAt','')!~'^\d{4}-\d\d-\d\dT' or not(s ? 'finishedAt') or not(s ? 'limitMinutes')
    or (s->'limitMinutes'<>'null'::jsonb and (jsonb_typeof(s->'limitMinutes') is distinct from 'number' or coalesce(s->>'limitMinutes','')!~'^\d+$' or (s->>'limitMinutes')::integer not between 1 and 10080)) then raise exception 'Invalid charging session'; end if;
   perform (s->>'startedAt')::timestamptz;
   session_ids:=array_append(session_ids,s->>'id');
   if s->'finishedAt'='null'::jsonb then active_count:=active_count+1;
   elsif coalesce(s->>'finishedAt','')!~'^\d{4}-\d\d-\d\dT' or (s->>'finishedAt')::timestamptz<(s->>'startedAt')::timestamptz then raise exception 'Invalid charging finish'; end if;
  end loop;
  if active_count>1 or (active_count>0 and (d->>'archived')::boolean) then raise exception 'Charging device is still connected'; end if;
 end loop;
 if total_count>10000 then raise exception 'Charging history too large'; end if;
 return new;
end;
$$;
revoke all on function private.guard_lifecycle_charging() from public,anon,authenticated,service_role;
create trigger guard_lifecycle_charging before insert or update on public.user_data
 for each row execute function private.guard_lifecycle_charging();

create or replace function public.save_lifecycle_planning(p_key text, p_expected_revision bigint, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare uid uuid:=auth.uid(); current_value jsonb; actual_revision bigint; result_revision bigint;
begin
    if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
    if p_key is null or p_key not in ('lifecycle_saylor','lifecycle_faculty','lifecycle_charging') or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid workspace' using errcode='22023'; end if;
    insert into public.user_data(user_id,data) values(uid,'{}'::jsonb) on conflict(user_id) do nothing;
    select data->p_key into current_value from public.user_data where user_id=uid for update;
    if jsonb_typeof(current_value)='string' then current_value:=(current_value#>>'{}')::jsonb; end if;
    if current_value = p_value then
        select revision into result_revision from public.user_data where user_id=uid;
        return jsonb_build_object('workspace',current_value,'documentRevision',result_revision);
    end if;
    actual_revision:=coalesce((current_value->>'revision')::bigint,0);
    if actual_revision<>p_expected_revision or (p_value->>'revision')::bigint is distinct from p_expected_revision+1 then raise exception 'Planning revision conflict' using errcode='40001'; end if;
    update public.user_data set data=jsonb_set(coalesce(data,'{}'),array[p_key],p_value),updated_at=now() where user_id=uid returning revision into result_revision;
    return jsonb_build_object('workspace',p_value,'documentRevision',result_revision);
end;
$$;
revoke all on function public.save_lifecycle_planning(text,bigint,jsonb) from public,anon,service_role;
grant execute on function public.save_lifecycle_planning(text,bigint,jsonb) to authenticated;


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
        'lifecycle_charging',
        'lifecycle_saylor',
        'lifecycle_faculty',
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

-- Two explicitly requested owner devices. No fabricated charge sessions; QA
-- and other accounts remain empty. The 180-minute value is user supplied.
do $seed$
declare uid uuid; owners integer; stamp text;
begin
 select count(*) into owners from private.lifecycle_access_profiles where access_tier='owner';
 if owners=0 then return; end if;
 if owners<>1 then raise exception 'Expected exactly one owner'; end if;
 select user_id into uid from private.lifecycle_access_profiles where access_tier='owner';
 perform 1 from public.user_data where user_id=uid for update;
 if not found then raise exception 'Owner document missing'; end if;
 if exists(select 1 from public.user_data where user_id=uid and data ? 'lifecycle_charging') then return; end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 update public.user_data set data=jsonb_set(data,'{lifecycle_charging}',jsonb_build_object('version',1,'revision',1,'devices',jsonb_build_array(
  jsonb_build_object('id','cd_voltra-handheld','name','Aspiradora de mano Voltra','maxMinutes',180,'archived',false,'deleted',false,'paused',false,'notify',true,'repeatMinutes',30,'createdAt',stamp,'sessions','[]'::jsonb),
  jsonb_build_object('id','cd_electric-racket','name','Raqueta eléctrica','maxMinutes',null,'archived',false,'deleted',false,'paused',false,'notify',true,'repeatMinutes',30,'createdAt',stamp,'sessions','[]'::jsonb)
 ))),updated_at=now() where user_id=uid;
end;
$seed$;
