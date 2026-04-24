-- Optional one-off: grant Family tier to every existing user (beta / pre-IAP).
-- Run in Supabase SQL editor with elevated role (service role context).
-- Remove or expire overrides when store billing is live.
--
-- Adjust tier / reason / set_by as needed.

insert into public.subscription_overrides (user_id, tier, reason, set_by, expires_at)
select
  p.id,
  'family',
  'Beta access — revoke when subscriptions launch',
  p.id,
  null
from public.profiles p
on conflict (user_id) do update
set
  tier = excluded.tier,
  reason = excluded.reason,
  expires_at = excluded.expires_at,
  updated_at = now();
