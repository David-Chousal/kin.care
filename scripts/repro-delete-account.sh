#!/usr/bin/env bash
# Reproduce POST /functions/v1/delete-account outside the app.
#
# Setup (from Supabase Dashboard → Project Settings → API, and a fresh session):
#   export SUPABASE_URL='https://<ref>.supabase.co'
#   export SUPABASE_ANON_KEY='<anon_jwt>'
#   export SUPABASE_ACCESS_TOKEN='<user access_token from sign-in>'
#
# Interpret results (hypothesis buckets):
#   401 + {"error":"Unauthorized"}     → B: missing/invalid JWT or getUser failed
#   500 plain "Server misconfiguration" → C: missing SUPABASE_* secrets on the function
#   500 + {"ok":false,"error":"..."}   → D: data/auth admin (read error for FK, storage, etc.)
#   curl errors / timeouts              → A: network, wrong URL, function not deployed
#
# Correlate: Dashboard → Edge Functions → delete-account → Logs (same timestamp as this run).

set -euo pipefail
: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY}"
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"

URL="${SUPABASE_URL%/}/functions/v1/delete-account"

echo "POST $URL"
echo "---"
curl -sS -i -X POST "$URL" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
echo ""
echo "---"
echo "See script header for bucket mapping (401 / 500 body / network)."
