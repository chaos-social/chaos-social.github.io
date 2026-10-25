#!/usr/bin/env bash
set -euo pipefail

release_version=$(jq -r '.version' package.json)
bundle_identifier=$(git rev-parse HEAD)
bundle_date=$(date -u +"%y%m%d%H")

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  export SENTRY_DISABLE_AUTO_UPLOAD=true
fi

EXPO_PUBLIC_RELEASE_VERSION="$release_version" \
EXPO_PUBLIC_BUNDLE_IDENTIFIER="$bundle_identifier" \
EXPO_PUBLIC_BUNDLE_DATE="$bundle_date" \
exec pnpm exec expo run:android --variant release "$@"
