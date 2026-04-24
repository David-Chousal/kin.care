-- Run in Supabase SQL Editor (staging) when delete-account returns 500 and the error mentions
-- foreign key, profiles, or families.created_by.
--
-- Replace USER_UUID_HERE with the auth user UUID you are deleting (two occurrences).

-- 1) Families this user belongs to + whether they are still recorded as creator
select
  f.id as family_id,
  f.name,
  f.created_by,
  (f.created_by = 'USER_UUID_HERE'::uuid) as user_is_creator,
  (select count(*)::int from public.family_members fm where fm.family_id = f.id) as member_count
from public.families f
inner join public.family_members fm on fm.family_id = f.id and fm.user_id = 'USER_UUID_HERE'::uuid;

-- 2) If user_is_creator is true and member_count > 1, the Edge Function must reassign
--    created_by before removing membership, or auth.admin.deleteUser can fail on profiles FK.
