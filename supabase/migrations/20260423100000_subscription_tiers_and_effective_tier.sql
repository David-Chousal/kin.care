-- ============================================================
-- B2C subscription tiers: operator overrides + RevenueCat cache
--
-- effective_tier resolution (single source of truth — DB layer):
--   1) Valid, non-expired row in public.subscription_overrides (any tier including free)
--   2) Highest active tier from public.rc_subscriptions (family | care_team)
--   3) free
--
-- Writes to overrides and rc_subscriptions: service_role only (Edge Functions, SQL editor).
-- Authenticated users: SELECT own rows only; cannot self-elevate.
-- ============================================================

-- ---- Operator / developer overrides ----
create table public.subscription_overrides (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  tier       text not null check (tier in ('free', 'family', 'care_team')),
  reason     text,
  set_by     uuid references auth.users (id),
  set_at     timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.subscription_overrides is
  'Operator-granted tier override. Precedence over store-backed rc_subscriptions. service_role writes only.';

create index subscription_overrides_expires_at_idx
  on public.subscription_overrides (expires_at)
  where expires_at is not null;

alter table public.subscription_overrides enable row level security;

create policy "users can select own subscription override"
  on public.subscription_overrides
  for select
  using (user_id = auth.uid());

-- ---- RevenueCat (or other store) sync cache — populated by rc-webhook Edge Function ----
create table public.rc_subscriptions (
  user_id        uuid not null references auth.users (id) on delete cascade,
  platform       text not null check (platform in ('ios', 'android', 'stripe', 'promotional')),
  tier           text not null check (tier in ('family', 'care_team')),
  product_id     text,
  is_active      boolean not null default false,
  expires_at     timestamptz,
  will_renew     boolean not null default false,
  rc_app_user_id text,
  rc_event_id    text,
  raw_event      jsonb,
  synced_at      timestamptz not null default now(),
  primary key (user_id, platform)
);

comment on table public.rc_subscriptions is
  'Cached subscription state from RevenueCat webhooks. app_user_id in RC should match user_id (Supabase auth id). service_role writes only.';

create index rc_subscriptions_user_active_idx
  on public.rc_subscriptions (user_id, is_active, expires_at);

alter table public.rc_subscriptions enable row level security;

create policy "users can select own rc subscription rows"
  on public.rc_subscriptions
  for select
  using (user_id = auth.uid());

-- ---- Webhook idempotency (service_role only; no user-facing policies) ----
create table public.rc_webhook_events (
  rc_event_id text primary key,
  user_id     uuid references auth.users (id) on delete set null,
  event_type  text not null,
  received_at timestamptz not null default now()
);

comment on table public.rc_webhook_events is
  'Dedup log for RevenueCat webhook deliveries. Unique rc_event_id ensures idempotent handling.';

alter table public.rc_webhook_events enable row level security;

-- ---- Tier resolution (internal): callable only with service_role (e.g. Edge Functions) ----
create or replace function public.get_effective_tier_for_user(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_override text;
  v_store_rank int := 0;
begin
  if p_user_id is null then
    raise exception 'invalid user';
  end if;

  select so.tier into v_override
  from public.subscription_overrides so
  where so.user_id = p_user_id
    and (so.expires_at is null or so.expires_at > now())
  limit 1;

  if v_override is not null then
    return v_override;
  end if;

  select coalesce(max(case rc.tier when 'care_team' then 2 when 'family' then 1 else 0 end), 0)
    into v_store_rank
  from public.rc_subscriptions rc
  where rc.user_id = p_user_id
    and rc.is_active = true
    and (rc.expires_at is null or rc.expires_at > now());

  if v_store_rank >= 2 then
    return 'care_team';
  elsif v_store_rank >= 1 then
    return 'family';
  end if;

  return 'free';
end;
$$;

comment on function public.get_effective_tier_for_user(uuid) is
  'Returns effective_tier: subscription_overrides (if valid) > rc_subscriptions > free. service_role only.';

revoke all on function public.get_effective_tier_for_user(uuid) from public;
grant execute on function public.get_effective_tier_for_user(uuid) to service_role;

-- ---- Client-safe read: current user only ----
create or replace function public.get_my_effective_tier()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then 'free'::text
    else public.get_effective_tier_for_user(auth.uid())
  end;
$$;

comment on function public.get_my_effective_tier() is
  'Returns effective_tier for the authenticated user (auth.uid()). Uses same precedence as get_effective_tier_for_user.';

revoke all on function public.get_my_effective_tier() from public;
grant execute on function public.get_my_effective_tier() to authenticated;
grant execute on function public.get_my_effective_tier() to service_role;

-- ---- Optional helper for future RLS: tier ordering ----
create or replace function public.is_tier_at_least(p_tier text, p_minimum text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    (case p_tier
       when 'care_team' then 2
       when 'family' then 1
       when 'free' then 0
       else null
     end)
    >=
    (case p_minimum
       when 'care_team' then 2
       when 'family' then 1
       when 'free' then 0
       else null
     end),
    false
  );
$$;

revoke all on function public.is_tier_at_least(text, text) from public;
grant execute on function public.is_tier_at_least(text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
