# Subscription paywall — QA checklist

Use with sandbox Apple / Google accounts and Supabase `subscription_overrides` or RevenueCat test purchases. See [SUBSCRIPTION_EFFECTIVE_TIER.md](./SUBSCRIPTION_EFFECTIVE_TIER.md) for tier resolution and webhook delay.

## Feature × minimum tier (client)

Source of truth in code: [`src/subscription/featureTierConfig.ts`](../src/subscription/featureTierConfig.ts).

| Feature ID | Min tier | Where enforced in UI |
|-------------|----------|----------------------|
| `ai_visit_prep` | family | Home → Visit prep, Visit Prep screen, `useVisitPrep` + llm-gateway |
| `ai_drug_interactions` | family | Server only today (RxNorm still works); config reserved |
| `document_vault` | family | Home → Documents, Documents screen |
| `unlimited_family_members` | family | Members → Invite, Invite Member screen (Core tier cap = 3 members; internal tier `free`) |
| `clinical_data_export` | care_team | Settings → Export (Family sees Care Team upsell) |

## HTTP / llm-gateway → UI mapping

| Response | Client handling |
|----------|-----------------|
| `403` + `code: subscription_required` + `required_tier` | Visit prep: “upgrade” copy + **View plans**; maps to Family by default, Care Team when `required_tier` is `care_team`. |
| `403` (no `subscription_required`) | Treated as not-a-member / forbidden — access message, no pay CTA. |
| `401` | Sign in again. |
| `429` + optional `reset_at` | Rate limit message; may include reset time. |
| `5xx` / network | Generic server / connection messaging (no stack traces in prod). |
| RevenueCat / StoreKit (native) | Dev: detailed RC message; prod: “Subscriptions temporarily unavailable”. |
| Web | No `Purchases` calls; Subscription screen shows store links + copy to subscribe on device. |

## Preconditions

- `EXPO_PUBLIC_RC_API_KEY_IOS` / `EXPO_PUBLIC_RC_API_KEY_ANDROID` set on **dev / EAS** builds (not required for web).
- RevenueCat project has a **current offering** with packages whose identifiers or titles contain `family` and/or `care` (or verify “Other plans” fallback lists all packages).
- `get_my_effective_tier` returns `free` until purchase or override.

## Web (Expo web)

- [ ] Open **Settings → Subscription**: no crash; copy explains IAP is app-only; App Store search + Play Store links open.
- [ ] From **Home**, tap **Documents** or **Visit prep** as Core user (`effective_tier` = `free`): routed to paywall or locked callout without native `Purchases` errors in console.

## Native — pay screen

- [ ] **Settings → Subscription** shows current tier (loading → Core / Family / Care Team; UI label for internal `free` is **Core**).
- [ ] Pull to refresh updates tier after webhook (may take **up to ~1 minute**; pull again or wait).
- [ ] **Restore purchases** completes without crash; tier refreshes for returning subscriber.
- [ ] Misconfigured offerings: in dev, actionable message; in release build, generic “temporarily unavailable” (no stack traces).

## Tier gates

- [ ] **Core** user (`free`): Home → Visit prep / Documents opens paywall or locked state; cannot generate visit prep; cannot open document vault list.
- [ ] **Core** user (`free`) with **3 members**: **Invite** opens upgrade (or web alert); **InviteMember** screen shows locked callout if navigated directly.
- [ ] **Family** user: Visit prep and documents work; **Settings → Export** shows **Care Team** upsell until `care_team` effective tier.
- [ ] **Care Team** user: Export runs (share sheet).

## AI / llm-gateway errors

- [ ] Core user (`free`) triggers visit prep (if they bypass UI): error message describes plan need, not raw `HTTP 403`; **View plans** navigates to Subscription.
- [ ] `403` with `code: subscription_required` maps to Family upsell (or Care Team if `required_tier` is `care_team`).
- [ ] `429` rate limit: friendly copy; optional `reset_at` surfaced when present.

## Logout

- [ ] After **Sign out**, subscription tier query is cleared; next sign-in refetches tier; RevenueCat `logOut` runs (native) per `syncRevenueCatUser(null)`.

## Sandbox purchase flow

- [ ] Complete test purchase; within ~1 minute **pull to refresh** on Subscription shows **Family** or **Care Team**; gated screens unlock without reinstall.
