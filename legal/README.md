# Legal pages (public URLs)

This folder is the source of truth for Kin’s store-submission legal pages.

## Build HTML

```bash
npm run build:legal
```

Outputs:

- `legal/dist/privacy.html`
- `legal/dist/terms.html`

## Publish to Supabase Storage

These pages are expected at:

- `storage://legal/privacy.html`
- `storage://legal/terms.html`

Public URLs (based on `src/config/legal.ts`):

- `${SUPABASE_URL}/storage/v1/object/public/legal/privacy.html`
- `${SUPABASE_URL}/storage/v1/object/public/legal/terms.html`

Where `SUPABASE_URL` is your Expo build-time config value:
- `process.env.EXPO_PUBLIC_SUPABASE_URL` in the app
- `EXPO_PUBLIC_SUPABASE_URL` in your shell when running `npm run verify:legal-urls`

### Bucket creation

The migration `supabase/migrations/20260422130000_legal_policy_pages_bucket.sql` creates a **public** bucket named `legal`.

### Upload (recommended: Supabase Dashboard)

1. Supabase Dashboard → Storage → Buckets → `legal`
2. Upload:
   - `legal/dist/privacy.html` → `privacy.html`
   - `legal/dist/terms.html` → `terms.html`
3. Confirm the public URLs load in an incognito browser.

### Automated URL check

After upload, from repo root (requires network):

```bash
npm run verify:legal-urls
```

### In-app QA (release-like builds)

On **preview** and **production** EAS builds, **Settings → Privacy Policy** and **Settings → Terms** should open the hosted pages in the system browser. If `Linking.openURL` fails, the app shows an offline fallback; keep [`src/features/settings/policyFallbackContent.ts`](../src/features/settings/policyFallbackContent.ts) aligned with `legal/privacy.md` and `legal/terms.md`.

