# Effective subscription tier (`effective_tier`)

MVP vs Phase 2+ product boundaries: [SUBSCRIPTION_MVP_SCOPE.md](./SUBSCRIPTION_MVP_SCOPE.md).

Server-side resolution for B2C tiers lives in Postgres. **Clients may read tier for UX; they are not authoritative** for paid capabilities (enforce in Edge Functions and/or RLS).

**Display naming:** the default / unpaid tier is shown in the app as **Core**. The persisted and API-facing value remains the internal identifier **`free`** (Postgres, `get_my_effective_tier`, TypeScript `EffectiveTier`).

## Resolution order

1. **Operator override** — row in `public.subscription_overrides` for `auth.users.id` where `expires_at` is null or `expires_at > now()`. Any tier: `free`, `family`, `care_team`.
2. **Store-backed cache** — active rows in `public.rc_subscriptions` (synced from RevenueCat webhooks). Tiers stored: `family`, `care_team`. If both platforms exist, the **higher** tier wins (`care_team` > `family`).
3. **Default** — `free`.

## Functions

| Function | Who can call | Purpose |
|----------|----------------|--------|
| `public.get_effective_tier_for_user(uuid)` | `service_role` only | Used by Edge Functions (e.g. `llm-gateway`) with the authenticated user id. |
| `public.get_my_effective_tier()` | `authenticated`, `service_role` | Returns tier for `auth.uid()` only. |

## Tables (writes: `service_role` only)

- `subscription_overrides` — developer/operator grants; RLS allows users **SELECT** own row only.
- `rc_subscriptions` — RevenueCat webhook upserts; users **SELECT** own rows only.
- `rc_webhook_events` — idempotency log for webhook `event.id`; no user policies.

## Overrides without the stores

Insert or update via **Supabase SQL editor** or any client using the **service role** key (never ship that key in the app). Example:

```sql
insert into public.subscription_overrides (user_id, tier, reason, set_by)
values ('<auth-user-uuid>', 'family', 'internal QA', '<your-admin-uuid>')
on conflict (user_id) do update
set tier = excluded.tier,
    reason = excluded.reason,
    set_by = excluded.set_by,
    expires_at = null,
    updated_at = now();
```

To clear an override so the user falls back to RevenueCat / free:

```sql
delete from public.subscription_overrides where user_id = '<auth-user-uuid>';
```

## RevenueCat alignment

Set RevenueCat `app_user_id` to the Supabase user id (`auth.users.id`) so webhook payloads match `rc_subscriptions.user_id`.

## Webhook (`rc-webhook` Edge Function)

Deploy: `supabase functions deploy rc-webhook`

**Dashboard → Webhooks:** URL `https://<project-ref>.supabase.co/functions/v1/rc-webhook`. Enable sandbox and/or production as needed.

**Supabase Edge secrets** (Dashboard → Edge Functions → Secrets, or CLI `supabase secrets set`):

| Secret | Purpose |
|--------|--------|
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Must match the **Authorization** header RevenueCat sends (full header value, or use a random token and set the same token in RC’s webhook “authorization header” field). Requests without a match return **401**. |
| `RC_ENTITLEMENT_FAMILY` | Optional. Comma-separated entitlement ids that map to **`family`** (default: `family`). |
| `RC_ENTITLEMENT_CARE_TEAM` | Optional. Comma-separated ids that map to **`care_team`** (default: `care_team`). |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

**Idempotency:** After a successful subscription write, the handler inserts `rc_webhook_events` keyed by RevenueCat `event.id`. Duplicates return **200** without double-applying.

**JWT:** `verify_jwt` is **false** for `rc-webhook` in [`supabase/config.toml`](../supabase/config.toml); auth is the shared Authorization secret only.

## Rollout note

Until RevenueCat is wired and products are live, every account resolves to **`free`** unless you add a **`subscription_overrides`** row (or seed `rc_subscriptions` for testing). That means **AI routes in `llm-gateway` return 403** until a user has `family` or `care_team`. Plan internal QA overrides before enabling this migration in a shared environment if you relied on unrestricted AI access.

## App: RevenueCat SDK keys (Expo)

Set **public** SDK keys (from RevenueCat → **API keys** → App specific) in `.env` and/or EAS build env:

- `EXPO_PUBLIC_RC_API_KEY_IOS`
- `EXPO_PUBLIC_RC_API_KEY_ANDROID`

The app calls **`Purchases.configure`** then **`Purchases.logIn(<Supabase user id>)`** after auth (see `src/lib/revenueCat.ts` and `App.tsx`). Real IAP still requires a **development / EAS build**, not Expo Go, for full native behavior.

**Client UX:** Feature ↔ tier matrix, paywall screen, and QA live in [`src/subscription/featureTierConfig.ts`](../src/subscription/featureTierConfig.ts), [`src/subscription/SubscriptionScreen.tsx`](../src/subscription/SubscriptionScreen.tsx), and [SUBSCRIPTION_PAYWALL_QA.md](./SUBSCRIPTION_PAYWALL_QA.md).

## Webhook testing FAQ

- **Opening the function URL in a browser shows `Method Not Allowed`:** normal. Browsers use **GET**; **`rc-webhook` only accepts POST**.
- **Wrong URL:** the path must be exactly **`/functions/v1/rc-webhook`**. A long hex string in the path is **not** a function name — you will see **`NOT_FOUND`**.
- **After a successful POST (curl or RevenueCat):** run `select * from public.rc_webhook_events order by received_at desc limit 10;` again — you should see a row (e.g. `manual-test-1` or RC’s event `id`).
- **Send a test event from RevenueCat (dashboard):** Project → **Integrations** → **Webhooks** → select your Supabase integration → use **Send test event** / **Test** (wording varies). Then refresh **Delivery** / event history and confirm **HTTP 200**, and check **`rc_webhook_events`** in SQL.
