-- Additive: client records remain unchanged until their owner saves a contract.
-- Receipts and the next due date use the existing Work CAS transaction. Finance
-- projects those receipts; it must never insert a second copy into user_data.
set lock_timeout='5s';
set statement_timeout='30s';

create function private.guard_work_retainers() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare c record; r jsonb; p jsonb; t jsonb; seen text[]:='{}'; due date; day integer;
begin
 -- save_work_state updates preferences last, after links and clients are saved.
 -- Validate here so a new contract and a new link may share one transaction.
 for c in select id,record from public.work_clients where user_id=new.user_id loop
  if not (c.record ? 'retainers') then continue; end if;
  if coalesce(jsonb_typeof(c.record->'retainers')='array' and jsonb_array_length(c.record->'retainers')<=200,false) is not true then raise exception 'Invalid retainer list'; end if;
  for r in select value from jsonb_array_elements(c.record->'retainers') loop
   if coalesce(r->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and r->>'version'='1' and r->>'scheduleVersion' ~ '^[1-9][0-9]{0,14}$'
    and jsonb_typeof(r->'title')='string' and length(trim(r->>'title')) between 1 and 120
    and jsonb_typeof(r->'tasks')='string' and length(r->>'tasks')<=4000
    and r->>'currency' in('USD','ARS') and jsonb_typeof(r->'amountMinor')='number' and r->>'amountMinor' ~ '^[1-9][0-9]{0,11}$' and (r->>'amountMinor')::bigint<=100000000000
    and r->>'billingDay' ~ '^[0-9]{1,2}$' and (r->>'billingDay')::integer between 1 and 31
    and r->>'nextDue' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (r->>'nextDue')::date::text=r->>'nextDue'
    and jsonb_typeof(r->'paused')='boolean' and jsonb_typeof(r->'archived')='boolean' and jsonb_typeof(r->'reminderEnabled')='boolean'
    and jsonb_typeof(r->'times')='array' and jsonb_array_length(r->'times') between 1 and 6
    and jsonb_typeof(r->'projectIds')='array' and jsonb_typeof(r->'payments')='array' and jsonb_array_length(r->'payments')<=2400,false) is not true then raise exception 'Invalid monthly retainer'; end if;
   if r->>'id'=any(seen) then raise exception 'Duplicate retainer'; end if; seen:=array_append(seen,r->>'id');
   due:=(r->>'nextDue')::date; day:=(r->>'billingDay')::integer;
   if extract(day from due)<>least(day,extract(day from date_trunc('month',due)+interval '1 month - 1 day')::integer) then raise exception 'Invalid retainer billing date'; end if;
   if (select count(*)<>count(distinct x) from jsonb_array_elements(r->'projectIds') x) then raise exception 'Duplicate retainer project'; end if;
   for t in select value from jsonb_array_elements(r->'projectIds') loop
    if jsonb_typeof(t)<>'string' or not exists(select 1 from public.work_project_links l where l.user_id=new.user_id and l.client_id=c.id and l.project_id=t#>>'{}') then raise exception 'Retainer project must belong to this client'; end if;
   end loop;
   if (select count(*)<>count(distinct x) from jsonb_array_elements(r->'times') x) then raise exception 'Duplicate retainer time'; end if;
   for t in select value from jsonb_array_elements(r->'times') loop
    if jsonb_typeof(t)<>'string' or (t#>>'{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid retainer time'; end if;
   end loop;
   if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(r->'payments') x) then raise exception 'Duplicate retainer receipt'; end if;
   if (select count(*)<>count(distinct x->>'dueOn') from jsonb_array_elements(r->'payments') x where nullif(x->>'voidedAt','') is null) then raise exception 'Retainer period already paid'; end if;
   for p in select value from jsonb_array_elements(r->'payments') loop
    if coalesce(p->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and jsonb_typeof(p->'title')='string' and length(trim(p->>'title')) between 1 and 120
     and jsonb_typeof(p->'clientName')='string' and length(trim(p->>'clientName')) between 1 and 120
     and p->>'billingDay' ~ '^[0-9]{1,2}$' and (p->>'billingDay')::integer between 1 and 31
     and p->>'dueOn' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (p->>'dueOn')::date::text=p->>'dueOn'
     and p->>'receivedOn' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (p->>'receivedOn')::date::text=p->>'receivedOn'
     and p->>'receivedOn'>=p->>'dueOn' and (p->>'receivedOn')::date<=(now() at time zone 'America/Argentina/Buenos_Aires')::date
     and p->>'currency' in('USD','ARS') and jsonb_typeof(p->'amountMinor')='number' and p->>'amountMinor' ~ '^[1-9][0-9]{0,11}$' and (p->>'amountMinor')::bigint<=100000000000
     and jsonb_typeof(p->'exchangeRate')='number' and (p->>'exchangeRate')::numeric between .000001 and 1000000
     and (p->>'currency'<>'USD' or (p->>'exchangeRate')::numeric=1)
     and jsonb_typeof(p->'projectIds')='array' and jsonb_typeof(p->'accountId')='string' and length(p->>'accountId')<=100,false) is not true then raise exception 'Invalid retainer receipt'; end if;
    for t in select value from jsonb_array_elements(p->'projectIds') loop
     if jsonb_typeof(t)<>'string' or (t#>>'{}') !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Invalid receipt project'; end if;
    end loop;
    if nullif(p->>'voidedAt','') is not null then perform (p->>'voidedAt')::timestamptz;
    elsif p->>'dueOn'=r->>'nextDue' then raise exception 'Next retainer period is already paid'; end if;
   end loop;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function private.guard_work_retainers() from public,anon,authenticated,service_role;
create trigger guard_work_retainers after update on public.work_preferences for each row execute function private.guard_work_retainers();

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
 or exists(select 1 from public.work_clients c,
 lateral jsonb_array_elements(coalesce(c.record->'retainers','[]'::jsonb)) r(value),
 lateral jsonb_array_elements_text(r.value->'times') t(value)
 where c.user_id=p.user_id and c.record->>'archived'='false' and r.value->>'archived'='false' and r.value->>'paused'='false' and r.value->>'reminderEnabled'='true'
 and r.value->>'nextDue'<=(p_now at time zone 'America/Argentina/Buenos_Aires')::date::text
 and p_now>=(((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || t.value || ':00-03:00')::timestamptz)
 and p_now<(((p_now at time zone 'America/Argentina/Buenos_Aires')::date::text || 'T' || t.value || ':00-03:00')::timestamptz)+interval '15 minutes')
$$;
revoke all on function public.work_notification_states(timestamptz) from public,anon,authenticated;
grant execute on function public.work_notification_states(timestamptz) to service_role;
