-- Additive validation only. Existing records and permissions remain unchanged.
create or replace function private.guard_client_maintenance() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare m jsonb:=new.record->'maintenance'; c jsonb; h jsonb; t jsonb; s jsonb;
begin
 if m is null then return new; end if;
 c:=m->'cadence';
 if coalesce(jsonb_typeof(m)='object' and m->>'version'='1' and m->>'scheduleVersion' ~ '^[1-9][0-9]{0,14}$'
  and new.record->>'actor'='me' and new.record->>'status'='open'
  and new.record->>'reviewOn' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (new.record->>'reviewOn')::date::text=new.record->>'reviewOn'
  and jsonb_typeof(m->'instructions')='string' and length(m->>'instructions')<=2000 and jsonb_typeof(m->'paused')='boolean' and jsonb_typeof(m->'archived')='boolean'
  and jsonb_typeof(m->'times')='array' and jsonb_array_length(m->'times') between 1 and 6 and new.record->>'reminderTime'=m->'times'->>0
  and c->>'type' in('interval','weekly','scheduled') and c->>'anchorDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (c->>'anchorDate')::date::text=c->>'anchorDate'
  and jsonb_typeof(m->'history')='array' and jsonb_array_length(m->'history')<=2000,false) is not true then raise exception 'Invalid maintenance routine'; end if;
 if c->>'type'='interval' then
  if coalesce(c->>'every' ~ '^[1-9][0-9]{0,2}$' and (c->>'every')::integer between 1 and 365 and c->>'unit' in('days','weeks','months') and c->>'anchor' in('completion','calendar'),false) is not true then raise exception 'Invalid maintenance interval'; end if;
 elsif c->>'type'='weekly' then
  if coalesce(jsonb_typeof(c->'days')='array' and jsonb_array_length(c->'days') between 1 and 7,false) is not true then raise exception 'Invalid maintenance weekdays'; end if;
  if (select count(*)<>count(distinct x) from jsonb_array_elements(c->'days') x) then raise exception 'Duplicate maintenance weekday'; end if;
  for t in select value from jsonb_array_elements(c->'days') loop
   if jsonb_typeof(t)<>'number' or t::text !~ '^[0-6]$' then raise exception 'Invalid maintenance weekday'; end if;
  end loop;
 end if;
 if c->>'type'='scheduled' then
  s:=c->'schedule';
  if coalesce(jsonb_typeof(s)='object' and s->>'type' in('once','interval','weekly','monthly','yearly'),false) is not true then raise exception 'Invalid reminder schedule'; end if;
  if s->>'type'='once' then
   if coalesce(s->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (s->>'date')::date::text=s->>'date',false) is not true then raise exception 'Invalid reminder date'; end if;
  elsif s->>'type'='interval' then
   if coalesce(s->>'startDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (s->>'startDate')::date::text=s->>'startDate' and s->>'every' ~ '^[1-9][0-9]{0,2}$' and (s->>'every')::integer between 1 and 365 and s->>'unit' in('days','weeks','months'),false) is not true then raise exception 'Invalid reminder interval'; end if;
  elsif s->>'type'='weekly' then
   if coalesce(jsonb_typeof(s->'days')='array' and jsonb_array_length(s->'days') between 1 and 7,false) is not true then raise exception 'Invalid reminder weekdays'; end if;
   if (select count(*)<>count(distinct x) from jsonb_array_elements(s->'days') x) then raise exception 'Duplicate reminder weekday'; end if;
   for t in select value from jsonb_array_elements(s->'days') loop
    if jsonb_typeof(t)<>'number' or t::text !~ '^[0-6]$' then raise exception 'Invalid reminder weekday'; end if;
   end loop;
  else
   if coalesce(s->>'day' ~ '^[0-9]{1,2}$' and (s->>'day')::integer between 1 and 31,false) is not true then raise exception 'Invalid reminder month day'; end if;
   if s->>'type'='yearly' and coalesce(s->>'month' ~ '^[0-9]{1,2}$' and (s->>'month')::integer between 1 and 12,false) is not true then raise exception 'Invalid reminder month'; end if;
  end if;
 end if;
 if m ? 'completed' and jsonb_typeof(m->'completed')<>'boolean' then raise exception 'Invalid reminder completion'; end if;
 if m ? 'repeatUntilDone' and jsonb_typeof(m->'repeatUntilDone')<>'boolean' then raise exception 'Invalid reminder repeat'; end if;
 if m ? 'pushTitle' and (jsonb_typeof(m->'pushTitle')<>'string' or length(m->>'pushTitle')>100) then raise exception 'Invalid reminder push title'; end if;
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

-- Recover late-night slots within the same 15-minute window, never later.
create or replace function public.work_notification_states(p_now timestamptz default now()) returns table(user_id uuid,state jsonb)
language sql stable security definer set search_path='' as $$
 select p.user_id,jsonb_build_object('version',1,'revision',p.revision,'settings',p.settings,
 'clients',coalesce((select jsonb_agg(c.record order by c.id) from public.work_clients c where c.user_id=p.user_id),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('clientId',l.client_id,'projectId',l.project_id) order by l.project_id) from public.work_project_links l where l.user_id=p.user_id),'[]'::jsonb),
 'followups',coalesce((select jsonb_agg(f.record order by f.id) from public.work_followups f where f.user_id=p.user_id),'[]'::jsonb),'notes','[]'::jsonb)
 from public.work_preferences p where exists (select 1 from (values ((p_now at time zone 'America/Argentina/Buenos_Aires')::date), ((p_now at time zone 'America/Argentina/Buenos_Aires')::date-1)) d(day) where (
 (p.settings->>'dailyEnabled')::boolean
 and p_now >= ((d.day::text || 'T' || (p.settings->>'dailyTime') || ':00-03:00')::timestamptz)
 and p_now < ((d.day::text || 'T' || (p.settings->>'dailyTime') || ':00-03:00')::timestamptz)+interval '15 minutes')
 or exists(select 1 from public.work_followups f join public.work_clients c on c.user_id=f.user_id and c.id=f.client_id,
 lateral jsonb_array_elements_text(coalesce(f.record->'maintenance'->'times',jsonb_build_array(f.record->>'reminderTime'))) t(value)
 where f.user_id=p.user_id and c.record->>'archived'='false' and f.record->>'status'='open' and f.record->>'reminderEnabled'='true'
 and coalesce(f.record->'maintenance'->>'completed','false')='false' and coalesce(f.record->'maintenance'->>'paused','false')='false' and coalesce(f.record->'maintenance'->>'archived','false')='false'
 and f.record->>'reviewOn' <= d.day::text
 and p_now >= ((d.day::text || 'T' || t.value || ':00-03:00')::timestamptz)
 and p_now < ((d.day::text || 'T' || t.value || ':00-03:00')::timestamptz)+interval '15 minutes')
 or exists(select 1 from public.work_clients c,
 lateral jsonb_array_elements(coalesce(c.record->'retainers','[]'::jsonb)) r(value),
 lateral jsonb_array_elements_text(r.value->'times') t(value)
 where c.user_id=p.user_id and c.record->>'archived'='false' and r.value->>'archived'='false' and r.value->>'paused'='false' and r.value->>'reminderEnabled'='true'
 and r.value->>'nextDue'<=d.day::text
 and p_now>=((d.day::text || 'T' || t.value || ':00-03:00')::timestamptz)
 and p_now<((d.day::text || 'T' || t.value || ':00-03:00')::timestamptz)+interval '15 minutes')
);
$$;
revoke all on function public.work_notification_states(timestamptz) from public,anon,authenticated;
grant execute on function public.work_notification_states(timestamptz) to service_role;
