#!/usr/bin/env bash
#
# backup-db.sh — PostgreSQL backup (Step 13D)
#
# Repository artifact only — NOT executed against any server by this task.
# Intended to run ON THE VPS (directly, or invoked by backup-all.sh) once
# VPS-09's prerequisites and /etc/school-library/production.env exist.
#
# Usage:
#   backup-db.sh [--timestamp <UTC-timestamp>]
#
# --timestamp lets backup-all.sh pass one shared timestamp for both the DB
# and storage backups it orchestrates (see Step 13D's "backup consistency
# window" note in the final report — DB dump and storage archive are two
# separate operations, taken back-to-back, not a single transactional
# snapshot). Without --timestamp, this script generates its own.
#
# Prints the final backup file's absolute path as the ONLY line on stdout
# on success — everything else (progress, errors) goes to stderr via
# common.sh's log()/fail() — so callers can do:
#   DB_BACKUP_FILE="$(backup-db.sh)"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ENV_FILE="${ENV_FILE:-/etc/school-library/production.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/lib/school-library/backups}"
DB_BACKUP_DIR="$BACKUP_ROOT/postgres"
MIN_FREE_MB="${MIN_FREE_MB:-500}"

TIMESTAMP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --timestamp)
      TIMESTAMP="${2:-}"
      [ -n "$TIMESTAMP" ] || fail "--timestamp requires a value"
      shift 2
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done
[ -n "$TIMESTAMP" ] || TIMESTAMP="$(utc_timestamp)"

# ---------------------------------------------------------------------------
# Step 1 — required commands
# ---------------------------------------------------------------------------
log "Step 1/6: checking required commands"
require_commands pg_dump pg_restore mkdir mv df

# ---------------------------------------------------------------------------
# Step 2 — load production env (DATABASE_URL) unless already set — lets
# tests/local dry-runs supply DATABASE_URL directly without a real env file.
# ---------------------------------------------------------------------------
log "Step 2/6: loading database connection details"
if [ -z "${DATABASE_URL:-}" ]; then
  load_env_file "$ENV_FILE"
fi
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set (checked \$DATABASE_URL and $ENV_FILE)"

# ---------------------------------------------------------------------------
# Step 3 — target directory + disk space
# ---------------------------------------------------------------------------
log "Step 3/6: preparing $DB_BACKUP_DIR"
mkdir -p "$DB_BACKUP_DIR" || fail "cannot create $DB_BACKUP_DIR — check ownership/permissions"
chmod 750 "$BACKUP_ROOT" "$DB_BACKUP_DIR" 2>/dev/null || true
[ -w "$DB_BACKUP_DIR" ] || fail "$DB_BACKUP_DIR is not writable by this user"
check_free_space_mb "$DB_BACKUP_DIR" "$MIN_FREE_MB"

# ---------------------------------------------------------------------------
# Step 4 — lock (avoid two DB backups racing on the same target file)
# ---------------------------------------------------------------------------
log "Step 4/6: acquiring backup lock"
acquire_lock "$BACKUP_ROOT/.lock-db"

# ---------------------------------------------------------------------------
# Step 5 — dump to a temp file, validate, then rename to the final name.
# Never leaves a partial file under the final name if anything fails —
# the trap below (chained after acquire_lock's release_lock trap) removes
# the temp file on any failure.
# ---------------------------------------------------------------------------
FINAL_FILE="$DB_BACKUP_DIR/school_library_${TIMESTAMP}.dump"
TMP_FILE="$FINAL_FILE.partial"

cleanup_partial_dump() {
  release_lock
  if [ -f "$TMP_FILE" ]; then
    log "backup failed — removing partial dump $TMP_FILE"
    rm -f "$TMP_FILE"
  fi
}
trap cleanup_partial_dump EXIT

log "Step 5/6: pg_dump (custom format) -> $TMP_FILE"
# $DATABASE_URL is passed directly as a libpq connection URI — pg_dump
# understands "postgresql://user:pass@host/db" natively, so this never
# needs to be parsed apart in bash (error-prone) and is never printed.
pg_dump -Fc "$DATABASE_URL" -f "$TMP_FILE"

[ -s "$TMP_FILE" ] || fail "pg_dump produced an empty file — refusing to keep it"

log "Step 6/6: validating dump with pg_restore --list"
pg_restore --list "$TMP_FILE" >/dev/null || fail "pg_restore --list could not read the dump — refusing to keep it"

mv -f "$TMP_FILE" "$FINAL_FILE"
chmod 640 "$FINAL_FILE"

log "generating checksum"
(cd "$DB_BACKUP_DIR" && sha256_of_file "$(basename "$FINAL_FILE")" > "$(basename "$FINAL_FILE").sha256")
chmod 640 "$FINAL_FILE.sha256"

log "database backup succeeded: $FINAL_FILE ($(du -h "$FINAL_FILE" 2>/dev/null | cut -f1))"
echo "$FINAL_FILE"
