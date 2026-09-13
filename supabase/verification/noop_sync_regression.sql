-- Run with the administrative verification connection. Never commit fixtures.
-- Uses the smallest existing document, locks it briefly and rolls back all edits.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
do $test$
declare
    test_user uuid;
    original public.user_data%rowtype;
    actual public.user_data%rowtype;
    changed public.user_data%rowtype;
    returned_at timestamptz;
    other_hash text;
begin
    select user_id into test_user from public.user_data order by octet_length(data::text) limit 1;
    if test_user is null then raise exception 'An existing test document is required'; end if;
    select * into original from public.user_data where user_id = test_user for update;
    select md5(coalesce(jsonb_agg(data order by user_id)::text, '[]')) into other_hash
    from public.user_data where user_id <> test_user;
    perform set_config('request.jwt.claim.sub', test_user::text, true);

    returned_at := public.merge_user_data_keys('{}', array[]::text[]);
    select * into actual from public.user_data where user_id = test_user;
    if original is distinct from actual or returned_at is distinct from original.updated_at then
        raise exception 'Empty patch changed a row or broke the timestamp contract';
    end if;

    perform public.merge_user_data_keys(jsonb_build_object('vehicle_odometer', '123456789'), array[]::text[]);
    select * into changed from public.user_data where user_id = test_user;
    if changed.data->>'vehicle_odometer' <> '123456789' then raise exception 'Real edit failed'; end if;
    returned_at := public.merge_user_data_keys(jsonb_build_object('vehicle_odometer', '123456789'), array[]::text[]);
    select * into actual from public.user_data where user_id = test_user;
    if actual is distinct from changed or returned_at is distinct from changed.updated_at then
        raise exception 'Repeated value generated a row update';
    end if;

    perform public.merge_user_data_keys('{}', array['vehicle_odometer']);
    select * into actual from public.user_data where user_id = test_user;
    if actual.data ? 'vehicle_odometer' or actual.revision <> changed.revision + 1 then
        raise exception 'Intentional key deletion failed';
    end if;
    changed := actual;
    perform public.merge_user_data_keys('{}', array['vehicle_odometer']);
    select * into actual from public.user_data where user_id = test_user;
    if actual is distinct from changed then raise exception 'Missing key deletion generated an update'; end if;

    if (select md5(coalesce(jsonb_agg(data order by user_id)::text, '[]')) from public.user_data where user_id <> test_user)
        is distinct from other_hash then raise exception 'Another account changed'; end if;
    begin
        perform public.merge_user_data_keys('{"alerts_sent_log":"forbidden"}', array[]::text[]);
        raise exception 'Server-managed key accepted';
    exception when sqlstate '22023' then null;
    end;
    perform set_config('request.jwt.claim.sub', '', true);
    begin
        perform public.merge_user_data_keys('{}', array[]::text[]);
        raise exception 'Unauthenticated call accepted';
    exception when sqlstate '28000' then null;
    end;
    if has_function_privilege('anon', 'public.merge_user_data_keys(jsonb,text[])', 'execute') then
        raise exception 'Anonymous execute permission was granted';
    end if;
end;
$test$;
rollback;
select 'PASS: all fixture changes rolled back' as result;
