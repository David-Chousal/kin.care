-- ============================================================
-- Invitations + joins: server-side expiry and invite validation
-- ============================================================
-- 1) family_members: replace permissive "creator can insert themselves"
--    (any user could insert self into any family_id) with (a) first-member
--    insert for family creators and (b) insert only when a matching pending,
--    non-expired invitation exists for the caller's profile email.
-- 2) invitations: invitees need SELECT to resolve token before join; UPDATE
--    policy must use WITH CHECK so accepted=true updates are allowed after
--    USING matched the old pending row.
-- 3) invitations: optional data rule — expiry must be after created_at.

-- ------------------------------------------------------------------
-- Invitations: fix UPDATE policy (WITH CHECK for accepted = true)
-- ------------------------------------------------------------------
drop policy if exists "invitee can accept invitation" on public.invitations;
create policy "invitee can accept invitation"
  on public.invitations for update
  using (
    email = (select p.email from public.profiles p where p.id = auth.uid())
    and accepted = false
    and expires_at > now()
  )
  with check (
    email = (select p.email from public.profiles p where p.id = auth.uid())
    and accepted = true
  );

-- ------------------------------------------------------------------
-- Invitations: invitee can read own pending rows (token lookup path)
-- ------------------------------------------------------------------
drop policy if exists "invitee can view own pending invitations" on public.invitations;
create policy "invitee can view own pending invitations"
  on public.invitations for select
  using (
    accepted = false
    and lower(btrim(email)) = lower(btrim((select p.email from public.profiles p where p.id = auth.uid())))
  );

-- ------------------------------------------------------------------
-- family_members: narrow self-insert to creator-first-member or valid invite
-- ------------------------------------------------------------------
drop policy if exists "creator can insert themselves" on public.family_members;

create policy "family creator can insert self as first member"
  on public.family_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.families f
      where f.id = family_members.family_id
        and f.created_by = auth.uid()
    )
    and not exists (
      select 1 from public.family_members fm
      where fm.family_id = family_members.family_id
    )
  );

create policy "invitee can join via valid invitation"
  on public.family_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.invitations i
      where i.family_id = family_members.family_id
        and i.accepted = false
        and i.expires_at > now()
        and lower(btrim(i.email)) = lower(btrim((select p.email from public.profiles p where p.id = auth.uid())))
        and i.role = family_members.role
    )
  );

-- ------------------------------------------------------------------
-- Invitations: created_at / expires_at sanity (NOT VALID for legacy rows)
-- ------------------------------------------------------------------
alter table public.invitations
  drop constraint if exists invitations_expires_after_created_chk;

alter table public.invitations
  add constraint invitations_expires_after_created_chk
  check (expires_at > created_at)
  not valid;
