-- ============================================================
-- Invitations: prevent malformed emails (server-side protection)
-- ============================================================

-- Normalize existing data as best-effort (won't fix truly invalid strings).
update public.invitations
set email = lower(btrim(email))
where email is not null
  and email <> lower(btrim(email));

-- Enforce a basic, real-world email shape and normalization.
-- NOT VALID: avoids failing on any legacy bad rows; still blocks new inserts/updates.
alter table public.invitations
  add constraint invitations_email_shape_chk
  check (
    email = lower(btrim(email))
    and lower(email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
  not valid;

