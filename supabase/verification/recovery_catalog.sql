-- Compare LifeCycle schema metadata on the source and the disposable restore.
select 'table' as kind, n.nspname||'.'||c.relname as name,
       concat_ws('|',c.relrowsecurity,c.relforcerowsecurity,c.relreplident) as shape
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and c.relkind='r'
union all
select 'function', p.oid::regprocedure::text, concat_ws('|',p.prosecdef,p.provolatile)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and not exists (
    select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'
)
union all
select 'trigger', c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and not t.tgisinternal
union all
select 'column', table_schema||'.'||table_name||'.'||column_name,
       concat_ws('|',data_type,is_nullable,column_default)
from information_schema.columns where table_schema in ('public','private')
union all
select 'index', schemaname||'.'||indexname, indexdef
from pg_indexes where schemaname in ('public','private')
union all
select 'policy', schemaname||'.'||tablename||'.'||policyname, concat_ws('|',cmd,roles::text,qual,with_check)
from pg_policies where schemaname in ('public','private') or (schemaname='storage' and tablename='objects')
union all
select 'constraint', n.nspname||'.'||c.relname||'.'||k.conname, pg_get_constraintdef(k.oid)
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private')
union all
select 'realtime', pubname, schemaname||'.'||tablename
from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
union all
select 'bucket', id, concat_ws('|',public,file_size_limit,allowed_mime_types::text)
from storage.buckets where id in ('blood-tests','transcription-audio')
order by 1,2;
