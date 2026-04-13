#!/usr/bin/env bash
# deploy-funnel.sh — commit & push the unified funnel analytics stack.
# Safely handles dirty working trees + untracked files that collide with main.
set -euo pipefail

cd "$(dirname "$0")"

BRANCH="claude/funnel-analytics-stack"
STASH_MSG="deploy-funnel-autostash-$(date +%s)"
BACKUP_DIR="/tmp/lhi-funnel-backup-$(date +%s)"

# The 11 files this deploy owns. We snapshot these before any checkout and
# restore them afterward so no local edits are lost, even if stash/pop fails.
FILES=(
  "js/funnel.js"
  "js/analytics.js"
  "lp/aca/index.html"
  "lp/medicare/index.html"
  "lp/gap/index.html"
  "get-help/index.html"
  "aca-health-insurance-lakeland-fl/index.html"
  "newsletter/index.html"
  "thanks.html"
  "robots.txt"
  "funnel-dashboard.html"
  "deploy-funnel.sh"
)

echo "→ Clearing any stale git locks..."
rm -f .git/index.lock

echo "→ Snapshotting funnel files to ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "${BACKUP_DIR}/$(dirname "$f")"
    cp -p "$f" "${BACKUP_DIR}/$f"
  fi
done

echo "→ Stashing everything else (tracked + untracked)..."
git stash push -u -m "${STASH_MSG}" >/dev/null 2>&1 || true

echo "→ Fetching origin/main..."
git fetch origin main --quiet

# If the branch already exists locally, delete it so we start clean from main.
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "→ Removing existing local ${BRANCH} branch..."
  git branch -D "${BRANCH}" >/dev/null
fi

echo "→ Creating ${BRANCH} from origin/main..."
git checkout -b "${BRANCH}" origin/main

echo "→ Restoring funnel files from snapshot..."
for f in "${FILES[@]}"; do
  if [ -f "${BACKUP_DIR}/$f" ]; then
    mkdir -p "$(dirname "$f")"
    cp -p "${BACKUP_DIR}/$f" "$f"
  fi
done

echo "→ Staging funnel files..."
for f in "${FILES[@]}"; do
  [ -f "$f" ] && git add "$f"
done

if git diff --cached --quiet; then
  echo "✓ Nothing to commit — already up to date."
else
  echo "→ Committing..."
  git commit -m "feat(analytics): unified funnel event stream — Pixel + GA4 + Supabase

- Add js/funnel.js central event bus: session cookie, UTM/fbclid/gclid
  attribution (90d first-touch), page_type segmentation, auto-wire of
  forms via data-funnel-track and Calendly click tracking.
- Chain funnel.js load after pixel init in js/analytics.js.
- Wire data-funnel-track + Lead events on ACA, Medicare, Gap, get-help,
  local-SEO ACA (aca-health-insurance-lakeland-fl), and newsletter forms.
- Fire CompleteRegistration on thanks.html post-submit (4s delayed).
- Disallow /funnel-dashboard.html and internal strategy docs in robots.txt.
- Add private funnel-dashboard.html (Chart.js, service_role-gated,
  sessionStorage only) with viewers->leads->bookings->completions funnel,
  daily trend, page_type breakdown, and attribution source breakdown.
- Supabase: public.funnel_events table + RLS (anon insert only) +
  funnel_daily and funnel_conversion views (applied via MCP migration).
- Verified 201 Created on anon POST end-to-end."
fi

echo "→ Pushing..."
git push -u origin "${BRANCH}"

echo ""
echo "✓ Funnel branch pushed: ${BRANCH}"
echo ""

# Open a PR if gh is available
if command -v gh >/dev/null 2>&1; then
  if gh pr view "${BRANCH}" >/dev/null 2>&1; then
    echo "✓ PR already exists:"
    gh pr view "${BRANCH}" --json url -q .url
  else
    echo "→ Opening PR..."
    gh pr create \
      --title "Unified funnel event stream (Pixel + GA4 + Supabase)" \
      --body "Ships centralized event tracking across all landing pages.

**Stack**
- Meta Pixel 1822900971216472 (Lead, Schedule, CompleteRegistration)
- GA4 via GTM-W6MZ7XT6 with \`page_type\` dataLayer contract
- Supabase \`public.funnel_events\` (HuffHealthApp project)

**Files**
- \`js/funnel.js\` (new) — event bus
- \`js/analytics.js\` — chains funnel.js
- 6 LP forms wired with \`data-funnel-track\`
- \`thanks.html\` — CompleteRegistration fire
- \`funnel-dashboard.html\` (new, private, noindex)
- \`robots.txt\` — disallow dashboard + internal docs

**Verification**
- funnel.js + analytics.js syntax checked
- Anon POST to \`/rest/v1/funnel_events\` returned 201
- Row visible in DB

**Post-merge**
1. In GTM, map the new dataLayer events (\`Lead\`, \`Schedule\`, \`CompleteRegistration\`) with \`page_type\` to GA4 event tags.
2. In Meta Events Manager, mark the three events as conversion events.
3. Open \`/funnel-dashboard.html\` and paste your Supabase service_role key." || true
  fi
else
  echo "ℹ  gh CLI not installed — open a PR from the push URL above."
fi

echo ""
echo "→ Your previous working-tree changes are stashed as: ${STASH_MSG}"
echo "   Recover them later with:  git stash list  |  git stash pop"
echo "→ Snapshot backup (safe to delete once PR looks good): ${BACKUP_DIR}"
echo "✓ Done."
