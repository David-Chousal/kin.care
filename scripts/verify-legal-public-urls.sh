#!/usr/bin/env bash
# Smoke-test public legal URLs (must match src/config/legal.ts).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
if [[ -z "$SUPABASE_URL" ]]; then
  echo "Missing EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in environment." >&2
  echo "Tip: export EXPO_PUBLIC_SUPABASE_URL='https://<project-ref>.supabase.co' then re-run." >&2
  exit 1
fi
PRIVACY="${SUPABASE_URL}/storage/v1/object/public/legal/privacy.html"
TERMS="${SUPABASE_URL}/storage/v1/object/public/legal/terms.html"
for url in "$PRIVACY" "$TERMS"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  if [[ "$code" != "200" ]]; then
    echo "FAIL $url (HTTP $code)" >&2
    exit 1
  fi
  echo "OK $url"
done
