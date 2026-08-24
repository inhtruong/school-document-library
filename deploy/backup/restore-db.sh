#!/usr/bin/env bash
#
# restore-db.sh — PostgreSQL restore (Step 13D)
#
# Repository artifact only — NOT executed against any server by this task.
# This is a DANGEROUS operation — read this whole header before using it.
#
# SAFE DEFAULT: restores into a NEW, disposable database
# (school_library_restore_test by default), never into production. This is
# what you want for routine restore drills / verifying a backup is good.
#
# Usage:
#   restore-db.sh <backup-file> [--target-db <name>] [--skip-checksum]
#   restore-db.sh <backup-file> --production --confirm "OVERWRITE PRODUCTION DATABASE"
#
# --production restores INTO the real production database named in
# DATABASE_URL. This DROPS the existing database and recreates it from the
# backup — it is NOT reversible by this script, and this script performs NO
# automatic rollback if it fails partway (same philosophy as deploy.sh's
# Step 13B rollback: "Source rollback != database rollback" — there is no
# safety net here beyond the backup file itself). Production restore
# REQUIRES both --production AND the exact --confirm phrase below; it is
# never the default, and this script must never be invoked automatically as
# part of a deploy (see deploy.sh, which never calls this file).
#
#   CONFIRM_PHRASE="OVERWRITE PRODUCTION DATABASE"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

readonly CONFIRM_PHRASE="OVERWRITE PRODUCTION DATABASE"
readonly DEFAULT_TEST_DB="school_library_restore_test"

ENV_FILE="${ENV_FILE:-/etc/school-library/production.env}"
BACKUP_FILE=""
TARGET_DB=""
PRODUCTION_MODE=0
CONFIRM_ARG=""
SKIP_CHECKSUM=0

while [ $# -gt 0 ]; do
  case "$1" in
    --target-db)
      TARGET_DB="${2:-}"
      [ -n "$TARGET_DB" ] || fail "--target-db requires a value"
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
      if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$1"
      else
        fail "unexpected extra argument: $1"
      fi
      shift
      ;;
  esac
done

[ -n "$BACKUP_FILE" ] || fail "usage: restore-db.sh <backup-file> [--target-db <name>] [--production --confirm \"$CONFIRM_PHRASE\"]"

# ---------------------------------------------------------------------------
# Step 1 — required commands
# ---------------------------------------------------------------------------
log "Step 1/6: checking required commands"
require_commands pg_restore psql node

# ---------------------------------------------------------------------------
# Step 2 — verify the backup file itself before touching any database
# ---------------------------------------------------------------------------
log "Step 2/6: verifying backup file"
[ -f "$BACKUP_FILE" ] || fail "backup file not found: $BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || fail "backup file is empty: $BACKUP_FILE"

CHECKSUM_FILE="$BACKUP_FILE.sha256"
if [ "$SKIP_CHECKSUM" = "1" ]; then
  log "checksum verification skipped (--skip-checksum)"
elif [ -f "$CHECKSUM_FILE" ]; then
  verify_sha256_file "$CHECKSUM_FILE" || fail "checksum verification FAILED for $BACKUP_FILE — the file may be corrupted or tampered with"
  log "checksum verified OK"
else
  log "WARNING: no checksum file found at $CHECKSUM_FILE — proceeding without checksum verification"
fi

pg_restore --list "$BACKUP_FILE" >/dev/null || fail "pg_restore --list could not read this file — it is not a valid PostgreSQL custom-format dump"
log "backup file is a valid pg_restore-compatible dump"

# ---------------------------------------------------------------------------
# Step 3 — connection details
# ---------------------------------------------------------------------------
log "Step 3/6: loading database connection details"
if [ -z "${DATABASE_URL:-}" ]; then
  load_env_file "$ENV_FILE"
fi
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set (checked \$DATABASE_URL and $ENV_FILE)"
PRODUCTION_DB_NAME="$(db_name_from_url "$DATABASE_URL")"
[ -n "$PRODUCTION_DB_NAME" ] || fail "could not determine a database name from DATABASE_URL"

# ---------------------------------------------------------------------------
# Step 4 — determine and validate the restore target. Never silently drops
# the production database: that only ever happens when BOTH --production
# AND the exact confirmation phrase are supplied.
# ---------------------------------------------------------------------------
log "Step 4/6: determining restore target"
if [ "$PRODUCTION_MODE" = "1" ]; then
  [ -z "$TARGET_DB" ] || fail "--target-db cannot be combined with --production — production mode always targets the database named in DATABASE_URL ($PRODUCTION_DB_NAME)"
  [ "$CONFIRM_ARG" = "$CONFIRM_PHRASE" ] || fail "production restore requires --confirm \"$CONFIRM_PHRASE\" (exact match) — refusing without it"
  TARGET_DB="$PRODUCTION_DB_NAME"
  log "PRODUCTION MODE CONFIRMED — restoring into the real production database: $TARGET_DB"
  log "This DROPS and recreates $TARGET_DB. There is no automatic rollback."
else
  [ -z "$TARGET_DB" ] && TARGET_DB="$DEFAULT_TEST_DB"
  if [ "$TARGET_DB" = "$PRODUCTION_DB_NAME" ]; then
    fail "refusing to restore into \"$TARGET_DB\" without --production — this is the production database name from DATABASE_URL. Pass --production --confirm \"$CONFIRM_PHRASE\" if that is really intended."
  fi
  log "safe mode — restoring into disposable database: $TARGET_DB"
fi
validate_db_identifier "$TARGET_DB"

# ---------------------------------------------------------------------------
# Step 5 — (re)create the target database via the "postgres" maintenance DB
# ---------------------------------------------------------------------------
log "Step 5/6: recreating target database"
MAINTENANCE_URL="$(build_db_url_with_dbname "$DATABASE_URL" "postgres")"
TARGET_URL="$(build_db_url_with_dbname "$DATABASE_URL" "$TARGET_DB")"

# WITH (FORCE) (PostgreSQL 13+; production target is PostgreSQL 17 per
# README) also terminates any other connections to the database being
# dropped — appropriate here since a restore is inherently exclusive.
psql -v ON_ERROR_STOP=1 "$MAINTENANCE_URL" \
  -c "DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);" \
  -c "CREATE DATABASE \"$TARGET_DB\";" \
  >/dev/null

# ---------------------------------------------------------------------------
# Step 6 — restore
# ---------------------------------------------------------------------------
log "Step 6/6: restoring $BACKUP_FILE into $TARGET_DB"
if ! pg_restore --no-owner --no-privileges -d "$TARGET_URL" "$BACKUP_FILE"; then
  if [ "$PRODUCTION_MODE" = "1" ]; then
    fail "PRODUCTION restore FAILED — $TARGET_DB may now be empty or only partially restored. This script performs NO automatic rollback. Manual intervention required — see the backup file's checksum/pg_restore --list output and consider restoring from an earlier backup."
  fi
  fail "restore into $TARGET_DB failed — see pg_restore's output above"
fi

log "restore succeeded: $BACKUP_FILE -> database \"$TARGET_DB\""
if [ "$PRODUCTION_MODE" != "1" ]; then
  log "this was a SAFE, non-production restore. Verify the data, then drop \"$TARGET_DB\" when done (it is not used by the running application)."
fi
