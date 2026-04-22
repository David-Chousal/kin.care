-- Health log optional photo stored in Supabase Storage (path saved on health_logs.photo_path).

alter table public.health_logs
  add column if not exists photo_path text;

comment on column public.health_logs.photo_path is
  'Object path inside bucket health-log-photos (family_id/filename).';

-- Bucket for wound / progression images (public URLs; path is unguessable).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'health-log-photos',
  'health-log-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

drop policy if exists "health log photos select" on storage.objects;
create policy "health log photos select"
  on storage.objects for select
  using (
    bucket_id = 'health-log-photos'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "health log photos insert" on storage.objects;
create policy "health log photos insert"
  on storage.objects for insert
  with check (
    bucket_id = 'health-log-photos'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "health log photos update" on storage.objects;
create policy "health log photos update"
  on storage.objects for update
  using (
    bucket_id = 'health-log-photos'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "health log photos delete" on storage.objects;
create policy "health log photos delete"
  on storage.objects for delete
  using (
    bucket_id = 'health-log-photos'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

notify pgrst, 'reload schema';
