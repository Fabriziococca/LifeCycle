-- Tanda 8: establish a least-privilege, observable synchronization foundation.
-- This migration is intentionally additive. The application JSON remains the
-- source of truth and the pre-migration snapshot stays available in `private`.

set lock_timeout = '5s';
set statement_timeout = '30s';

-- Keep a database-side recovery point before changing grants or sync behavior.
insert into private.user_data_snapshots (user_id, data, reason)
select user_id, data, 'before_tanda_8_20260809'
from public.user_data
on conflict (user_id, reason) do nothing;

-- A monotonic revision makes cross-device writes observable without changing
-- the current RPC contract. A later client can use it for explicit conflict UX.
alter table public.user_data
    add column if not exists revision bigint not null default 1;

comment on column public.user_data.revision is
    'Monotonic document revision. Incremented whenever synchronized data changes.';

create or replace function private.bump_user_data_revision()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
    new.revision := old.revision + 1;
    return new;
end;
$$;

revoke all on function private.bump_user_data_revision()
from public, anon, authenticated, service_role;

drop trigger if exists user_data_revision_before_update on public.user_data;
create trigger user_data_revision_before_update
before update of data on public.user_data
for each row
when (old.data is distinct from new.data)
execute function private.bump_user_data_revision();

-- User-owned rows and Push subscriptions should disappear with the account.
-- NOT VALID keeps the lock short; validation is explicit and deterministic.
alter table public.user_data
    drop constraint if exists user_data_user_id_fkey;
alter table public.user_data
    add constraint user_data_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.user_data
    validate constraint user_data_user_id_fkey;

alter table public.push_subscriptions
    drop constraint if exists push_subscriptions_user_id_fkey;
alter table public.push_subscriptions
    add constraint push_subscriptions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.push_subscriptions
    validate constraint push_subscriptions_user_id_fkey;

-- Public Data API access is opt-in. Anonymous clients never need database rows.
revoke all on table public.user_data from anon, authenticated;
grant select on table public.user_data to authenticated;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete
on table public.push_subscriptions to authenticated;

revoke all on table public.notification_delivery_log from anon, authenticated;

-- The trusted backend receives only the DML privileges it actually uses.
revoke all on table public.user_data from service_role;
grant select, insert, update, delete on table public.user_data to service_role;

revoke all on table public.push_subscriptions from service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

revoke all on table public.notification_delivery_log from service_role;
grant select, insert, update, delete
on table public.notification_delivery_log to service_role;
grant usage, select on sequence public.notification_delivery_log_id_seq to service_role;

-- Adopt Supabase's forthcoming explicit-grant model for objects created by
-- repository migrations. Existing objects keep the grants declared above.
alter default privileges for role postgres in schema public
    revoke select, insert, update, delete on tables
    from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
    revoke usage, select on sequences
    from anon, authenticated, service_role;

-- Policies name both the authenticated role and the ownership predicate.
drop policy if exists "Users can only read/write their own data"
on public.user_data;
drop policy if exists "Users can read their own data"
on public.user_data;

create policy "Users can read their own data"
on public.user_data
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own subscriptions"
on public.push_subscriptions;
drop policy if exists "Users can read their own subscriptions"
on public.push_subscriptions;
drop policy if exists "Users can insert their own subscriptions"
on public.push_subscriptions;
drop policy if exists "Users can update their own subscriptions"
on public.push_subscriptions;
drop policy if exists "Users can delete their own subscriptions"
on public.push_subscriptions;

create policy "Users can read their own subscriptions"
on public.push_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own subscriptions"
on public.push_subscriptions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own subscriptions"
on public.push_subscriptions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- All user_data writes must pass through this allowlisted RPC. SECURITY DEFINER
-- is deliberate: authenticated no longer has direct INSERT/UPDATE privileges.
-- The function derives the owner from auth.uid(), fixes search_path, accepts no
-- user_id argument, and is executable only by the authenticated role.
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

comment on function public.merge_user_data_keys(jsonb, text[]) is
    'Allowlisted atomic patch API for the authenticated user own LifeCycle document.';
