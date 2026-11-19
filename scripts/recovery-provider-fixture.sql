-- Minimal local interfaces used by LifeCycle. Hosted Supabase supplies these objects.
create schema auth;
create schema storage;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets(id), name text not null, owner uuid,
    metadata jsonb, created_at timestamptz default now(), unique(bucket_id,name));
create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]
$$;
alter table storage.objects enable row level security;
grant usage on schema auth,storage to authenticated, service_role;
grant select,insert,update,delete on storage.objects to authenticated, service_role;
create publication supabase_realtime;
