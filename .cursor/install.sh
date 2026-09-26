#!/usr/bin/env bash
set -euo pipefail

# Cloud Agent environment bootstrap for the Lakeland Health Insurance repo.
# Runs after the repository is checked out. Idempotent: safe to re-run and to
# execute against a cached/snapshotted filesystem.

cd "$(dirname "$0")/.."

# Root runtime dependencies (pinned Netlify Functions deps such as
# @netlify/blobs). The Node test gate loads the functions, so these are
# required for `node scripts/validate-local.mjs` to pass.
npm ci

# Audit browser tooling (Playwright). Required by the audit-phase2 render gate
# that `node scripts/validate-local.mjs` runs via `node --test tests/*.test.mjs`.
( cd audit && npm ci )

# Chromium system libraries + the pinned browser binary for the Playwright
# render gate. install-deps needs root; sudo is available on the base image.
sudo env "PATH=$PATH" node audit/node_modules/.bin/playwright install-deps chromium
node audit/node_modules/.bin/playwright install chromium
