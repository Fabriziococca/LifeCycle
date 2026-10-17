-- Owner approved two separate weekly cards. Preserve the existing 21-day
-- exterior card, all records, pauses, alerts and every other account.
set lock_timeout='5s';
set statement_timeout='30s';
do $migration$
declare uid uuid; owners integer; document jsonb; hygiene jsonb; registry jsonb;
 original_registry jsonb; original_hygiene jsonb; was_string boolean; card jsonb;
 definitions jsonb := $cards$[{"id":"trk_hygiene_computer_screen","section":"hygiene","subsection":"tecnologia","template":"routine","name":"Computadora · Pantalla","actionLabel":"Registrar limpieza de pantalla","cadence":{"unit":"days","value":7},"intervalDays":7,"thresholds":{"mode":"automatic","yellow":4,"orange":5,"red":7},"icon":"ph-laptop","instructions":"Apagar y desconectar el equipo. Usar microfibra limpia, suave y sin presión. Si hace falta, apenas humedecida con agua o un producto autorizado por el manual; aplicar al paño, nunca a la pantalla. No usar alcohol al 99 % ni limpiavidrios sin confirmar compatibilidad.","group":null,"behavior":{},"state":null,"legacySource":null,"alertKey":"custom_tracker:trk_hygiene_computer_screen","archived":false,"paused":false,"pausedAt":null,"pausedKm":null,"pausePeriods":[],"deleted":false,"deletedAt":null,"order":0,"createdAt":null,"updatedAt":null,"alert":{"enabled":true,"time":"23:00","times":["23:00"]}},{"id":"trk_hygiene_computer_keyboard_dust","section":"hygiene","subsection":"tecnologia","template":"routine","name":"Computadora · Polvo del teclado","actionLabel":"Registrar limpieza de polvo","cadence":{"unit":"days","value":7},"intervalDays":7,"thresholds":{"mode":"automatic","yellow":4,"orange":5,"red":7},"icon":"ph-laptop","instructions":"Apagar y desconectar el equipo. Retirar el polvo superficial con el método y la herramienta indicados por el fabricante. No asumir que una aspiradora o soplador doméstico es apto para electrónica; evitar chorros potentes y herramientas sin protección antiestática. Esto no reemplaza la limpieza exterior completa.","group":null,"behavior":{},"state":null,"legacySource":null,"alertKey":"custom_tracker:trk_hygiene_computer_keyboard_dust","archived":false,"paused":false,"pausedAt":null,"pausedKm":null,"pausePeriods":[],"deleted":false,"deletedAt":null,"order":0,"createdAt":null,"updatedAt":null,"alert":{"enabled":true,"time":"23:00","times":["23:00"]}}]$cards$::jsonb;
 stamp text; next_order integer;
begin
 select count(*) into owners from private.lifecycle_access_profiles where access_tier='owner';
 if owners=0 then return; end if;
 if owners<>1 then raise exception 'Expected one owner'; end if;
 select user_id into uid from private.lifecycle_access_profiles where access_tier='owner';
 select data into document from public.user_data where user_id=uid for update;
 if not found then raise exception 'Owner document missing'; end if;
 was_string:=jsonb_typeof(document->'hygiene_tracker_data')='string';
 hygiene:=case when was_string then (document->>'hygiene_tracker_data')::jsonb else document->'hygiene_tracker_data' end;
 registry:=hygiene->'__trackers_v2';original_registry:=registry;original_hygiene:=hygiene;
 if jsonb_typeof(registry->'trackers') is distinct from 'array' or jsonb_typeof(registry->'histories') is distinct from 'object' then raise exception 'Expected configurable card registry'; end if;
 select coalesce(max((x->>'order')::integer),-1)+1 into next_order from jsonb_array_elements(registry->'trackers') x;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 for card in select value from jsonb_array_elements(definitions) loop
  if exists(select 1 from jsonb_array_elements(registry->'trackers') x where x->>'id'=card->>'id') then continue; end if;
  if (registry->'deletedTrackerIds') ? (card->>'id') then raise exception 'Requested card was previously deleted; review before recreating'; end if;
  if exists(select 1 from jsonb_array_elements(registry->'trackers') x where x->>'name'=card->>'name') then raise exception 'A card with this name already exists'; end if;
  card:=card||jsonb_build_object('createdAt',stamp,'updatedAt',stamp,'order',next_order);
  registry:=jsonb_set(registry,'{trackers}',(registry->'trackers')||jsonb_build_array(card));
  registry:=jsonb_set(registry,array['histories',card->>'id'],'[]'::jsonb);
  next_order:=next_order+1;
 end loop;
 if registry=original_registry then return; end if;
 if not((registry->'trackers') @> (original_registry->'trackers')) or not((registry->'histories') @> (original_registry->'histories'))
    or registry-'trackers'-'histories' is distinct from original_registry-'trackers'-'histories' then raise exception 'Existing cards or histories changed'; end if;
 hygiene:=jsonb_set(hygiene,'{__trackers_v2}',registry);
 if hygiene-'__trackers_v2' is distinct from original_hygiene-'__trackers_v2' then raise exception 'Legacy data changed'; end if;
 update public.user_data set data=jsonb_set(document,'{hygiene_tracker_data}',case when was_string then to_jsonb(hygiene::text) else hygiene end),updated_at=now() where user_id=uid;
end;
$migration$;
