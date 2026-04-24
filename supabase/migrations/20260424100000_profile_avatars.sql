-- Profile pictures: storage path stored in public.profiles.avatar_url ({user_id}/filename).
-- Access decision: bucket `profile-avatars` is intentionally PUBLIC to allow rendering via `getPublicUrl`.
-- Implication: public bucket object GETs do not enforce Storage RLS; anyone with the object path can fetch it.
-- Mitigation: paths are namespaced under `{user_id}/...` (UUID) and we still enforce RLS for list/write/delete.

comment on column public.profiles.avatar_url is
  'Object path inside bucket profile-avatars ({user_id}/filename).';

alter table public.profiles drop constraint if exists profiles_avatar_storage_path;
alter table public.profiles add constraint profiles_avatar_storage_path check (
  avatar_url is null or split_part(avatar_url, '/', 1) = id::text
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

drop policy if exists "profile avatars select" on storage.objects;
create policy "profile avatars select"
  on storage.objects for select
  using (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile avatars insert" on storage.objects;
create policy "profile avatars insert"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile avatars update" on storage.objects;
create policy "profile avatars update"
  on storage.objects for update
  using (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile avatars delete" on storage.objects;
create policy "profile avatars delete"
  on storage.objects for delete
  using (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

notify pgrst, 'reload schema';
