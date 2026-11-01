-- Additive client links, exact-day cycles and expense-free tracking renewals.
set lock_timeout = '5s';
set statement_timeout = '30s';
create or replace function private.subscription_next_cycle(s jsonb,d date)
returns date language plpgsql immutable security invoker set search_path=pg_catalog,pg_temp as $$
declare days integer; months integer; anchor integer; target date; last_day integer;
begin
 if s ? 'periodDays' then
  if jsonb_typeof(s->'periodDays')<>'number' or (s->>'periodDays')::numeric<>trunc((s->>'periodDays')::numeric) then raise exception 'Invalid day cycle'; end if;
  days:=(s->>'periodDays')::integer;
  if days not between 1 and 3650 then raise exception 'Invalid day cycle'; end if;
  return d+days;
 end if;
 months:=coalesce((s->>'periodMonths')::integer,1);
 anchor:=coalesce((s->>'billingAnchorDay')::integer,extract(day from d)::integer);
 if months not between 1 and 120 or anchor not between 1 and 31 then raise exception 'Invalid billing cycle'; end if;
 target:=(date_trunc('month',d)+make_interval(months=>months))::date;
 last_day:=extract(day from target+interval '1 month - 1 day');
 return target+(case when coalesce((s->>'billingAnchorIsMonthEnd')::boolean,d=(date_trunc('month',d)+interval '1 month - 1 day')::date) then last_day else least(anchor,last_day) end)-1;
end; $$;
revoke all on function private.subscription_next_cycle(jsonb,date) from public,anon,authenticated,service_role;
create or replace function private.subscription_client_active(uid uuid,s jsonb)
returns boolean language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select coalesce(s->>'clientId','')='' or exists(select 1 from public.work_clients c where c.user_id=uid and c.id::text=s->>'clientId' and not coalesce((c.record->>'archived')::boolean,false));
$$;
revoke all on function private.subscription_client_active(uuid,jsonb) from public,anon,authenticated,service_role;
create or replace function private.renew_subscription_occurrence(
    p_user_id uuid, p_id text, p_date date, p_ars_per_usd numeric, p_automatic boolean
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare
    doc jsonb; registry jsonb; finance jsonb; items jsonb; sub jsonb;
    expenses jsonb; history jsonb; expense jsonb; occurrence text;
    idx integer; cost numeric; amount numeric; duplicate boolean;
    next_date date; target_month date; last_day integer; anchor integer; month_end boolean;
    ts timestamptz := clock_timestamp(); revision_out bigint;
begin
    if p_user_id is null or p_id is null or p_date is null then raise exception 'Invalid renewal'; end if;
    select data into doc from public.user_data where user_id=p_user_id for update;
    if not found then raise exception 'Subscription document not found'; end if;
    registry := private.subscription_json_object(doc->'lifecycle_subscriptions');
    items := coalesce(registry->'subscriptions','[]'::jsonb);
    select value, (ordinality-1)::integer into sub,idx
      from jsonb_array_elements(items) with ordinality where value->>'id'=p_id;
    if sub is null then raise exception 'Subscription not found'; end if;
    if not private.subscription_client_active(p_user_id,sub) then raise exception 'Subscription client is archived or unavailable'; end if;
    if sub->>'status' is distinct from 'active' or coalesce(sub->>'billingMode','paid')<>'paid' then
        raise exception 'Subscription is not active and paid';
    end if;
    if p_automatic and (sub->>'autoRenew' is distinct from 'true' or sub->>'autoRecordExpense' is distinct from 'true'
       or p_date > (ts at time zone 'America/Argentina/Buenos_Aires')::date) then
        raise exception 'Automatic renewal is not eligible';
    end if;
    finance := private.subscription_json_object(doc->'finanzasData');
    expenses := coalesce(finance->'expenses','[]'::jsonb);
    history := coalesce(sub->'history','[]'::jsonb);
    occurrence := 'subscription:'||p_id||':renewal:'||p_date::text;
    select exists(select 1 from jsonb_array_elements(expenses) e where e->>'subscriptionOccurrenceKey'=occurrence
      or (not (e ? 'subscriptionOccurrenceKey') and e->>'subscriptionId'=p_id and e->>'date'=p_date::text))
      or sub->>'lastExpenseRecordedPeriod'=occurrence
      or exists(select 1 from jsonb_array_elements(history) e where e->>'occurrenceKey'=occurrence and e->>'type'='expense-recorded')
      into duplicate;
    duplicate := coalesce(duplicate,false);
    if sub->>'nextRenewalDate'<>p_date::text then
        if duplicate then return jsonb_build_object('created',false,'duplicate',true,'finance_data',finance,'subscription_registry',registry); end if;
        raise exception 'Subscription renewal changed; refresh and retry' using errcode='40001';
    end if;
    if duplicate and not coalesce((sub->>'autoRenew')::boolean,true) then
        return jsonb_build_object('created',false,'duplicate',true,'finance_data',finance,'subscription_registry',registry);
    end if;
    cost := (sub->>'cost')::numeric;
    if cost is null or cost<=0 or cost>1000000000 then raise exception 'Invalid subscription cost'; end if;
    if not duplicate then
        if sub->>'currency'='ARS' then
            if p_ars_per_usd is null or p_ars_per_usd<=0 or p_ars_per_usd>1000000000 then
                raise exception 'Valid ARS conversion required';
            end if;
            amount := round(cost/p_ars_per_usd,2);
        else amount := round(cost,2); end if;
        if amount<=0 or amount>1000000000 then raise exception 'Invalid converted amount'; end if;
        expense := jsonb_build_object('id','subexpense_'||p_id||'_'||p_date::text,
          'category','servicios','date',p_date::text,'amount',amount,
          'description','[Suscripción: '||(sub->>'name')||'] Renovación '||p_date::text,
          'subscriptionId',p_id,'subscriptionOccurrenceKey',occurrence,'autoRecorded',p_automatic,
          'originalAmount',cost,'originalCurrency',coalesce(sub->>'currency','USD'),
          'exchangeRate',case when sub->>'currency'='ARS' then p_ars_per_usd else null end);
        expenses := expenses||jsonb_build_array(expense);
        history := history||jsonb_build_array(jsonb_build_object('id','subevt_expense_'||p_date::text,
          'type','expense-recorded','occurredAt',ts,'effectiveDate',p_date::text,'occurrenceKey',occurrence,
          'cost',cost,'currency',coalesce(sub->>'currency','USD'),
          'note',case when p_automatic then 'Registro automático del servidor' else 'Confirmación manual' end));
    end if;
    sub := sub||jsonb_build_object('lastExpenseRecordedPeriod',occurrence,'updatedAt',ts);
    if coalesce((sub->>'autoRenew')::boolean,true) then
        next_date := private.subscription_next_cycle(sub,p_date);
        anchor := coalesce((sub->>'billingAnchorDay')::integer,extract(day from p_date)::integer);
        month_end := coalesce((sub->>'billingAnchorIsMonthEnd')::boolean,p_date=(date_trunc('month',p_date)+interval '1 month - 1 day')::date);
        sub := sub||jsonb_build_object('nextRenewalDate',next_date::text,'billingAnchorDay',anchor,'billingAnchorIsMonthEnd',month_end);
        history := history||jsonb_build_array(jsonb_build_object('id','subevt_renew_'||p_date::text,
          'type','renewed','occurredAt',ts,'effectiveDate',p_date::text,'occurrenceKey',occurrence,
          'cost',cost,'currency',coalesce(sub->>'currency','USD')));
    end if;
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into history
      from jsonb_array_elements(history) with ordinality where ordinality>jsonb_array_length(history)-5000;
    sub := sub||jsonb_build_object('history',history);
    registry := jsonb_set(registry,'{subscriptions}',jsonb_set(items,array[idx::text],sub));
    finance := jsonb_set(finance,'{expenses}',expenses,true);
    doc := jsonb_set(doc,'{lifecycle_subscriptions}',case when jsonb_typeof(doc->'lifecycle_subscriptions')='string' then to_jsonb(registry::text) else registry end,true);
    doc := jsonb_set(doc,'{finanzasData}',case when jsonb_typeof(doc->'finanzasData')='object' then finance else to_jsonb(finance::text) end,true);
    update public.user_data set data=doc,updated_at=ts where user_id=p_user_id and data is distinct from doc returning revision into revision_out;
    return jsonb_build_object('created',not duplicate,'duplicate',duplicate,'finance_data',finance,
      'subscription_registry',registry,'next_date',next_date,'document_revision',revision_out);
end; $$;
revoke all on function private.renew_subscription_occurrence(uuid,text,date,numeric,boolean) from public,anon,authenticated,service_role;

-- Retain the existing browser RPC signature across deployment/rollback.

-- Service-role-only: advances the calendar, never creates an expense or a payment.
create or replace function public.advance_subscription_tracking_for_scheduler(p_user_id uuid,p_subscription_id text,p_due_date date)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare doc jsonb; reg jsonb; items jsonb; s jsonb; idx integer; next_date date; hist jsonb; ts timestamptz:=clock_timestamp(); last_time time; notice_time time;
begin
 select data into doc from public.user_data where user_id=p_user_id for update;
 if not found then raise exception 'Subscription document not found'; end if;
 reg:=private.subscription_json_object(doc->'lifecycle_subscriptions');items:=coalesce(reg->'subscriptions','[]');
 select value,(ordinality-1)::integer into s,idx from jsonb_array_elements(items) with ordinality where value->>'id'=p_subscription_id;
 if s is null then return jsonb_build_object('skipped',true); end if;
 if s->>'status'<>'active' or s->>'billingMode'<>'tracking' or not coalesce((s->>'autoRenew')::boolean,true) or not private.subscription_client_active(p_user_id,s) then return jsonb_build_object('skipped',true); end if;
 if s->>'nextRenewalDate' is distinct from p_due_date::text then return jsonb_build_object('duplicate',true,'next_date',s->>'nextRenewalDate'); end if;
 last_time:=coalesce(nullif(s->>'renewalTime',''),'23:59')::time;
 if coalesce((s#>>'{alert,enabled}')::boolean,true) then
  select max(least(value::time,last_time)) into notice_time from jsonb_array_elements_text(coalesce(s#>'{alert,times}','["09:00"]'));
  last_time:=greatest(last_time,notice_time);
 end if;
 if ts < ((p_due_date+last_time) at time zone 'America/Argentina/Buenos_Aires')+interval '15 minutes' then return jsonb_build_object('skipped',true); end if;
 next_date:=private.subscription_next_cycle(s,p_due_date);
 hist:=coalesce(s->'history','[]')||jsonb_build_array(jsonb_build_object('id','subevt_track_'||p_due_date::text,'type','renewed','occurredAt',ts,'effectiveDate',p_due_date::text,'cost',0,'currency',coalesce(s->>'currency','USD'),'note','Ciclo programado avanzado; no confirma un pago.'));
 select coalesce(jsonb_agg(value order by ordinality),'[]') into hist from jsonb_array_elements(hist) with ordinality where ordinality>jsonb_array_length(hist)-5000;
 s:=s||jsonb_build_object('nextRenewalDate',next_date::text,'history',hist,'updatedAt',ts);
 reg:=jsonb_set(reg,'{subscriptions}',jsonb_set(items,array[idx::text],s));
 doc:=jsonb_set(doc,'{lifecycle_subscriptions}',case when jsonb_typeof(doc->'lifecycle_subscriptions')='string' then to_jsonb(reg::text) else reg end);
 update public.user_data set data=doc,updated_at=ts where user_id=p_user_id and data is distinct from doc;
 return jsonb_build_object('created',true,'next_date',next_date);
end; $$;
revoke all on function public.advance_subscription_tracking_for_scheduler(uuid,text,date) from public,anon,authenticated;
grant execute on function public.advance_subscription_tracking_for_scheduler(uuid,text,date) to service_role;
