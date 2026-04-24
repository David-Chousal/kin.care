# Subscription MVP — scope addendum

This document bounds the **B2C subscription MVP** track and records **Phase 2+** intent without expanding MVP PRs. **Phase 1 owns** the RevenueCat webhook (`rc-webhook`), `rc_subscriptions` / `rc_webhook_events` cache, operator overrides (`subscription_overrides`), and **`effective_tier`** resolution (`get_effective_tier_for_user` / `get_my_effective_tier`). Enterprise or agency billing work must **extend** these primitives (new tables, separate Edge Functions, or Stripe listeners) — not replace or fork the Phase 1 webhook or override design.

---

## In scope (current MVP track)

- **B2C only:** **Core** (display name; internal `effective_tier` value remains `free`), **Family** ($4.99/mo), **Care Team** ($8.99/mo).
- **IAP + RevenueCat** (or a documented, justified alternative) as the mobile payment rail; **Supabase-backed** `effective_tier` (override → store cache → `free`).
- **Developer / operator tier overrides** for any account (testing, demos, comps), via `subscription_overrides` and controlled **service_role** (or secured admin) writes — not self-serve elevation by end users.

---

## Out of scope (separate epics; not in the B2C MVP PR sequence)

### Hospital discharge partnerships

**Phase 2+:** Distribution and contracting with health systems (referral flows, bulk enrollment, BAA-heavy data sharing) belong in a **separate epic**. Billing is unlikely to be consumer IAP alone: expect **contracts**, possible **Stripe Billing** or invoicing for facility fees, **manual provisioning** or org-linked accounts, and compliance gates. **No commitment** in the MVP PR list; do not add Stripe checkout “for hospitals” inside the B2C IAP sequence.

### Home care agency white-label

**Phase 2+:** Multi-tenant or **white-label** apps for agencies imply **org-level** subscriptions, seat models, branding, and often **web + invoicing** rather than store-only B2C. Likely **Stripe Billing or similar**, **separate app variants** or dedicated **org** tables keyed off agencies, plus admin consoles. **No MVP commitment**; keep agency flows out of the RevenueCat B2C webhook PR chain.

### Insurance carrier subsidies

**Phase 2+:** Payer-subsidized access is a **distribution and contracting** model (eligibility files, attestations, reconciliation). Implementation tends toward **manual provisioning**, carrier-specific identifiers, and **non–App Store** settlement paths — often **Stripe** or file-based billing alongside legal review. **Not part** of the B2C IAP MVP sequence; document only at epic level.

---

## Phase 2 entry criteria (before enterprise / agency / insurer work)

- **B2C IAP live:** Family and Care Team purchasable in production; **RevenueCat webhooks** stable (low unprocessed / error rate vs. dashboard; idempotent handling verified).
- **Support load known:** Volume and themes for refunds, churn, and “wrong tier” tickets understood from real traffic.
- **Legal / privacy aligned:** Store disclosures, in-app copy, and internal docs match **actual** purchase and webhook data processing (including RevenueCat and stores).
- **Explicit product decision:** Whether **web or B2B** channels need **separate billing** (e.g. Stripe) vs. staying **app-only B2C** — documented with compliance implications.
- **Technical baseline:** `effective_tier`, **`rc-webhook`**, and **`subscription_overrides`** remain the **system of record** for “who is paid”; Phase 2 features **compose** on top (new consumers of tier, not duplicate sources of truth).
