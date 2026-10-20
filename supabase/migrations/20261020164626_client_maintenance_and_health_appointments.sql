-- Additive validation only: existing records are neither rewritten nor seeded.
set lock_timeout='5s';
set statement_timeout='30s';

create function private.guard_health_appointments() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare v jsonb; previous jsonb; e jsonb; s jsonb; t jsonb; old_revision bigint;
begin
 v:=new.data->'lifecycle_appointments';
 if tg_op='INSERT' then
  if v is null then return new; end if;
  select data->'lifecycle_appointments' into previous from public.user_data where user_id=new.user_id for update;
 else previous:=old.data->'lifecycle_appointments'; end if;
 if v is not distinct from previous then return new; end if;
 if v is null then raise exception 'Clear appointments using an explicit versioned agenda'; end if;
 if jsonb_typeof(v)='string' then v:=(v#>>'{}')::jsonb; end if;
 if jsonb_typeof(previous)='string' then previous:=(previous#>>'{}')::jsonb; end if;
 if v is not distinct from previous then return new; end if;
 old_revision:=coalesce((previous->>'revision')::bigint,0);
 if coalesce(jsonb_typeof(v)='object' and v->>'version'='1' and (v->>'revision')::bigint=old_revision+1,false) is not true then raise exception 'Appointment revision conflict' using errcode='40001'; end if;
 if octet_length(v::text)>2000000 or coalesce(jsonb_typeof(v->'events')='array' and jsonb_array_length(v->'events')<=1000,false) is not true then raise exception 'Invalid appointment agenda'; end if;
 if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(v->'events') x) then raise exception 'Duplicate appointment'; end if;
 for e in select value from jsonb_array_elements(v->'events') loop
  if coalesce(e->>'id' ~ '^ha_[a-zA-Z0-9-]{3,90}$' and jsonb_typeof(e->'name')='string' and length(trim(e->>'name')) between 1 and 120
   and jsonb_typeof(e->'professional')='string' and length(e->>'professional')<=120
   and jsonb_typeof(e->'location')='string' and length(e->>'location')<=300
   and jsonb_typeof(e->'notes')='string' and length(e->>'notes')<=2000
   and jsonb_typeof(e->'trackerId')='string' and length(e->>'trackerId')<=120
   and e->>'kind' in('consultation','study') and e->>'status' in('pending','done','cancelled')
   and jsonb_typeof(e->'paused')='boolean' and jsonb_typeof(e->'archived')='boolean'
   and e->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (e->>'date')::date::text=e->>'date'
   and e->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   and (e->>'scheduleVersion') ~ '^[1-9][0-9]{0,14}$'
   and jsonb_typeof(e->'stages')='array' and jsonb_array_length(e->'stages') between 1 and 4,false) is not true then raise exception 'Invalid appointment'; end if;
  if e->>'status'='done' and coalesce(e->>'completedOn' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (e->>'completedOn')::date::text=e->>'completedOn' and (e->>'completedOn')::date<=(now() at time zone 'America/Argentina/Buenos_Aires')::date,false) is not true then raise exception 'Invalid attendance date'; end if;
  if (select count(*)<>count(distinct x->>'days') from jsonb_array_elements(e->'stages') x) then raise exception 'Duplicate appointment stage'; end if;
  for s in select value from jsonb_array_elements(e->'stages') loop
   if coalesce(s->>'days' ~ '^[0-9]{1,3}$' and (s->>'days')::integer between 0 and 365 and jsonb_typeof(s->'times')='array' and jsonb_array_length(s->'times') between 1 and 6,false) is not true then raise exception 'Invalid appointment stage'; end if;
   if (select count(*)<>count(distinct x) from jsonb_array_elements(s->'times') x) then raise exception 'Duplicate appointment time'; end if;
   for t in select value from jsonb_array_elements(s->'times') loop
    if jsonb_typeof(t)<>'string' or (t#>>'{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid appointment time'; end if;
   end loop;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function private.guard_health_appointments() from public,anon,authenticated,service_role;
create trigger guard_health_appointments before insert or update on public.user_data for each row execute function private.guard_health_appointments();

create function private.guard_client_maintenance() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare m jsonb:=new.record->'maintenance'; c jsonb; h jsonb; t jsonb;
begin
 if m is null then return new; end if;
 c:=m->'cadence';
 if coalesce(jsonb_typeof(m)='object' and m->>'version'='1' and m->>'scheduleVersion' ~ '^[1-9][0-9]{0,14}$'
  and new.record->>'actor'='me' and new.record->>'status'='open'
  and new.record->>'reviewOn' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (new.record->>'reviewOn')::date::text=new.record->>'reviewOn'
  and jsonb_typeof(m->'instructions')='string' and length(m->>'instructions')<=2000 and jsonb_typeof(m->'paused')='boolean' and jsonb_typeof(m->'archived')='boolean'
  and jsonb_typeof(m->'times')='array' and jsonb_array_length(m->'times') between 1 and 6 and new.record->>'reminderTime'=m->'times'->>0
  and c->>'type' in('interval','weekly') and c->>'anchorDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (c->>'anchorDate')::date::text=c->>'anchorDate'
  and jsonb_typeof(m->'history')='array' and jsonb_array_length(m->'history')<=2000,false) is not true then raise exception 'Invalid maintenance routine'; end if;
 if c->>'type'='interval' then
  if coalesce(c->>'every' ~ '^[1-9][0-9]{0,2}$' and (c->>'every')::integer between 1 and 365 and c->>'unit' in('days','weeks','months') and c->>'anchor' in('completion','calendar'),false) is not true then raise exception 'Invalid maintenance interval'; end if;
 else
  if coalesce(jsonb_typeof(c->'days')='array' and jsonb_array_length(c->'days') between 1 and 7,false) is not true then raise exception 'Invalid maintenance weekdays'; end if;
  if (select count(*)<>count(distinct x) from jsonb_array_elements(c->'days') x) then raise exception 'Duplicate maintenance weekday'; end if;
  for t in select value from jsonb_array_elements(c->'days') loop
   if jsonb_typeof(t)<>'number' or t::text !~ '^[0-6]$' then raise exception 'Invalid maintenance weekday'; end if;
  end loop;
 end if;
 if (select count(*)<>count(distinct x) from jsonb_array_elements(m->'times') x) then raise exception 'Duplicate maintenance time'; end if;
 for t in select value from jsonb_array_elements(m->'times') loop
  if jsonb_typeof(t)<>'string' or (t#>>'{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid maintenance time'; end if;
 end loop;
 if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(m->'history') x) then raise exception 'Duplicate maintenance history'; end if;
 for h in select value from jsonb_array_elements(m->'history') loop
  if coalesce(h->>'id' ~ '^mh_[a-zA-Z0-9-]{3,90}$' and h->>'doneOn' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (h->>'doneOn')::date::text=h->>'doneOn' and (h->>'doneOn')::date<=(now() at time zone 'America/Argentina/Buenos_Aires')::date
   and h->>'dueOn' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (h->>'dueOn')::date::text=h->>'dueOn'
   and jsonb_typeof(h->'note')='string' and length(h->>'note')<=2000 and h->>'recordedAt' is not null,false) is not true then raise exception 'Invalid maintenance history'; end if;
  perform (h->>'recordedAt')::timestamptz;
 end loop;
 return new;
end $$;
revoke all on function private.guard_client_maintenance() from public,anon,authenticated,service_role;
create trigger guard_client_maintenance before insert or update on public.work_followups for each row execute function private.guard_client_maintenance();

CREATE OR REPLACE FUNCTION public.save_lifecycle_planning(p_key text, p_expected_revision bigint, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$

declare uid uuid:=auth.uid(); current_value jsonb; actual_revision bigint; result_revision bigint;

begin

    if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;

    if p_key is null or p_key not in ('lifecycle_saylor','lifecycle_faculty','lifecycle_appointments','lifecycle_charging') or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid workspace' using errcode='22023'; end if;

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

$function$
;

CREATE OR REPLACE FUNCTION public.merge_user_data_keys(p_updates jsonb DEFAULT '{}'::jsonb, p_delete_keys text[] DEFAULT '{}'::text[])
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$

declare

    v_user_id uuid := auth.uid();

    v_updated_at timestamptz;

    v_delete_keys text[];

    v_invalid_key text;

    v_allowed_keys constant text[] := array[

        'lifecycle_appointments','lifecycle_charging',

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

$function$
;

-- Candidate query expands only configured times; paused and archived routines
-- and archived clients do not wake the worker. Legacy followups retain one time.
create or replace function public.work_notification_states(p_now timestamptz default now()) returns table(user_id uuid,state jsonb)
language sql stable security definer set search_path='' as $$
 select p.user_id,jsonb_build_object('version',1,'revision',p.revision,'settings',p.settings,
 'clients',coalesce((select jsonb_agg(c.record order by c.id) from public.work_clients c where c.user_id=p.user_id),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('clientId',l.client_id,'projectId',l.project_id) order by l.project_id) from public.work_project_links l where l.user_id=p.user_id),'[]'::jsonb),
 'followups',coalesce((select jsonb_agg(f.record order by f.id) from public.work_followups f where f.user_id=p.user_id),'[]'::jsonb),'notes','[]'::jsonb)
 from public.work_preferences p where (
 (p.settings->>'dailyEnabled')::boolean
 and p_now >= (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || (p.settings->>'dailyTime') || ':00-03:00')::timestamptz)
 and p_now < (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || (p.settings->>'dailyTime') || ':00-03:00')::timestamptz)+interval '15 minutes')
 or exists(select 1 from public.work_followups f join public.work_clients c on c.user_id=f.user_id and c.id=f.client_id,
 lateral jsonb_array_elements_text(coalesce(f.record->'maintenance'->'times',jsonb_build_array(f.record->>'reminderTime'))) t(value)
 where f.user_id=p.user_id and c.record->>'archived'='false' and f.record->>'status'='open' and f.record->>'reminderEnabled'='true'
 and coalesce(f.record->'maintenance'->>'paused','false')='false' and coalesce(f.record->'maintenance'->>'archived','false')='false'
 and f.record->>'reviewOn' <= (p_now at time zone 'America/Argentina/Buenos_Aires')::date::text
 and p_now >= (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || t.value || ':00-03:00')::timestamptz)
 and p_now < (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || t.value || ':00-03:00')::timestamptz)+interval '15 minutes')
$$;
revoke all on function public.work_notification_states(timestamptz) from public,anon,authenticated;
grant execute on function public.work_notification_states(timestamptz) to service_role;
