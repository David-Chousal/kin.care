# Store submission — go / no-go (template)

Copy this section into your release ticket or PR. Replace brackets with evidence links or notes. For in-repo automation log, see [STORE_READINESS_EXECUTED.md](./STORE_READINESS_EXECUTED.md).

## Summary

| Field | Value |
|-------|--------|
| Date | |
| App version / native dist | |
| Verdict | **GO** / **NO-GO** |

## Blocking gates (must be GO)

| Gate | Owner | Result | Evidence |
|------|-------|--------|------------|
| A — Legal URLs 200 | Engineer | GO / NO-GO | `npm run verify:legal-urls` output or screenshots |
| A — In-app Settings links | QA | GO / NO-GO | iOS + Android build ids |
| B — Supabase migrations + RLS + LLM tables | Engineer | GO / NO-GO | [SUPABASE_STORE_VERIFICATION.md](./SUPABASE_STORE_VERIFICATION.md) |
| B — `llm-gateway` deployed + secrets | Engineer | GO / NO-GO | Dashboard + B6 smoke |
| B — Visit prep + drug interactions smoke | QA | GO / NO-GO | Notes |
| C1 — App `EXPO_PUBLIC_SUPABASE_URL` = verified project | Engineer | GO / NO-GO | |

## High priority (non-blocking unless policy says otherwise)

| Item | Result |
|------|--------|
| Policy fallback aligned with `legal/*.md` | GO / NO-GO |
| Sentry DSN on EAS `production` | GO / NO-GO (`npm run eas:verify-sentry-env`) |
| Apple Privacy Nutrition Labels drafted | GO / NO-GO ([STORE_PRIVACY_NUTRITION_AND_DATA_SAFETY.md](./STORE_PRIVACY_NUTRITION_AND_DATA_SAFETY.md)) |
| Google Data Safety drafted | GO / NO-GO (same doc) |

## Pre-submit runbook (minimal)

1. `npm run build:legal` → upload `legal/dist/*.html` to bucket `legal` → `npm run verify:legal-urls`
2. Supabase checks per [SUPABASE_STORE_VERIFICATION.md](./SUPABASE_STORE_VERIFICATION.md)
3. Version / build numbers bumped per store rules
4. `npm run eas:build:production` → QA per [EAS_RELEASE_VERIFICATION.md](./EAS_RELEASE_VERIFICATION.md)
5. Labels + Data Safety from [STORE_PRIVACY_NUTRITION_AND_DATA_SAFETY.md](./STORE_PRIVACY_NUTRITION_AND_DATA_SAFETY.md)
6. `npm run eas:submit:production` after **GO** above
