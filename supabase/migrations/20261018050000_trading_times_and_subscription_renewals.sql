-- Additive, compatible with the currently deployed browser and server.
set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function private.subscription_json_object(p_value jsonb)
returns jsonb language plpgsql immutable security invoker
set search_path = pg_catalog, pg_temp as $$
declare v jsonb;
begin
    v := case when jsonb_typeof(p_value)='string' then (p_value#>>'{}')::jsonb else p_value end;
    if v is null then return '{}'::jsonb; end if;
    if jsonb_typeof(v)<>'object' then raise exception 'Invalid subscription document'; end if;
    return v;
end; $$;
revoke all on function private.subscription_json_object(jsonb) from public,anon,authenticated,service_role;

-- Both the manual action and the scheduler use this exact locked transaction.
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
        anchor := coalesce((sub->>'billingAnchorDay')::integer,extract(day from p_date)::integer);
        if anchor not between 1 and 31 then raise exception 'Invalid billing anchor'; end if;
        month_end := coalesce((sub->>'billingAnchorIsMonthEnd')::boolean,
          p_date=(date_trunc('month',p_date)+interval '1 month - 1 day')::date);
        if coalesce((sub->>'periodMonths')::integer,1) not between 1 and 120 then raise exception 'Invalid billing period'; end if;
        target_month := (date_trunc('month',p_date)+make_interval(months=>coalesce((sub->>'periodMonths')::integer,1)))::date;
        last_day := extract(day from target_month+interval '1 month - 1 day')::integer;
        next_date := target_month+(case when month_end then last_day else least(anchor,last_day) end)-1;
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
create or replace function public.record_subscription_expense(
    p_subscription_id text,p_subscription_name text,p_amount_usd numeric,p_expense_date date,
    p_occurrence_key text,p_period text default 'Renovación',p_automatic boolean default false
) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare uid uuid:=auth.uid(); cost numeric; currency text; reg jsonb;
begin
    if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
    if p_occurrence_key is distinct from 'subscription:'||p_subscription_id||':renewal:'||p_expense_date::text
       or p_amount_usd is null or p_amount_usd<=0 then raise exception 'Invalid subscription expense payload'; end if;
    -- The private operation rechecks and locks the current subscription. This read
    -- only recovers the exchange rate supplied by the compatible browser contract.
    select private.subscription_json_object(data->'lifecycle_subscriptions') into reg from public.user_data where user_id=uid for update;
    select (s->>'cost')::numeric,s->>'currency' into cost,currency from jsonb_array_elements(reg->'subscriptions') s where s->>'id'=p_subscription_id;
    return private.renew_subscription_occurrence(uid,p_subscription_id,p_expense_date,
      case when currency='ARS' then cost/p_amount_usd else null end,coalesce(p_automatic,false));
end; $$;
revoke all on function public.record_subscription_expense(text,text,numeric,date,text,text,boolean) from public,anon,service_role;
grant execute on function public.record_subscription_expense(text,text,numeric,date,text,text,boolean) to authenticated;

create or replace function public.renew_subscription_for_scheduler(p_user_id uuid,p_subscription_id text,p_due_date date,p_ars_per_usd numeric default null)
returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
    select private.renew_subscription_occurrence(p_user_id,p_subscription_id,p_due_date,p_ars_per_usd,true)
      -'finance_data'-'subscription_registry';
$$;
revoke all on function public.renew_subscription_for_scheduler(uuid,text,date,numeric) from public,anon,authenticated;
grant execute on function public.renew_subscription_for_scheduler(uuid,text,date,numeric) to service_role;

alter table public.trading_events add column if not exists notice_times text[] not null default '{}';


create or replace function private.sync_trading_events_for_user(
    p_user_id uuid,
    p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_events jsonb := private.extract_trading_events(p_data);
    v_event jsonb;
    v_id text;
    v_company text;
    v_ticker text;
    v_name text;
    v_notes text;
    v_source_url text;
    v_status text;
    v_scheduled_at timestamptz;
    v_created_at timestamptz;
    v_updated_at timestamptz;
    v_notice_days smallint[];
    v_notice_times text[];
begin
    if p_user_id is null then
        raise exception 'p_user_id is required'
            using errcode = '22023';
    end if;

    delete from public.trading_events
    where user_id = p_user_id;

    for v_event in
        select candidate.value
        from jsonb_array_elements(v_events) with ordinality as candidate(value, position)
        where candidate.position <= 10000
        order by candidate.position
    loop
        begin
            if jsonb_typeof(v_event) <> 'object' then
                continue;
            end if;

            v_id := lower(left(btrim(coalesce(v_event ->> 'id', '')), 96));
            v_company := left(btrim(regexp_replace(
                coalesce(v_event ->> 'company', ''),
                '[[:space:]]+', ' ', 'g'
            )), 100);
            v_ticker := upper(left(btrim(regexp_replace(
                coalesce(v_event ->> 'ticker', ''),
                '[[:space:]]+', ' ', 'g'
            )), 20));
            v_name := left(btrim(regexp_replace(
                coalesce(v_event ->> 'name', ''),
                '[[:space:]]+', ' ', 'g'
            )), 120);

            if v_id !~ '^[a-z0-9][a-z0-9_-]{2,95}$'
               or v_company = ''
               or v_name = '' then
                continue;
            end if;

            v_scheduled_at := private.safe_timestamptz(
                v_event ->> 'scheduledAt',
                null
            );
            if v_scheduled_at is null then
                continue;
            end if;

            v_created_at := private.safe_timestamptz(
                v_event ->> 'createdAt',
                v_scheduled_at
            );
            v_updated_at := private.safe_timestamptz(
                v_event ->> 'updatedAt',
                v_created_at
            );

            select coalesce(array_agg(valid.day order by valid.day desc), '{}'::smallint[])
            into v_notice_days
            from (
                select parsed.day::smallint as day
                from (
                    select case
                        when item.value ~ '^[0-9]{1,3}$'
                            then item.value::integer
                        else null
                    end as day
                    from jsonb_array_elements_text(
                        case
                            when jsonb_typeof(v_event -> 'noticeDays') = 'array'
                                then v_event -> 'noticeDays'
                            else '[]'::jsonb
                        end
                    ) as item(value)
                ) as parsed
                where parsed.day between 1 and 365
                group by parsed.day
                order by parsed.day desc
                limit 12
            ) as valid;

            if not private.valid_trading_notice_days(v_notice_days) then
                continue;
            end if;

            v_notes := left(btrim(regexp_replace(
                coalesce(v_event ->> 'notes', ''),
                '[[:space:]]+', ' ', 'g'
            )), 800);
            v_source_url := left(btrim(coalesce(v_event ->> 'sourceUrl', '')), 500);
            if v_source_url <> '' and v_source_url !~* '^https?://' then
                v_source_url := '';
            end if;
            v_status := case
                when v_event ->> 'status' = 'paused' then 'paused'
                else 'active'
            end;

            select coalesce(array_agg(value order by value),'{}'::text[]) into v_notice_times
            from (select distinct value from jsonb_array_elements_text(
                case when jsonb_typeof(v_event->'noticeTimes')='array' then v_event->'noticeTimes' else '[]'::jsonb end)
                where value ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' order by value limit 6) times;

            insert into public.trading_events (
                user_id,
                id,
                company,
                ticker,
                name,
                scheduled_at,
                notes,
                source_url,
                notice_days,
                notice_times,
                status,
                created_at,
                updated_at
            ) values (
                p_user_id,
                v_id,
                v_company,
                v_ticker,
                v_name,
                v_scheduled_at,
                v_notes,
                v_source_url,
                v_notice_days,
                v_notice_times,
                v_status,
                v_created_at,
                v_updated_at
            )
            on conflict (user_id, id) do nothing;
        exception
            when data_exception or integrity_constraint_violation then
                -- Compatibility data should never block the primary cloud save.
                null;
        end;
    end loop;
end;
$$;

-- Rebuild only the relational projection; user documents/history are untouched.
select private.sync_trading_events_for_user(user_id,data) from public.user_data;

create or replace function public.claim_trading_notification_dispatch(
    p_user_id uuid,
    p_alert_key text,
    p_event_id text,
    p_scheduled_at timestamptz,
    p_notice_days integer
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
    v_claimed boolean := false;
begin
    if p_user_id is null
       or btrim(coalesce(p_alert_key, '')) = ''
       or btrim(coalesce(p_event_id, '')) = ''
       or p_scheduled_at is null
       or p_notice_days is null
       or p_notice_days not between 1 and 365 then
        raise exception 'Invalid Trading notification claim'
            using errcode = '22023';
    end if;

    -- An accepted legacy notification covers its original event-hour slot.
    -- Configured one/many hours always retain the same @HH:mm identity.
    if strpos(p_alert_key,'@')>0
       and split_part(p_alert_key,'@',2)=to_char(p_scheduled_at at time zone 'America/Argentina/Buenos_Aires','HH24:MI')
       and exists(select 1 from private.trading_notification_dispatches
           where user_id=p_user_id and alert_key=split_part(p_alert_key,'@',1) and status='sent') then
        return false;
    end if;
    insert into private.trading_notification_dispatches as target (
        user_id,
        alert_key,
        event_id,
        scheduled_at,
        notice_days,
        status,
        claimed_at,
        completed_at,
        attempt_count,
        last_error
    ) values (
        p_user_id,
        left(p_alert_key, 220),
        left(p_event_id, 96),
        p_scheduled_at,
        p_notice_days::smallint,
        'processing',
        now(),
        null,
        1,
        null
    )
    on conflict (user_id, alert_key) do update
    set
        event_id = excluded.event_id,
        scheduled_at = excluded.scheduled_at,
        notice_days = excluded.notice_days,
        status = 'processing',
        claimed_at = now(),
        completed_at = null,
        attempt_count = target.attempt_count + 1,
        last_error = null
    where target.status <> 'sent'
      and (
          target.claimed_at < now() - interval '15 minutes'
          and target.status in ('processing', 'failed')
          or target.claimed_at < now() - interval '1 hour'
          and target.status = 'no_devices'
      )
    returning true into v_claimed;

    return coalesce(v_claimed, false);
end;
$$;
