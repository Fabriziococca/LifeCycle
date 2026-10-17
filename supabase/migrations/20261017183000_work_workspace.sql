-- Additive Work workspace. Existing project/finance documents are not migrated.
create table public.work_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 settings jsonb not null default '{"dailyEnabled":false,"dailyTime":"15:00","financeScopes":{}}',
 updated_at timestamptz not null default now()
);
create table public.work_clients (
 user_id uuid not null references auth.users(id) on delete cascade, id uuid not null,
 record jsonb not null, primary key(user_id,id),
 check(jsonb_typeof(record)='object' and record->>'id'=id::text)
);
create table public.work_project_links (
 user_id uuid not null, project_id text not null check(project_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 client_id uuid not null, primary key(user_id,project_id),
 foreign key(user_id,client_id) references public.work_clients(user_id,id) on delete cascade
);
create table public.work_followups (
 user_id uuid not null, id uuid not null, client_id uuid not null, record jsonb not null,
 primary key(user_id,id), foreign key(user_id,client_id) references public.work_clients(user_id,id) on delete cascade,
 check(jsonb_typeof(record)='object' and record->>'id'=id::text and record->>'clientId'=client_id::text)
);
create table public.work_notes (
 user_id uuid not null, id uuid not null, client_id uuid not null, record jsonb not null,
 primary key(user_id,id), foreign key(user_id,client_id) references public.work_clients(user_id,id) on delete cascade,
 check(jsonb_typeof(record)='object' and record->>'id'=id::text and record->>'clientId'=client_id::text)
);
create index work_followups_due on public.work_followups(user_id,(record->>'reviewOn')) where record->>'status'='open';
create index work_followups_client on public.work_followups(user_id,client_id);
create index work_notes_client on public.work_notes(user_id,client_id);
create index work_project_links_client on public.work_project_links(user_id,client_id);
do $$ declare t text; begin
 foreach t in array array['work_preferences','work_clients','work_project_links','work_followups','work_notes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
  execute format('grant select on table public.%I to authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
  execute format('create policy work_owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end $$;

create function public.get_work_state() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',1,
 'revision',coalesce((select revision from public.work_preferences where user_id=auth.uid()),0),
 'settings',coalesce((select settings from public.work_preferences where user_id=auth.uid()),'{"dailyEnabled":false,"dailyTime":"15:00","financeScopes":{}}'::jsonb),
 'clients',coalesce((select jsonb_agg(record order by id) from public.work_clients where user_id=auth.uid()),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('clientId',client_id,'projectId',project_id) order by project_id) from public.work_project_links where user_id=auth.uid()),'[]'::jsonb),
 'followups',coalesce((select jsonb_agg(record order by id) from public.work_followups where user_id=auth.uid()),'[]'::jsonb),
 'notes',coalesce((select jsonb_agg(record order by id) from public.work_notes where user_id=auth.uid()),'[]'::jsonb))
$$;

create function public.save_work_state(p_state jsonb,p_expected_revision bigint,p_updates jsonb default null,p_delete_keys text[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_state jsonb; r bigint; x jsonb; k text; doc jsonb; projects jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid Work revision'; end if;
 -- Lock order matches merge_user_data_keys: personal row before workspace row.
 perform 1 from public.user_data where user_id=uid for update;
 insert into public.work_preferences(user_id) values(uid) on conflict do nothing;
 select revision into r from public.work_preferences where user_id=uid for update;
 current_state:=public.get_work_state();
 if p_updates is null and current_state-'revision'=p_state-'revision' and r in(p_expected_revision,p_expected_revision+1) then return current_state; end if;
 if p_expected_revision is null or p_expected_revision<>r then raise exception 'Work revision conflict' using errcode='40001'; end if;
 if coalesce(jsonb_typeof(p_state)='object' and p_state->>'version'='1' and (p_state->>'revision')::bigint=r+1,false) is not true then raise exception 'Invalid Work version'; end if;
 foreach k in array array['clients','links','followups','notes'] loop
  if coalesce(jsonb_typeof(p_state->k)='array' and jsonb_array_length(p_state->k)<=10000,false) is not true then raise exception 'Invalid Work collection'; end if;
 end loop;
 if pg_column_size(p_state)>4194304 then raise exception 'Work workspace too large'; end if;
 if coalesce(jsonb_typeof(p_state->'settings'->'dailyEnabled')='boolean' and p_state->'settings'->>'dailyTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and jsonb_typeof(p_state->'settings'->'financeScopes')='object',false) is not true then raise exception 'Invalid Work settings'; end if;
 for k in select key from jsonb_each(p_state->'settings'->'financeScopes') loop
  if length(k)>180 or k in('__proto__','constructor','prototype') or coalesce(p_state->'settings'->'financeScopes'->>k in('work','personal','unclassified'),false) is not true then raise exception 'Invalid finance scope'; end if;
 end loop;
 -- Stable identities and relational ownership are validated before deleting anything.
 foreach k in array array['clients','followups','notes'] loop
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_state->k)) then raise exception 'Duplicate Work identifier'; end if;
 end loop;
 for x in select value from jsonb_array_elements(p_state->'clients') loop
  if coalesce(length(trim(x->>'name')) between 1 and 120 and length(coalesce(x->>'context',''))<=2000 and length(coalesce(x->>'contact',''))<=300 and jsonb_typeof(x->'archived')='boolean',false) is not true then raise exception 'Invalid client'; end if;
  perform (x->>'id')::uuid;
 end loop;
 for x in select value from jsonb_array_elements(p_state->'links') loop
  if coalesce(x->>'projectId' ~ '^[a-zA-Z0-9_-]{1,100}$' and exists(select 1 from jsonb_array_elements(p_state->'clients') c where c->>'id'=x->>'clientId'),false) is not true then raise exception 'Invalid project link'; end if;
  if p_updates is null and not exists(select 1 from public.work_project_links l where l.user_id=uid and l.project_id=x->>'projectId') then
   select data into doc from public.user_data where user_id=uid;
   projects:='[]'::jsonb;
   foreach k in array array['projectPulseData','projectPulseHistory'] loop
    if jsonb_typeof(doc->k)='array' then projects:=projects||(doc->k);
    elsif jsonb_typeof(doc->k)='string' then projects:=projects||((doc->>k)::jsonb); end if;
   end loop;
   if not exists(select 1 from jsonb_array_elements(projects) p where p->>'id'=x->>'projectId') then raise exception 'Project no longer available: refresh before linking'; end if;
  end if;
 end loop;
 if (select count(*)<>count(distinct value->>'projectId') from jsonb_array_elements(p_state->'links')) then raise exception 'Duplicate project link'; end if;
 for x in select value from jsonb_array_elements(p_state->'followups') loop
  if coalesce(length(trim(x->>'title')) between 1 and 300 and x->>'actor' in('me','client','third') and x->>'status' in('open','completed','cancelled') and x->>'priority' in('normal','high') and jsonb_typeof(x->'reminderEnabled')='boolean' and x->>'reminderTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and exists(select 1 from jsonb_array_elements(p_state->'clients') c where c->>'id'=x->>'clientId'),false) is not true then raise exception 'Invalid followup'; end if;
  if nullif(x->>'projectId','') is not null and not exists(select 1 from jsonb_array_elements(p_state->'links') l where l->>'clientId'=x->>'clientId' and l->>'projectId'=x->>'projectId') then raise exception 'Invalid followup project'; end if;
  foreach k in array array['reviewOn','promisedOn'] loop
   if nullif(x->>k,'') is not null then
    if x->>k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (x->>k)::date::text<>x->>k then raise exception 'Invalid followup date'; end if;
   end if;
  end loop;
 end loop;
 for x in select value from jsonb_array_elements(p_state->'notes') loop
  if coalesce(length(trim(x->>'body')) between 1 and 4000 and x->>'kind' in('note','pending','agreement') and exists(select 1 from jsonb_array_elements(p_state->'clients') c where c->>'id'=x->>'clientId'),false) is not true then raise exception 'Invalid note'; end if;
  if nullif(x->>'projectId','') is not null and not exists(select 1 from jsonb_array_elements(p_state->'links') l where l->>'clientId'=x->>'clientId' and l->>'projectId'=x->>'projectId') then raise exception 'Invalid note project'; end if;
 end loop;
 -- A restore updates both stores in one transaction; failures roll back both.
 if p_updates is not null then perform public.merge_user_data_keys(p_updates,p_delete_keys); end if;
 delete from public.work_followups where user_id=uid and id not in(select (value->>'id')::uuid from jsonb_array_elements(p_state->'followups'));
 delete from public.work_notes where user_id=uid and id not in(select (value->>'id')::uuid from jsonb_array_elements(p_state->'notes'));
 delete from public.work_project_links where user_id=uid;
 for x in select value from jsonb_array_elements(p_state->'clients') loop
  insert into public.work_clients values(uid,(x->>'id')::uuid,x) on conflict(user_id,id) do update set record=excluded.record where work_clients.record is distinct from excluded.record;
 end loop;
 for x in select value from jsonb_array_elements(p_state->'links') loop
  insert into public.work_project_links values(uid,x->>'projectId',(x->>'clientId')::uuid);
 end loop;
 for x in select value from jsonb_array_elements(p_state->'followups') loop
  insert into public.work_followups values(uid,(x->>'id')::uuid,(x->>'clientId')::uuid,x) on conflict(user_id,id) do update set record=excluded.record,client_id=excluded.client_id where work_followups.record is distinct from excluded.record;
 end loop;
 for x in select value from jsonb_array_elements(p_state->'notes') loop
  insert into public.work_notes values(uid,(x->>'id')::uuid,(x->>'clientId')::uuid,x) on conflict(user_id,id) do update set record=excluded.record,client_id=excluded.client_id where work_notes.record is distinct from excluded.record;
 end loop;
 delete from public.work_clients where user_id=uid and id not in(select (value->>'id')::uuid from jsonb_array_elements(p_state->'clients'));
 update public.work_preferences set revision=r+1,settings=p_state->'settings',updated_at=now() where user_id=uid;
 return public.get_work_state();
end $$;

create function public.work_backup_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('work',public.get_work_state(),'personal',coalesce((select data from public.user_data where user_id=auth.uid()),'{}'::jsonb))
$$;
revoke all on function public.get_work_state(),public.save_work_state(jsonb,bigint,jsonb,text[]),public.work_backup_snapshot() from public,anon,service_role;
grant execute on function public.get_work_state(),public.save_work_state(jsonb,bigint,jsonb,text[]),public.work_backup_snapshot() to authenticated;

-- Only the existing backend service can read reminder candidates across owners.
create function public.work_notification_states(p_now timestamptz default now()) returns table(user_id uuid,state jsonb)
language sql stable security definer set search_path='' as $$
 select p.user_id,jsonb_build_object('version',1,'revision',p.revision,'settings',p.settings,
 'clients',coalesce((select jsonb_agg(c.record order by c.id) from public.work_clients c where c.user_id=p.user_id),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('clientId',l.client_id,'projectId',l.project_id) order by l.project_id) from public.work_project_links l where l.user_id=p.user_id),'[]'::jsonb),
 'followups',coalesce((select jsonb_agg(f.record order by f.id) from public.work_followups f where f.user_id=p.user_id),'[]'::jsonb),'notes','[]'::jsonb)
 from public.work_preferences p where (
 (p.settings->>'dailyEnabled')::boolean
 and p_now >= (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || (p.settings->>'dailyTime') || ':00-03:00')::timestamptz)
 and p_now < (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || (p.settings->>'dailyTime') || ':00-03:00')::timestamptz)+interval '15 minutes')
 or exists(select 1 from public.work_followups f where f.user_id=p.user_id and f.record->>'status'='open' and f.record->>'reminderEnabled'='true'
 and f.record->>'reviewOn' <= (p_now at time zone 'America/Argentina/Buenos_Aires')::date::text
 and p_now >= (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || (f.record->>'reminderTime') || ':00-03:00')::timestamptz)
 and p_now < (((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || (f.record->>'reminderTime') || ':00-03:00')::timestamptz)+interval '15 minutes')
$$;
revoke all on function public.work_notification_states(timestamptz) from public,anon,authenticated;
grant execute on function public.work_notification_states(timestamptz) to service_role;
