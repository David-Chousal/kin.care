#!/usr/bin/env bash
# Fails if EXPO_PUBLIC_SENTRY_DSN is not defined for EAS preview + production environments.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v eas >/dev/null 2>&1; then
  echo "error: eas CLI not found. Install: npm i -g eas-cli"
  exit 1
fi

missing=0
for env in preview production; do
  list="$(eas env:list "$env" --format short 2>&1)" || {
    echo "$list"
    exit 1
  }
  if ! echo "$list" | grep -q 'EXPO_PUBLIC_SENTRY_DSN'; then
    echo "error: EXPO_PUBLIC_SENTRY_DSN is not set for EAS environment \"${env}\"."
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo ""
  echo "Create it (use your Sentry React Native project DSN):"
  echo "  eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value '<dsn>' --environment preview --visibility secret --type string --non-interactive"
  echo "  eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value '<dsn>' --environment production --visibility secret --type string --non-interactive"
  echo ""
  echo "See docs/EAS_RELEASE_VERIFICATION.md"
  exit 1
fi

echo "ok: EXPO_PUBLIC_SENTRY_DSN is present for preview and production."
