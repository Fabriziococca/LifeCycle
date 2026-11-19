-- Preserve all existing quota, allowlist and domain checks in the original writer.
set lock_timeout = '5s';
set statement_timeout = '30s';
alter function public.merge_user_data_keys(jsonb, text[]) set schema private;
revoke all on function private.merge_user_data_keys(jsonb, text[]) from public, anon, authenticated, service_role;

create function public.merge_user_data_keys(p_updates jsonb default '{}', p_delete_keys text[] default '{}')
returns timestamptz language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
    owner_id uuid := auth.uid();
    current_tasks jsonb;
    current_revision bigint;
    candidate jsonb;
begin
    if owner_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
    if p_updates ? 'tareas_list' or 'tareas_list' = any(p_delete_keys) then
        select data->'tareas_list', revision into current_tasks, current_revision from public.user_data where user_id = owner_id for update;
        if not found then
            perform private.merge_user_data_keys('{}', '{}');
            select data->'tareas_list', revision into current_tasks, current_revision from public.user_data where user_id = owner_id for update;
        end if;
        candidate := p_updates->'tareas_list';
        if p_updates ? '__task_revision' then
            if p_updates->'__task_revision' is distinct from to_jsonb(current_revision) then
                raise exception 'Las tareas cambiaron en otro dispositivo.' using errcode = '40001';
            end if;
        elsif p_updates ? '__expected_task_list' then
            if p_updates->'__expected_task_list' is distinct from coalesce(current_tasks, 'null'::jsonb) then
                raise exception 'Las tareas cambiaron en otro dispositivo.' using errcode = '40001';
            end if;
        elsif candidate is distinct from current_tasks or 'tareas_list' = any(p_delete_keys) then
            raise exception 'Actualizá LifeCycle para sincronizar tus tareas pendientes.' using errcode = '40001';
        end if;
    end if;
    return private.merge_user_data_keys(p_updates - '__expected_task_list' - '__task_revision', p_delete_keys);
end;
$$;
revoke all on function public.merge_user_data_keys(jsonb, text[]) from public, anon, service_role;
grant execute on function public.merge_user_data_keys(jsonb, text[]) to authenticated;
notify pgrst, 'reload schema';
