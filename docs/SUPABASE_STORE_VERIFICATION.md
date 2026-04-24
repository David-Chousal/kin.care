# Supabase production verification (store readiness)

Use this with the **production** Supabase project that matches the app’s build-time env (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Record **Pass/Fail** and evidence (screenshot or CLI output) for store sign-off.

## B1 — Migrations applied

Required migration files (in order among your history):

| File | Purpose |
|------|---------|
| [`supabase/migrations/20260421230000_enable_rls_all_tables.sql`](../supabase/migrations/20260421230000_enable_rls_all_tables.sql) | RLS on Sprint 2/3 tables |
| [`supabase/migrations/20260422120000_llm_gateway_rate_limits_and_logs.sql`](../supabase/migrations/20260422120000_llm_gateway_rate_limits_and_logs.sql) | `llm_rate_limits`, `llm_requests`, `llm_rate_limit_consume` |
| [`supabase/migrations/20260422130000_legal_policy_pages_bucket.sql`](../supabase/migrations/20260422130000_legal_policy_pages_bucket.sql) | Public Storage bucket `legal` |

**Engineer — CLI (linked project):**

```bash
supabase link --project-ref <PROJECT_REF>
supabase db remote commit  # only if you intend to commit; usually:
supabase migration list
```

**Engineer — Dashboard:** Project → **Database** → **Migrations** (or migration history) and confirm the three timestamps above are applied.

**Pass:** All three exist on production. **Fail:** Any missing or reverted.

---

## B2 — Bucket `legal`

**Dashboard:** Storage → Buckets → `legal` → public, file size limit 1 MiB, allowed MIME `text/html`, `text/plain`.

**Pass:** Bucket exists and is public. **Fail:** Private bucket or wrong MIME gate blocking HTML.

---

## B3 — RLS and LLM tables

Run in **SQL Editor** (service role or owner):

```sql
-- Tables from RLS migration should have RLS enabled
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and relname in (
    'calendar_events', 'medications', 'medication_logs', 'health_logs',
    'documents', 'checkins', 'push_tokens', 'llm_rate_limits', 'llm_requests'
  )
order by relname;
```

**Pass:** `relrowsecurity = true` for each row present. **Fail:** Any listed table missing or RLS off.

**`llm_requests` policies:** Users should have **SELECT** own rows only; inserts from clients should fail (Edge Function uses `service_role`).

```sql
select polname, cmd, qual::text
from pg_policies
where schemaname = 'public' and tablename = 'llm_requests';
```

---

## B4 — Edge Function `llm-gateway`

**Dashboard:** Edge Functions → `llm-gateway` deployed.

**Pass:** Function responds (see B6). **Fail:** 404 or wrong project.

---

## B5 — Secrets (function environment)

Required by [`supabase/functions/llm-gateway/index.ts`](../supabase/functions/llm-gateway/index.ts):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | JWT validation path |
| `SUPABASE_SERVICE_ROLE_KEY` | DB writes (rate limits, logs) |
| `GROQ_API_KEY` | Model calls |
| `LLM_MONTHLY_TOKEN_CAP_PER_USER` | Optional; defaults in code if unset |

**Pass:** All required vars set in Dashboard → Edge Functions → `llm-gateway` → Secrets. **Fail:** Missing key → 500 / auth errors.

---

## B6 — Authenticated smoke (QA)

With a **real user session** from the app (copy access token from dev tools or temporary log — do not commit):

1. **Visit Prep** — `POST` `${SUPABASE_URL}/functions/v1/llm-gateway/visit-prep` with `Authorization: Bearer <access_token>` and JSON body as the app sends. Expect **200** and **NDJSON** stream.
2. **Drug interactions** — `POST` `.../llm-gateway/drug-interactions` with same auth. Expect **200** and JSON.

**Pass:** Both succeed for a normal account in a family. **Fail:** 401 (auth), 403, repeated 5xx.

---

## B7 — Rate limits / monthly cap

Repeat B6 rapidly or use a script until limited.

**Pass:** HTTP **429** or documented limit response; no silent success past cap. **SQL spot-check:** new rows in `llm_requests` with `prompt_hash` populated, **no** raw prompt column (schema matches migration).

```sql
select id, purpose, status, prompt_hash is not null as has_hash, created_at
from public.llm_requests
order by created_at desc
limit 5;
```

---

## C1 — Client matches this project

Compare `EXPO_PUBLIC_SUPABASE_URL` used for your **production build** with the Dashboard project URL. **Pass:** Identical project. **Fail:** App points at staging while you verified prod (or reverse).
