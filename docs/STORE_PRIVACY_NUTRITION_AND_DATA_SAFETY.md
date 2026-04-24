# Apple Privacy Nutrition Labels & Google Data Safety — draft

**Disclaimer:** Legal/compliance owns final answers. This draft maps **observed app behavior** and [`legal/privacy.md`](../legal/privacy.md) to common console questions. Update before submit.

## Data types collected (both platforms)

| Category | Examples in Kin | Linked to user | Used for |
|----------|-----------------|----------------|----------|
| Name, email | Account sign-up | Yes | App functionality, account management |
| Health / medical (sensitive) | Health logs, medications, doses, visit prep inputs | Yes | App functionality |
| Calendar / appointments | Family calendar events | Yes | App functionality |
| User content | Uploaded documents (categories), check-ins | Yes | App functionality |
| Photos | Health log attachments | Yes | App functionality |
| Diagnostics | Sentry: device model, OS, app version, crashes, performance traces; **no** default view screenshots ([`src/lib/sentry.ts`](../src/lib/sentry.ts)) | Yes | Analytics / app functionality (crash fixing) |
| Other contact info | Support email flows only if user sends mail | Optional | Support |

## Third-party processors (not “sold”; typically “shared” for processing)

| Processor | Role | Data involved |
|-----------|------|----------------|
| Supabase | Auth, Postgres, Storage | Account + all user-generated app data |
| Expo | Push notification delivery | Push token |
| Groq | AI inference | Visit prep / drug-interaction **inputs you send** (e.g. meds, health logs) per privacy §4 |
| Sentry | Crash / performance diagnostics | Metadata + possible error-context strings per privacy §7 |

## AI features (Apple / Google)

- **Optional / feature-limited:** User triggers Visit Prep or drug interactions.
- **Disclosure:** Inputs are sent to Groq to produce output; metadata logged server-side (purpose, sizes, hashes, latency, IP best-effort) — see privacy §4.

## Encryption

- **In transit:** HTTPS to Supabase and Edge Functions (standard TLS).
- **At rest:** As provided by Supabase / platform vendors (state in Data Safety “encrypted in transit” yes; “encrypted at rest” per your vendor attestation).

## Account deletion / export

- In-app export and delete flows per privacy §9–10; align Google “Data deletion” with actual product behavior.

## Supply chain (release hygiene)

Run `npm audit` before submit. As of last tooling pass, dev-only transitive issues (e.g. `jest-expo` → `jsdom` chain) may appear; do **not** blindly `npm audit fix --force` without testing. Track accepted risk or upgrade Jest stack in a dedicated PR.

## Gaps to resolve before filing

- [ ] Confirm whether **purchase history** is collected today (terms §8); if not implemented, omit or mark “not collected”.
- [ ] Confirm **precise location** — if not collected, declare “No”.
- [ ] Confirm **contacts / SMS** — if not collected, declare “No”.
- [ ] Re-read [`legal/privacy.md`](../legal/privacy.md) after any telemetry change.
