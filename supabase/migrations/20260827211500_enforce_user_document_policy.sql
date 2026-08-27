-- Enforce the central per-user synchronization policy at the database boundary.
-- Feature-specific counters remain separate, bounded follow-up work.

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
    v_limit_bytes bigint;
    v_document_bytes bigint;
begin
    select profile.access_tier
    into v_access_tier
    from private.lifecycle_access_profiles as profile
    where profile.user_id = new.user_id;

    v_access_tier := coalesce(v_access_tier, 'friend');

    if v_access_tier = 'owner' then
        return new;
    end if;

    select limit_row.limit_value
    into v_limit_bytes
    from private.lifecycle_resource_limits as limit_row
    where limit_row.access_tier = v_access_tier
      and limit_row.resource_key = 'synced_document_bytes'
      and limit_row.limit_unit = 'bytes';

    -- Fail closed with the same generous fallback used by the client if the
    -- centrally configured row is ever unavailable.
    v_limit_bytes := coalesce(v_limit_bytes, 5242880);
    v_document_bytes := octet_length(
        convert_to(coalesce(new.data, '{}'::jsonb)::text, 'UTF8')
    );

    if v_document_bytes > v_limit_bytes then
        raise exception 'LifeCycle synchronized data limit exceeded'
            using
                errcode = '54000',
                detail = format(
                    'document_bytes=%s limit_bytes=%s',
                    v_document_bytes,
                    v_limit_bytes
                ),
                hint = 'Reduce synchronized content before trying again.';
    end if;

    return new;
end;
$$;

revoke all on function private.enforce_lifecycle_user_document_limit()
from public, anon, authenticated, service_role;

drop trigger if exists user_data_enforce_resource_policy_before_write
on public.user_data;
create trigger user_data_enforce_resource_policy_before_write
before insert or update of data
on public.user_data
for each row
execute function private.enforce_lifecycle_user_document_limit();

comment on function private.enforce_lifecycle_user_document_limit() is
    'Rejects oversized synchronized documents for bounded users; owner is unlimited.';
