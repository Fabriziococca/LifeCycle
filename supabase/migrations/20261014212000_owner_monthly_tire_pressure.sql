-- One-time owner-approved monthly tire-pressure control. No invented check date.
set lock_timeout = '5s';
set statement_timeout = '30s';
do $migration$
declare
    owner_id uuid; owner_count integer; document jsonb; tracker jsonb; catalog jsonb;
    was_string boolean; card jsonb; stamp text;
begin
    select count(*) into owner_count from private.lifecycle_access_profiles where access_tier='owner';
    if owner_count=0 then return; end if;
    if owner_count<>1 then raise exception 'Expected exactly one owner'; end if;
    select user_id into owner_id from private.lifecycle_access_profiles where access_tier='owner';
    select data into document from public.user_data where user_id=owner_id for update;
    if not found then raise exception 'Owner document is missing'; end if;
    was_string:=jsonb_typeof(document->'vehicle_tracker_data')='string';
    tracker:=case when was_string then (document->>'vehicle_tracker_data')::jsonb else document->'vehicle_tracker_data' end;
    catalog:=tracker->'vehicleCatalog';
    if jsonb_typeof(catalog->'cards') is distinct from 'array' or jsonb_typeof(catalog->'records') is distinct from 'object' then raise exception 'Expected existing vehicle catalog'; end if;
    if exists(select 1 from jsonb_array_elements(catalog->'cards') c where c->>'id'='vc_tire_pressure_monthly') then return; end if;
    if exists(select 1 from jsonb_array_elements(catalog->'cards') c where coalesce(c->>'name','') ~* 'presi|inflad') then raise exception 'Review existing pressure card before adding another'; end if;
    stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    card:=jsonb_build_object('id','vc_tire_pressure_monthly','legacyId',null,
        'name','Presión de neumáticos (en frío)','type','check','section','maintenance',
        'icon','ph-arrows-clockwise','actionLabel','Registrar revisión en frío',
        'intervalKm',null,'intervalDays',30,'warningKm',null,'warningDays',7,
        'alertKey','vehicle_card:vc_tire_pressure_monthly',
        'alert',jsonb_build_object('enabled',true,'time','09:00','times',jsonb_build_array('09:00')),
        'source',null,'legacyAlertGroup',null,'order',jsonb_array_length(catalog->'cards'),
        'archived',false,'paused',false,'pausedAt',null,'pausedKm',null,'pausePeriods','[]'::jsonb,
        'deleted',false,'createdAt',stamp,'updatedAt',stamp,'deletedAt',null);
    catalog:=catalog||jsonb_build_object('cards',(catalog->'cards')||jsonb_build_array(card),
        'records',(catalog->'records')||jsonb_build_object('vc_tire_pressure_monthly','[]'::jsonb));
    tracker:=jsonb_set(tracker,'{vehicleCatalog}',catalog);
    update public.user_data set data=jsonb_set(document,'{vehicle_tracker_data}',case when was_string then to_jsonb(tracker::text) else tracker end),updated_at=now() where user_id=owner_id;
end;
$migration$;
