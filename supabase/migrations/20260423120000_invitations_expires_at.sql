-- ============================================================
-- Invitations: add expires_at + enforce expiry on acceptance
-- ============================================================

alter table public.invitations
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days');

create index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_family_pending_idx
  on public.invitations (family_id, accepted, expires_at);

-- Make existing "invitee can accept invitation" policy expiry-aware.
-- Note: policy names are stable in `.claude/schema.sql`.
drop policy if exists "invitee can accept invitation" on public.invitations;
create policy "invitee can accept invitation"
  on public.invitations for update
  using (
    email = (select email from public.profiles where id = auth.uid())
    and accepted = false
    and expires_at > now()
  );

