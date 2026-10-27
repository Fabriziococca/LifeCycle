-- Additive validation: no existing reminders, schedules or permissions change.
set lock_timeout='5s';
set statement_timeout='30s';
create function private.guard_client_maintenance_escalation() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare m jsonb:=new.record->'maintenance';
begin
 if m ? 'escalationDays' and coalesce(
  jsonb_typeof(m->'escalationDays')='number'
  and m->>'escalationDays' ~ '^[1-9][0-9]{0,3}$'
  and (m->>'escalationDays')::integer between 1 and 3650
  and coalesce(m->>'repeatUntilDone','true')='true',false) is not true
 then raise exception 'Invalid maintenance escalation'; end if;
 return new;
end $$;
revoke all on function private.guard_client_maintenance_escalation() from public,anon,authenticated,service_role;
create trigger guard_client_maintenance_escalation before insert or update on public.work_followups
 for each row execute function private.guard_client_maintenance_escalation();
