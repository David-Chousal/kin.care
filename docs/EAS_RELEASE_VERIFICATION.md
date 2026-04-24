# EAS release verification and QA (kin.care)

Reproducible **preview** and **production** builds, Sentry configuration, and a structured QA pass. Roles: **Engineer** (EAS, env, builds) and **QA** (install + checklist).

## Engineer: prerequisites

- Logged into EAS: `eas whoami`
- Apple Developer + Google Play access when submitting
- Sentry: React Native DSN for this app

## Engineer: Sentry environment variable (required)

Release builds call `initSentry()` only when `EXPO_PUBLIC_SENTRY_DSN` is set at **build time**. Define it for **both** EAS environments used by builds (`preview` and `production`) using the current EAS **env** API:

```bash
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value '<your-dsn>' \
  --environment preview --visibility secret --type string --non-interactive

eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value '<your-dsn>' \
  --environment production --visibility secret --type string --non-interactive
```

Use a separate Sentry project or DSN for preview if you want internal QA traffic isolated from store traffic.

**Verify** (from repo root):

```bash
npm run eas:verify-sentry-env
```

## Engineer: Supabase environment variables (required)

The app initializes Supabase using Expo **public** environment variables at build time:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Define them for **both** EAS environments used by builds (`preview` and `production`):

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value 'https://<project-ref>.supabase.co' \
  --environment preview --visibility secret --type string --non-interactive

eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value 'https://<project-ref>.supabase.co' \
  --environment production --visibility secret --type string --non-interactive

eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value '<anon-jwt>' \
  --environment preview --visibility secret --type string --non-interactive

eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value '<anon-jwt>' \
  --environment production --visibility secret --type string --non-interactive
```

If you change either value, you must **restart Metro** for local dev and create a **new EAS build** (these values are injected at build time).

## Engineer: build commands

**Preview** (internal distribution — TestFlight internal / Android internal):

```bash
npm run eas:build:preview
# or: eas build --platform all --profile preview
```

**Production** (store binaries; iOS + Android must succeed):

```bash
npm run eas:build:production
# or: eas build --platform all --profile production
```

After each build: confirm **Succeeded** on the EAS dashboard; note iOS **build number** / Android **version code** for release notes and Sentry.

### iOS credentials (first time or internal distribution)

If `eas build --platform ios --non-interactive` fails with **credentials are not set up** or **internal distribution**, run **once** on a trusted machine **without** `--non-interactive` so the CLI can create or validate distribution certificates and provisioning profiles:

```bash
eas build --platform ios --profile preview
eas build --platform ios --profile production
```

Follow the prompts, or configure credentials in the Expo dashboard under **kin-care → Project credentials**.

### Sentry in this repo

- [`eas.json`](../eas.json) sets `EXPO_PUBLIC_APP_VARIANT` to `preview` or `production` per profile. Runtime maps that to Sentry **environment** `preview` or `production` (see [`src/lib/sentry.ts`](../src/lib/sentry.ts)).
- **Release** is `kin-care@<appVersion>+<nativeDist>` so crash-free rates are per native build.
- Crash reporting uses **`attachScreenshot: false`** and **`tracesSampleRate: 0.2`** in non-dev builds (see [`src/lib/sentry.ts`](../src/lib/sentry.ts)), aligned with [`legal/privacy.md`](../legal/privacy.md) §7.

**Baseline (crash-free)**

1. In Sentry, filter **environment** `production` for store rollout analysis; use `preview` for internal QA builds.
2. Open **Releases** (or **Session Health**), select the release matching `kin-care@<version>+<build>`.
3. Record **crash-free sessions** (or users) before widening rollout; compare again after 24–48 hours.
4. Gate: no new critical issues; crash-free rate not worse than your team threshold.

## Engineer: submit (after QA sign-off)

```bash
npm run eas:submit:production
# or:
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

First-time submit may require ASC API key or Play credentials in EAS.

## QA checklist (non-engineer)

**Devices:** one iOS and one Android (physical recommended for documents and notifications).

**Build:** install the **preview** build first; repeat critical paths on **production** before release.

**Account:** dedicated QA test account only.

### Install and first launch

- [ ] App installs and opens without immediate crash.
- [ ] First install: welcome flow if shown; reach **Sign in**.
- [ ] Version matches what the engineer shared (OS app info or in-app if shown).

### Auth

- [ ] **Sign in** → **Home**.
- [ ] **Sign out** (Settings) → auth screen; sign in again works.
- [ ] **Wrong password** → clear message, no crash.
- [ ] **Sign up** (if in scope): create account and sign in.
- [ ] Force-close and reopen → still signed in.

### Family

- [ ] Open **Members** from Home — list loads.
- [ ] **Create family** or **Accept invite** if shown — completes without crash.
- [ ] **Invite a member** — screen opens; can go back.

### Health log

- [ ] Open **Health Log**.
- [ ] **Add** an entry → visible in list or after refresh.
- [ ] **Edit** / **delete** if available → persists after leaving the screen.

### Documents

- [ ] Open **Documents**.
- [ ] **Upload** a small file → appears in list.
- [ ] Open/preview if available — no crash.
- [ ] **Delete** if supported — behaves as expected.

### Visit prep

- [ ] Open **Visit Prep**.
- [ ] **Generate Visit Summary** (paid tier / family member): summary streams in; no misleading “session expired” if you are signed in.
- [ ] After generation: entry appears under history / persists (row in `visit_prep_summaries` if you verify in Supabase).
- [ ] Leave and return — data still there when returning.

**If generation fails — classify before filing**

1. **Network (engineer / proxy):** Capture the `POST …/functions/v1/llm-gateway/visit-prep` request. Note **HTTP status** and **JSON body** (if `Content-Type` is `application/json`). Expected: **200** + NDJSON stream on success; **401** with `code` `session_not_verified` or `missing_authorization`; **403** with `subscription_required` when tier is free; **429** with `reset_at` when rate-limited.
2. **Project alignment:** The app’s build-time env (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`) must match the Supabase project where **llm-gateway** is deployed. In Dashboard → **Edge Functions → llm-gateway → Secrets**, confirm `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are from that **same** project. A mismatch often yields persistent **401** while the app still appears signed in.
3. **401 copy:** Newer gateways return JSON `code`; the app maps `session_not_verified` to a neutral “could not verify sign-in” message (not “session expired” only). Legacy 401 without `code` still uses neutral copy.

**Forced-error sanity (optional, engineer)**

- **401:** Call the function with an invalid `Authorization` bearer — UI should not claim “session expired” as the only explanation.
- **403 subscription:** Free-tier QA account — expect paywall-style messaging, not auth failure.
- **429:** After repeated generations in a short window — expect rate-limit messaging with optional reset hint.

### Medications

- [ ] Open **Medications** — list loads.
- [ ] **Log a dose** for today — Home or Meds reflects it if applicable.
- [ ] Open **Medication** detail — back works.
- [ ] If QA data has both: exercise **scheduled** and **as-needed** paths.

### Short smoke

- [ ] **Home**: scroll; pull to refresh — no crash.
- [ ] **Tasks**: open; complete or toggle a task if possible.
- [ ] **Calendar**: opens; view or add event if allowed.
- [ ] **Check-Ins**: open; submit or view.
- [ ] **Settings** → **Notifications**, **Appearance**, **Language** — change one setting; app stays stable.

### Offline and slow network

**Offline (airplane mode on, app already signed in)**

- [ ] App opens — no immediate crash.
- [ ] **Health**, **Documents**, **Medications** — errors or empty states OK; can navigate back.
- [ ] Airplane **off** — data returns after refresh or revisit (no reinstall).

**Slow network** (iOS: Network Link Conditioner; Android: developer throttling)

- [ ] **Sign in** and one **write** (e.g. health log or task) — loading shown; no endless spinner without escape.

### Error states

- [ ] Validation error (e.g. empty sign-in) — message shown, no crash.

### Sign-off

- [ ] Sections **Auth through Medications** pass on **both** platforms for the store candidate build.
- [ ] **Settings → Privacy Policy** and **Settings → Terms** open the hosted pages (or acceptable fallback); optional: `npm run verify:legal-urls` from engineer machine after Storage upload.
- [ ] Engineer confirms EAS build green and Sentry receives events for the right **environment** (`preview` vs `production`).
- [ ] Record: **date**, **tester**, **build numbers**, **Pass/Fail** (copy [QA_SIGNOFF_TEMPLATE.md](./QA_SIGNOFF_TEMPLATE.md) if helpful). For store gate, also complete [STORE_GO_NO_GO_TEMPLATE.md](./STORE_GO_NO_GO_TEMPLATE.md).

## Backend note (single Supabase project)

**Decision:** Preview and production **EAS binaries both use the same Supabase project** as long as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` stay pointed at that project.

**Implications**

- **QA and real users share** auth, database, Storage, and LLM request metadata in that project. Use dedicated QA accounts; avoid putting real PHI into QA families unless your compliance posture allows it on that tenant.
- **Sentry** can still separate traffic by DSN and by `environment` (`preview` vs `production`) per build profile.
- **LLM logs** (`llm_requests`) and rate limits apply per user id regardless of build variant.

**Alternatives:** A separate staging Supabase project requires different `supabase.ts` values per build flavor (not implemented today).

**Verification:** Engineer completes [SUPABASE_STORE_VERIFICATION.md](./SUPABASE_STORE_VERIFICATION.md) on the production-linked project before store submit.

## Engineer: LLM gateway (`llm-gateway`) spot-check

Before release or when Visit Prep / AI drug checks misbehave:

1. Deployed function **`llm-gateway`** exists on the same project as `EXPO_PUBLIC_SUPABASE_URL` in the app.
2. Secrets on that function include valid **`GROQ_API_KEY`** and the three Supabase keys above; redeploy after secret changes.
3. Smoke **visit-prep** with a real session token (e.g. Dashboard SQL or a one-off script): expect **200** and NDJSON lines, or a documented JSON error with the expected status.
