-- Keep medical attachments private and scoped to the authenticated user's folder.
update storage.buckets
set
    public = false,
    file_size_limit = 15728640,
    allowed_mime_types = array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
    ]::text[]
where id = 'blood-tests';

drop policy if exists "Public read access for blood-tests" on storage.objects;
drop policy if exists "Users can delete their own files" on storage.objects;
drop policy if exists "Users can insert their own files" on storage.objects;
drop policy if exists "Users can read their own blood tests" on storage.objects;
drop policy if exists "Users can insert their own blood tests" on storage.objects;
drop policy if exists "Users can delete their own blood tests" on storage.objects;

create policy "Users can read their own blood tests"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'blood-tests'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can insert their own blood tests"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'blood-tests'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete their own blood tests"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'blood-tests'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- This event-trigger helper only needs to be executable by its owner.
revoke execute on function public.rls_auto_enable() from public;
