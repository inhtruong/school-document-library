#!/usr/bin/env bash
#
# deploy.sh — release-based production deploy (Step 13B)
#
# Repository artifact only — NOT executed against any server by this task.
# Intended to run ON THE VPS, by an operator with sudo/schoolapp access,
# once VPS-09's prerequisites exist (schoolapp user, /var/www/school-library,
# /var/lib/school-library/storage, /etc/school-library/production.env,
# a persistent git checkout at REPO_DIR, PostgreSQL, systemd unit installed).
#
# Usage:
#   deploy.sh <git-ref>
#
# <git-ref> is a branch, tag, or commit — required, on purpose: this script
# never guesses "latest" for you. Example: deploy.sh v1.4.0
#
# What this does NOT do: install anything system-wide, touch Nginx/UFW, run
# `npm run create-admin` or `npm run db:seed` (never — see the Prisma
# section below), or perform a database rollback. See README's Production
# section ("Rollback") for what source rollback can and cannot fix.

set -euo pipefail
# Deliberately no `set -x` anywhere in this script — production.env is
# sourced below, and shell tracing would echo every exported variable
# (including DATABASE_URL/AUTH_SECRET) to the deploy log.

# ---------------------------------------------------------------------------
# Configuration — override any of these via environment if your VPS layout
# differs, but the defaults match the target layout documented in README.
# ---------------------------------------------------------------------------
APP_NAME="school-library"
BASE_DIR="${BASE_DIR:-/var/www/school-library}"
RELEASES_DIR="$BASE_DIR/releases"
CURRENT_LINK="$BASE_DIR/current"
# A persistent git checkout used as the deploy source — see README's
# "Source acquisition" note for why this script never embeds credentials:
# whatever auth REPO_DIR's git remote already uses (SSH key, deploy key) is
# entirely the operator's/VPS's concern, set up once, outside this script.
REPO_DIR="${REPO_DIR:-$BASE_DIR/repo}"
ENV_FILE="${ENV_FILE:-/etc/school-library/production.env}"
STORAGE_ROOT_EXPECTED="${STORAGE_ROOT_EXPECTED:-/var/lib/school-library/storage}"
SERVICE_NAME="${SERVICE_NAME:-school-library}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_DELAY_SECONDS=2

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

REF="${1:-}"
if [ -z "$REF" ]; then
  fail "usage: deploy.sh <git-ref>  (a branch, tag, or commit — no default is assumed)"
fi

# ---------------------------------------------------------------------------
# Step 1 — confirm required commands exist
# ---------------------------------------------------------------------------
log "Step 1/15: checking required commands"
for cmd in git node npm npx systemctl curl ln readlink mktemp sudo; do
  command -v "$cmd" >/dev/null 2>&1 || fail "required command not found: $cmd"
done

# ---------------------------------------------------------------------------
# Step 2 — locate source and resolve the requested ref
# ---------------------------------------------------------------------------
log "Step 2/15: resolving ref '$REF' in $REPO_DIR"
[ -d "$REPO_DIR/.git" ] || fail "REPO_DIR ($REPO_DIR) is not a git checkout — clone it there first (one-time, manual, outside this script)"
git -C "$REPO_DIR" fetch --all --tags --quiet
RESOLVED_SHA="$(git -C "$REPO_DIR" rev-parse --verify "${REF}^{commit}" 2>/dev/null)" \
  || fail "ref '$REF' does not resolve to a commit in $REPO_DIR"
SHORT_SHA="$(git -C "$REPO_DIR" rev-parse --short "$RESOLVED_SHA")"
log "resolved to commit $SHORT_SHA"

# ---------------------------------------------------------------------------
# Sanity checks on the target layout before doing any real work
# ---------------------------------------------------------------------------
[ -f "$ENV_FILE" ] || fail "production env file not found: $ENV_FILE"
[ -r "$ENV_FILE" ] || fail "production env file not readable by this user: $ENV_FILE"
mkdir -p "$RELEASES_DIR" || fail "cannot create $RELEASES_DIR — check ownership/permissions"
[ -w "$RELEASES_DIR" ] || fail "$RELEASES_DIR is not writable by this user"
mkdir -p "$STORAGE_ROOT_EXPECTED" || fail "cannot create $STORAGE_ROOT_EXPECTED — check ownership/permissions"
[ -w "$STORAGE_ROOT_EXPECTED" ] || fail "$STORAGE_ROOT_EXPECTED is not writable by this user — STORAGE_ROOT must be writable"

# ---------------------------------------------------------------------------
# Step 3 — create a unique new release directory
# ---------------------------------------------------------------------------
log "Step 3/15: creating a new release directory"
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-${SHORT_SHA}"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
[ ! -e "$RELEASE_DIR" ] || fail "release directory already exists (unexpected): $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Clean up the partial release directory if anything fails before the
# symlink switch (Step 12) — nothing else references it yet at that point,
# so it's always safe to remove. Disabled once the switch succeeds.
CLEANUP_ON_FAILURE=1
cleanup_partial_release() {
  if [ "$CLEANUP_ON_FAILURE" = "1" ]; then
    log "deploy failed before going live — removing partial release $RELEASE_DIR"
    rm -rf "$RELEASE_DIR"
  fi
}
trap cleanup_partial_release EXIT

# ---------------------------------------------------------------------------
# Step 4 — populate the release from the resolved commit (no .git history,
# no working-tree cruft, no untracked files carried over by accident)
# ---------------------------------------------------------------------------
log "Step 4/15: exporting $SHORT_SHA into $RELEASE_DIR"
git -C "$REPO_DIR" archive "$RESOLVED_SHA" | tar -x -C "$RELEASE_DIR"

cd "$RELEASE_DIR"

# ---------------------------------------------------------------------------
# Step 5 — install dependencies
# ---------------------------------------------------------------------------
log "Step 5/15: npm ci"
npm ci

# ---------------------------------------------------------------------------
# Step 6 — verify Node version matches what this release expects
# ---------------------------------------------------------------------------
log "Step 6/15: verifying Node version"
if [ -f .nvmrc ]; then
  EXPECTED_MAJOR="$(tr -d '[:space:]' < .nvmrc)"
  ACTUAL_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$ACTUAL_MAJOR" = "$EXPECTED_MAJOR" ] || fail "Node major version mismatch: .nvmrc wants $EXPECTED_MAJOR, running node is $(node -v)"
  log "Node $(node -v) matches .nvmrc ($EXPECTED_MAJOR)"
else
  log "no .nvmrc in this release — skipping strict version check"
fi

# ---------------------------------------------------------------------------
# Step 7 — Prisma client generation
# ---------------------------------------------------------------------------
log "Step 7/15: npx prisma generate"
npx prisma generate

# ---------------------------------------------------------------------------
# Step 8 — full test suite
# ---------------------------------------------------------------------------
log "Step 8/15: npm test"
npm test

# ---------------------------------------------------------------------------
# Step 9 — TypeScript check
# ---------------------------------------------------------------------------
log "Step 9/15: npx tsc --noEmit"
npx tsc --noEmit

# ---------------------------------------------------------------------------
# Step 10 — production database migration
#
# `prisma migrate deploy` ONLY — never `prisma migrate dev` (interactive,
# can reset), and `npm run db:seed` is never invoked here: production
# seeding is hard-blocked at the script level (see prisma/seed.ts) and is
# not part of a normal deploy regardless. If this step fails, `set -e`
# stops the script immediately — the symlink is never switched and the
# running service is never restarted, so the previous release stays live
# with its already-migrated schema untouched.
# ---------------------------------------------------------------------------
log "Step 10/15: npm run db:migrate:deploy"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
npm run db:migrate:deploy

# ---------------------------------------------------------------------------
# Step 11 — production build
#
# Uses the SAME env file as the migration step above and as the systemd
# unit at runtime — MAX_UPLOAD_SIZE_MB in particular is baked into
# next.config.ts's Server Action body-size ceiling at this build step (see
# README's Production section), so a build done with different env than
# what the service runs with can silently leave that ceiling wrong.
# ---------------------------------------------------------------------------
log "Step 11/15: npm run build"
npm run build

# ---------------------------------------------------------------------------
# Step 12 — atomic symlink switch
#
# Only reached if every step above succeeded. `ln -sfn` into a temp path
# followed by `mv -T` over the real link is the atomic part — there's never
# a moment where $CURRENT_LINK points at nothing or a half-written target.
# ---------------------------------------------------------------------------
log "Step 12/15: switching $CURRENT_LINK -> $RELEASE_DIR"
PREVIOUS_RELEASE=""
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK")"
fi

# Defined here (not earlier) because it needs $PREVIOUS_RELEASE, which only
# exists from this point on — called by Steps 13/14 below on failure.
attempt_rollback_and_exit() {
  local reason="$1"
  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    log "deployment failed ($reason) — switching $CURRENT_LINK back to the previous release and restarting"
    local tmp_link="$BASE_DIR/.current.tmp.$$"
    ln -sfn "$PREVIOUS_RELEASE" "$tmp_link"
    mv -Tf "$tmp_link" "$CURRENT_LINK"
    sudo systemctl restart "$SERVICE_NAME" || true
    fail "deployment FAILED ($reason). Source rolled back to previous release ($PREVIOUS_RELEASE) and service restarted. This does NOT roll back the database — see README's Rollback section."
  fi
  fail "deployment FAILED ($reason). No previous release to roll back to — investigate manually before retrying."
}

TMP_LINK="$BASE_DIR/.current.tmp.$$"
ln -sfn "$RELEASE_DIR" "$TMP_LINK"
mv -Tf "$TMP_LINK" "$CURRENT_LINK"
CLEANUP_ON_FAILURE=0 # the release is live now — never auto-delete it, even if a later step fails

# ---------------------------------------------------------------------------
# Step 13 — restart the application service
# ---------------------------------------------------------------------------
log "Step 13/15: restarting $SERVICE_NAME"
if ! sudo systemctl restart "$SERVICE_NAME"; then
  log "systemctl restart failed — see 'systemctl status $SERVICE_NAME' and 'journalctl -u $SERVICE_NAME'"
  attempt_rollback_and_exit "restart failed"
fi

# ---------------------------------------------------------------------------
# Step 14 — health check
#
# Talks to the app directly on 127.0.0.1, independent of Nginx/DNS/HTTPS —
# see README's Production section for why.
# ---------------------------------------------------------------------------
log "Step 14/15: checking $HEALTH_URL"
healthy=0
for _ in $(seq 1 "$HEALTH_CHECK_RETRIES"); do
  if curl -sf "$HEALTH_URL" >/dev/null; then
    healthy=1
    break
  fi
  sleep "$HEALTH_CHECK_DELAY_SECONDS"
done

if [ "$healthy" != "1" ]; then
  attempt_rollback_and_exit "health check did not pass after restart"
fi

# ---------------------------------------------------------------------------
# Step 15 — release retention (best-effort — never touches $CURRENT_LINK's
# target or anything outside $RELEASES_DIR)
# ---------------------------------------------------------------------------
log "Step 15/15: pruning old releases (keeping $KEEP_RELEASES most recent + the active one)"
ACTIVE_RELEASE="$(readlink -f "$CURRENT_LINK")"
# List release dirs oldest-first (the RELEASE_ID prefix is a UTC timestamp,
# so lexical sort is chronological sort), skip the active one, delete
# anything beyond the most recent KEEP_RELEASES. `while read` (not
# `mapfile`) deliberately — portable to bash 3.2, not just bash 4+.
ALL_RELEASES=()
while IFS= read -r dir; do
  ALL_RELEASES+=("$dir")
done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
TOTAL_RELEASES=${#ALL_RELEASES[@]}
if [ "$TOTAL_RELEASES" -gt "$KEEP_RELEASES" ]; then
  TO_DELETE_COUNT=$((TOTAL_RELEASES - KEEP_RELEASES))
  DELETED=0
  for dir in "${ALL_RELEASES[@]}"; do
    [ "$DELETED" -lt "$TO_DELETE_COUNT" ] || break
    # Compare canonicalized paths, not raw strings — $ACTIVE_RELEASE went
    # through `readlink -f` above, and if any component of $BASE_DIR is
    # itself a symlink (real-world example: macOS's /tmp -> /private/tmp),
    # a raw string comparison against $dir silently never matches, and the
    # active release gets deleted like any other. Caught via live testing,
    # not just review — resolve both sides the same way.
    if [ "$(readlink -f "$dir")" = "$ACTIVE_RELEASE" ]; then
      continue # never delete the release "current" points to, even if it's old
    fi
    log "removing old release: $dir"
    rm -rf "$dir"
    DELETED=$((DELETED + 1))
  done
fi

log "deploy succeeded: $SHORT_SHA is now live at $CURRENT_LINK ($RELEASE_ID)"
