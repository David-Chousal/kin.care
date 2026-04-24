# Store readiness — automated / agent execution log

This file records checks run **in-repo** during implementation. It is **not** a substitute for QA sign-off on physical devices or Supabase Dashboard verification.

| Check | Result | Notes |
|-------|--------|--------|
| `npm run build:legal` | Pass | Outputs `legal/dist/privacy.html`, `legal/dist/terms.html` |
| `npm run verify:legal-urls` | Pass (when run) | HTTP 200 for public `legal` objects on project in `src/lib/supabase.ts` |
| `npm test` | Pass | 7 suites / 89 tests |
| Policy fallback vs `legal/*.md` | Pass | [`src/features/settings/policyFallbackContent.ts`](../src/features/settings/policyFallbackContent.ts) aligned with markdown sources |
| `attachScreenshot` | Changed to `false` | [`src/lib/sentry.ts`](../src/lib/sentry.ts); [`legal/privacy.md`](../legal/privacy.md) §7 updated — **re-upload** `legal/dist/privacy.html` to Storage so hosted page matches policy |
| `@anthropic-ai/sdk` | Removed | Unused client dependency |
| `npm audit` | See output in PR | 6 findings (mostly dev/jest-expo chain); do not force-fix without test plan |
| `npm run eas:verify-sentry-env` | **Fail** (this workspace) | `EXPO_PUBLIC_SENTRY_DSN` not set for EAS `preview` / `production` — **NO-GO** for release until created per [EAS_RELEASE_VERIFICATION.md](./EAS_RELEASE_VERIFICATION.md) |

**Still required (human / dashboard):** [SUPABASE_STORE_VERIFICATION.md](./SUPABASE_STORE_VERIFICATION.md) B1–B7, iOS/Android Settings legal smoke, fix EAS Sentry env above, completed [STORE_GO_NO_GO_TEMPLATE.md](./STORE_GO_NO_GO_TEMPLATE.md).
