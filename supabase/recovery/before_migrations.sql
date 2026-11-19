-- Run once in an empty Supabase application database, before the first historical migration.
-- Auth, Storage, their roles and the supabase_realtime publication belong to the provider.
begin;
create table public.user_data (
    user_id uuid primary key references auth.users(id) on delete cascade,
    data jsonb not null default '{}',
    updated_at timestamptz not null default timezone('utc', now()),
    constraint check_no_object_string check (data::text not like '%[object Object]%')
);
create table public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    subscription jsonb not null,
    created_at timestamptz not null default timezone('utc', now())
);
alter table public.user_data enable row level security;
alter table public.push_subscriptions enable row level security;
create policy "Users can only read/write their own data" on public.user_data
    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own subscriptions" on public.push_subscriptions
    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
insert into storage.buckets (id,name,public) values ('blood-tests','blood-tests',false);
alter publication supabase_realtime add table public.user_data;

-- Some installations already provide the dashboard's automatic RLS helper.
do $bootstrap$
begin
    if to_regprocedure('public.rls_auto_enable()') is null then
        execute $definition$
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
        $definition$;
    end if;
    if not exists(select 1 from pg_event_trigger where evtfoid='public.rls_auto_enable()'::regprocedure) then
        create event trigger ensure_rls on ddl_command_end
            when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
            execute function public.rls_auto_enable();
    end if;
end;
$bootstrap$;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
commit;
