#!/usr/bin/env bash
#
# restore-storage.sh — uploaded-document storage restore (Step 13D)
#
# Repository artifact only — NOT executed against any server by this task.
#
# SAFE DEFAULT: extracts into a caller-supplied (or default temporary)
# target directory — NEVER overwrites the real STORAGE_ROOT unless
# explicitly told to.
#
# Usage:
#   restore-storage.sh <archive-file> [--target-dir <dir>] [--skip-checksum]
#   restore-storage.sh <archive-file> --production --confirm "OVERWRITE PRODUCTION STORAGE"
#
# --production extracts INTO the real STORAGE_ROOT (loaded from the
# production env), overwriting/merging into it — this is destructive to
# whatever's already there and requires the exact --confirm phrase below.
# It is never the default.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

readonly CONFIRM_PHRASE="OVERWRITE PRODUCTION STORAGE"
readonly DEFAULT_TARGET_DIR="/tmp/school-library-storage-restore"

ENV_FILE="${ENV_FILE:-/etc/school-library/production.env}"
ARCHIVE_FILE=""
TARGET_DIR=""
PRODUCTION_MODE=0
CONFIRM_ARG=""
SKIP_CHECKSUM=0

while [ $# -gt 0 ]; do
  case "$1" in
    --target-dir)
      TARGET_DIR="${2:-}"
      [ -n "$TARGET_DIR" ] || fail "--target-dir requires a value"
      shift 2
      ;;
    --production)
      PRODUCTION_MODE=1
      shift
      ;;
    --confirm)
      CONFIRM_ARG="${2:-}"
      shift 2
      ;;
    --skip-checksum)
      SKIP_CHECKSUM=1
      shift
      ;;
    -*)
      fail "unknown argument: $1"
      ;;
    *)
      if [ -z "$ARCHIVE_FILE" ]; then
        ARCHIVE_FILE="$1"
      else
        fail "unexpected extra argument: $1"
      fi
      shift
      ;;
  esac
done

[ -n "$ARCHIVE_FILE" ] || fail "usage: restore-storage.sh <archive-file> [--target-dir <dir>] [--production --confirm \"$CONFIRM_PHRASE\"]"

# ---------------------------------------------------------------------------
# Step 1 — required commands
# ---------------------------------------------------------------------------
log "Step 1/5: checking required commands"
require_commands tar mkdir find

# ---------------------------------------------------------------------------
# Step 2 — verify the archive itself before touching any filesystem target
# ---------------------------------------------------------------------------
log "Step 2/5: verifying archive file"
[ -f "$ARCHIVE_FILE" ] || fail "archive file not found: $ARCHIVE_FILE"
[ -s "$ARCHIVE_FILE" ] || fail "archive file is empty: $ARCHIVE_FILE"

CHECKSUM_FILE="$ARCHIVE_FILE.sha256"
if [ "$SKIP_CHECKSUM" = "1" ]; then
  log "checksum verification skipped (--skip-checksum)"
elif [ -f "$CHECKSUM_FILE" ]; then
  verify_sha256_file "$CHECKSUM_FILE" || fail "checksum verification FAILED for $ARCHIVE_FILE — the file may be corrupted or tampered with"
  log "checksum verified OK"
else
  log "WARNING: no checksum file found at $CHECKSUM_FILE — proceeding without checksum verification"
fi

tar -tzf "$ARCHIVE_FILE" >/dev/null || fail "tar -tzf could not list this archive — it is not a valid tar.gz file"

# ---------------------------------------------------------------------------
# Step 3 — reject any unsafe entry BEFORE extracting anything. The archive
# is an untrusted backup artifact from a restore perspective.
# ---------------------------------------------------------------------------
log "Step 3/5: scanning archive entries for path traversal / absolute paths"
reject_unsafe_archive_entries "$ARCHIVE_FILE"
log "archive entries look safe (no absolute paths, no .. segments)"

# ---------------------------------------------------------------------------
# Step 4 — determine and validate the restore target
# ---------------------------------------------------------------------------
log "Step 4/5: determining restore target"
if [ "$PRODUCTION_MODE" = "1" ]; then
  [ -z "$TARGET_DIR" ] || fail "--target-dir cannot be combined with --production — production mode always targets STORAGE_ROOT from the production env"
  [ "$CONFIRM_ARG" = "$CONFIRM_PHRASE" ] || fail "production restore requires --confirm \"$CONFIRM_PHRASE\" (exact match) — refusing without it"
  if [ -z "${STORAGE_ROOT:-}" ]; then
    load_env_file "$ENV_FILE"
  fi
  [ -n "${STORAGE_ROOT:-}" ] || fail "STORAGE_ROOT is not set (checked \$STORAGE_ROOT and $ENV_FILE)"
  case "$STORAGE_ROOT" in
    /) fail "STORAGE_ROOT is '/' — refusing" ;;
    /*) : ;;
    *) fail "STORAGE_ROOT must be an absolute path (got \"$STORAGE_ROOT\")" ;;
  esac
  TARGET_DIR="$STORAGE_ROOT"
  log "PRODUCTION MODE CONFIRMED — extracting into the real storage root: $TARGET_DIR"
  log "Existing files with the same relative path will be overwritten. Files not present in the archive are left untouched (this is an overlay, not a wipe-then-restore)."
else
  [ -z "$TARGET_DIR" ] && TARGET_DIR="$DEFAULT_TARGET_DIR"
  if [ -d "$TARGET_DIR" ] && [ -n "$(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
    fail "$TARGET_DIR already exists and is not empty — refusing to extract into it without --production. Choose an empty/new --target-dir."
  fi
  log "safe mode — extracting into: $TARGET_DIR"
fi

# ---------------------------------------------------------------------------
# Step 5 — extract
# ---------------------------------------------------------------------------
log "Step 5/5: extracting $ARCHIVE_FILE -> $TARGET_DIR"
mkdir -p "$TARGET_DIR" || fail "cannot create $TARGET_DIR — check ownership/permissions"
tar -xzf "$ARCHIVE_FILE" -C "$TARGET_DIR"

log "restore succeeded: $ARCHIVE_FILE -> $TARGET_DIR"
if [ "$PRODUCTION_MODE" != "1" ]; then
  log "this was a SAFE, non-production restore. Inspect $TARGET_DIR, then remove it when done."
fi
