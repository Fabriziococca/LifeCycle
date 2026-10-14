-- Additive, private personal planning. Existing data and policies are preserved.
set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function private.guard_lifecycle_planning()
returns trigger language plpgsql security invoker set search_path = pg_catalog, pg_temp as $$
declare
    k text; v jsonb; old_v jsonb; c jsonb; l jsonb; e jsonb; n bigint; position_n bigint;
    old_revision bigint; subject_ids text[]; total_minor numeric; base_minor numeric; result_minor numeric;
begin
    foreach k in array array['lifecycle_saylor','lifecycle_faculty'] loop
        v := new.data->k;
        if tg_op = 'INSERT' then
            -- merge_user_data_keys uses INSERT ... ON CONFLICT. Its INSERT
            -- trigger sees only the partial patch, before the UPDATE trigger.
            if v is null then continue; end if;
            select data->k into old_v from public.user_data where user_id=new.user_id for update;
        else old_v := old.data->k;
        end if;
        if v is not distinct from old_v then continue; end if;
        if v is null then raise exception 'Planning documents must be cleared with an explicit versioned workspace' using errcode='22023'; end if;
        if jsonb_typeof(v) = 'string' then v := (v#>>'{}')::jsonb; end if;
        if jsonb_typeof(old_v) = 'string' then old_v := (old_v#>>'{}')::jsonb; end if;
        -- Backups/generic sync encode localStorage values as JSON strings;
        -- equal documents do not represent a new planning edit.
        if v is not distinct from old_v then continue; end if;
        old_revision := coalesce((old_v->>'revision')::bigint,0);
        if jsonb_typeof(v) <> 'object' or (v->>'version')::integer is distinct from 1
           or (v->>'revision')::bigint is distinct from old_revision+1 then
            raise exception 'Planning revision conflict: refresh before saving' using errcode='40001';
        end if;
        if octet_length(v::text)>2000000 then raise exception 'Planning document too large' using errcode='22023'; end if;
        if k = 'lifecycle_saylor' then
            if jsonb_typeof(v->'campaigns') is distinct from 'array' or jsonb_array_length(v->'campaigns')>500 then raise exception 'Invalid Saylor campaigns'; end if;
            if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(v->'campaigns') x) then raise exception 'Duplicate campaign'; end if;
            for c in select value from jsonb_array_elements(v->'campaigns') loop
                if coalesce(c->>'id','') !~ '^sc_[a-zA-Z0-9-]{3,90}$' or length(coalesce(c->>'name','')) not between 1 and 120
                    or (c->>'bulletMinor')::bigint not between 1 and 1000000000 or (c->>'bulletMinor') is null
                    or coalesce(c->>'status','') not in ('active','closed')
                    or coalesce(c->>'startedOn','') !~ '^\d{4}-\d{2}-\d{2}$'
                    or (c->>'startedOn')::date > (now() at time zone 'America/Argentina/Buenos_Aires')::date
                    or jsonb_typeof(c->'loads') is distinct from 'array' or jsonb_array_length(c->'loads')>500 then raise exception 'Invalid Saylor campaign'; end if;
                if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(c->'loads') x) then raise exception 'Duplicate load'; end if;
                n:=0; position_n:=0;
                for l in select value from jsonb_array_elements(c->'loads') loop
                    if coalesce(l->>'id','') !~ '^sl_[a-zA-Z0-9-]{3,90}$' or coalesce(l->>'quantity','') !~ '^\d+$'
                       or (l->>'quantity')::integer not between 1 and 90 or coalesce(l->>'destination','') not in ('position','margin')
                       or coalesce(l->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
                       or (l->>'date')::date < (c->>'startedOn')::date
                       or (l->>'date')::date > (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Invalid Saylor load'; end if;
                    if l->>'voidedAt' is null then n:=n+(l->>'quantity')::integer;
                        if l->>'destination'='position' then position_n:=position_n+(l->>'quantity')::integer; end if;
                    else perform (l->>'voidedAt')::timestamptz; end if;
                end loop;
                if n>90 then raise exception 'Saylor exceeds 90 bullets'; end if;
                if c->>'status'='closed' then
                    e:=c->'closure';
                    total_minor:=n*(c->>'bulletMinor')::bigint;
                    if coalesce(e->>'basis','') not in ('all','position') then raise exception 'Invalid closure basis'; end if;
                    base_minor:=case when e->>'basis'='position' then position_n*(c->>'bulletMinor')::bigint else total_minor end;
                    if coalesce(e->>'percentBps','') !~ '^-?\d+$' or coalesce(e->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid closure date or percentage'; end if;
                    result_minor:=round(base_minor*(e->>'percentBps')::numeric/10000);
                    if base_minor<=0 or (e->>'baseMinor')::numeric is distinct from base_minor
                       or (e->>'percentBps')::integer not between -10000 and 1000000
                       or (e->>'calculatedMinor')::numeric is distinct from result_minor
                       or jsonb_typeof(e->'actual') is distinct from 'boolean'
                       or coalesce(e->>'profitMinor','') !~ '^-?\d+$' or abs((e->>'profitMinor')::numeric)>100000000000
                       or (not (e->>'actual')::boolean and (e->>'profitMinor')::numeric is distinct from result_minor)
                       or (e->>'date')::date < (c->>'startedOn')::date
                       or (e->>'date')::date > (now() at time zone 'America/Argentina/Buenos_Aires')::date
                       or exists(select 1 from jsonb_array_elements(c->'loads') q where q->>'voidedAt' is null and (q->>'date')::date>(e->>'date')::date)
                       then raise exception 'Closure does not match contributions'; end if;
                elsif c->'closure' is not null then raise exception 'Active campaign cannot have closure'; end if;
            end loop;
        else
            if jsonb_typeof(v->'subjects') is distinct from 'array' or jsonb_array_length(v->'subjects')>100
               or jsonb_typeof(v->'events') is distinct from 'array' or jsonb_array_length(v->'events')>1000
               or jsonb_typeof(v->'tasks') is distinct from 'array' or jsonb_array_length(v->'tasks')>2000 then raise exception 'Invalid faculty workspace'; end if;
                if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(v->'subjects') x)
                   or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(v->'events') x)
                   or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(v->'tasks') x) then raise exception 'Duplicate faculty record'; end if;
            select coalesce(array_agg(x->>'id'),'{}') into subject_ids from jsonb_array_elements(v->'subjects') x;
            for e in select value from jsonb_array_elements(v->'subjects') loop
                if coalesce(e->>'id','') !~ '^fs_[a-zA-Z0-9-]{3,90}$' or length(coalesce(e->>'name','')) not between 1 and 120 or jsonb_typeof(e->'archived') is distinct from 'boolean' or jsonb_typeof(e->'teacher') is distinct from 'string' or length(e->>'teacher')>120 or jsonb_typeof(e->'term') is distinct from 'string' or length(e->>'term')>60 then raise exception 'Invalid subject'; end if;
            end loop;
            for e in select value from jsonb_array_elements(v->'events') loop
                if coalesce(e->>'id','') !~ '^fe_[a-zA-Z0-9-]{3,90}$' or not (coalesce(e->>'subjectId','')=any(subject_ids))
                   or length(coalesce(e->>'name','')) not between 1 and 120
                   or coalesce(e->>'type','') not in ('parcial','final','recuperatorio','tp','otro')
                   or coalesce(e->>'status','') not in ('pending','done','cancelled')
                   or jsonb_typeof(e->'paused') is distinct from 'boolean'
                   or coalesce(e->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
                   or coalesce(e->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
                   or coalesce(e->>'noticeTime','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
                   or coalesce(e->>'leadDays','') !~ '^\d+$' or (e->>'leadDays')::integer not between 0 and 365
                   or coalesce(e->>'scheduleVersion','') !~ '^\d+$' or (e->>'scheduleVersion')::bigint<1
                   or length(coalesce(e->>'notes',''))>2000 then raise exception 'Invalid faculty event'; end if;
                perform (e->>'date')::date;
                if coalesce(e->>'grade','')<>'' and (e->>'grade')::numeric not between 0 and 10 then raise exception 'Invalid grade'; end if;
            end loop;
            for e in select value from jsonb_array_elements(v->'tasks') loop
                if coalesce(e->>'id','') !~ '^ft_[a-zA-Z0-9-]{3,90}$' or not (coalesce(e->>'subjectId','')=any(subject_ids)) or length(coalesce(e->>'name','')) not between 1 and 300 or jsonb_typeof(e->'done') is distinct from 'boolean' then raise exception 'Invalid faculty task'; end if;
            end loop;
        end if;
    end loop;
    return new;
end;
$$;
revoke all on function private.guard_lifecycle_planning() from public, anon, authenticated, service_role;
create trigger guard_lifecycle_planning before insert or update of data on public.user_data
for each row execute function private.guard_lifecycle_planning();

create or replace function public.save_lifecycle_planning(p_key text, p_expected_revision bigint, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare uid uuid:=auth.uid(); current_value jsonb; actual_revision bigint; result_revision bigint;
begin
    if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
    if p_key is null or p_key not in ('lifecycle_saylor','lifecycle_faculty') or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid workspace' using errcode='22023'; end if;
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
