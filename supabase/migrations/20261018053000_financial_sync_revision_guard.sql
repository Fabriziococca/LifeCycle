-- A closed browser must not overwrite renewals committed by the scheduler.
set lock_timeout='5s';
set statement_timeout='30s';
create or replace function public.merge_user_data_at_revision(p_updates jsonb,p_delete_keys text[],p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare uid uuid:=auth.uid(); current_revision bigint; updated timestamptz;
begin
    if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
    select revision into current_revision from public.user_data where user_id=uid for update;
    if current_revision is distinct from p_expected_revision or current_revision is null then
        raise exception 'Cloud revision conflict' using errcode='40001';
    end if;
    updated:=public.merge_user_data_keys(p_updates,p_delete_keys);
    select revision into current_revision from public.user_data where user_id=uid;
    return jsonb_build_object('updated_at',updated,'revision',current_revision);
end; $$;
revoke all on function public.merge_user_data_at_revision(jsonb,text[],bigint) from public,anon,service_role;
grant execute on function public.merge_user_data_at_revision(jsonb,text[],bigint) to authenticated;
notify pgrst,'reload schema';
