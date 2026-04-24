# Admin: tier overrides (testing & comps)

Normal app users **cannot** insert or update `public.subscription_overrides` or `public.rc_subscriptions` — there are no `INSERT`/`UPDATE` RLS policies for the `authenticated` role.

## Who can write

- **Service role** (dashboard SQL, CLI, or backend tooling with `SUPABASE_SERVICE_ROLE_KEY`).
- Future: a dedicated Edge Function secured with service role or allow-listed admin identities.

## Operational notes

- An override **wins** over an active App Store / Play subscription in `rc_subscriptions` until the override row is removed or `expires_at` passes.
- Setting `tier = 'free'` forces free even if the user has an active store subscription (useful for abuse response).

See [SUBSCRIPTION_EFFECTIVE_TIER.md](./SUBSCRIPTION_EFFECTIVE_TIER.md) for resolution order and SQL examples.
