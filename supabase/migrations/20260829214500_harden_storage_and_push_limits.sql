-- Operational guards that live outside user_data: private medical attachments
-- and Push device registrations.

set lock_timeout = '5s';
set statement_timeout = '30s';

update storage.buckets
set
    public = false,
    file_size_limit = 15728640,
    allowed_mime_types = array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
    ]::text[]
where id = 'blood-tests';

create or replace function public.can_upload_lifecycle_medical_file(
    p_object_name text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_access_tier text;
    v_limit bigint;
    v_current bigint;
begin
    if v_user_id is null then
        return false;
    end if;
    if p_object_name is null
       or split_part(p_object_name, '/', 1) <> v_user_id::text then
        return false;
    end if;

    select profile.access_tier
    into v_access_tier
    from private.lifecycle_access_profiles as profile
    where profile.user_id = v_user_id;
    if coalesce(v_access_tier, 'friend') = 'owner' then
        return true;
    end if;

    select limit_row.limit_value
    into v_limit
    from private.lifecycle_resource_limits as limit_row
    where limit_row.access_tier = coalesce(v_access_tier, 'friend')
      and limit_row.resource_key = 'blood_test_files'
      and limit_row.limit_unit = 'count';
    v_limit := coalesce(v_limit, 1000);

    -- Serialize concurrent uploads for one user so two requests cannot both
    -- pass the same count check.
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
    select count(*)
    into v_current
    from storage.objects as object_row
    where object_row.bucket_id = 'blood-tests'
      and split_part(object_row.name, '/', 1) = v_user_id::text;

    return v_current < v_limit;
end;
$$;

revoke all on function public.can_upload_lifecycle_medical_file(text)
from public, anon, service_role;
grant execute on function public.can_upload_lifecycle_medical_file(text)
to authenticated;

drop policy if exists "Users can insert their own blood tests"
on storage.objects;
create policy "Users can insert their own blood tests"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'blood-tests'
    and public.can_upload_lifecycle_medical_file(name)
);

create or replace function private.enforce_lifecycle_push_subscription_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_access_tier text;
    v_current bigint;
    v_limit constant bigint := 20;
begin
    select profile.access_tier
    into v_access_tier
    from private.lifecycle_access_profiles as profile
    where profile.user_id = new.user_id;
    if coalesce(v_access_tier, 'friend') = 'owner' then
        return new;
    end if;

    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1));
    select count(*)
    into v_current
    from public.push_subscriptions as subscription
    where subscription.user_id = new.user_id;
    if v_current >= v_limit then
        raise exception 'LifeCycle Push device limit exceeded'
            using
                errcode = '54000',
                detail = format(
                    'resource_key=push_devices current=%s limit=%s',
                    v_current,
                    v_limit
                ),
                hint = 'Revoke an old Push device before registering another.';
    end if;
    return new;
end;
$$;

revoke all on function private.enforce_lifecycle_push_subscription_limit()
from public, anon, authenticated, service_role;

drop trigger if exists push_subscriptions_enforce_user_limit_before_insert
on public.push_subscriptions;
create trigger push_subscriptions_enforce_user_limit_before_insert
before insert on public.push_subscriptions
for each row
execute function private.enforce_lifecycle_push_subscription_limit();

comment on function public.can_upload_lifecycle_medical_file(text) is
    'RLS helper that derives auth.uid() and enforces the friend medical-file quota.';
comment on function private.enforce_lifecycle_push_subscription_limit() is
    'Prevents bounded accounts from registering more than 20 Push devices.';
