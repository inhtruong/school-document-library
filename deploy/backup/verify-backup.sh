#!/usr/bin/env bash
#
# verify-backup.sh — read-only backup integrity check (Step 13D)
#
# Repository artifact only — NOT executed against any server by this task.
# Safe to run routinely: never modifies production data, never writes to
# STORAGE_ROOT or the database, only reads the manifest and the two backup
# artifacts it names.
#
# Usage:
#   verify-backup.sh <manifest-file>
#   verify-backup.sh --latest   # verifies the most recent backup_*.manifest
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

BACKUP_ROOT="${BACKUP_ROOT:-/var/lib/school-library/backups}"
MANIFEST_DIR="$BACKUP_ROOT/manifests"

MANIFEST_FILE=""
if [ "${1:-}" = "--latest" ]; then
  require_commands find sort
  MANIFEST_FILE="$(find "$MANIFEST_DIR" -maxdepth 1 -type f -name 'backup_*.manifest' 2>/dev/null | sort | tail -n 1)"
  [ -n "$MANIFEST_FILE" ] || fail "no backup_*.manifest files found under $MANIFEST_DIR"
elif [ -n "${1:-}" ]; then
  MANIFEST_FILE="$1"
else
  fail "usage: verify-backup.sh <manifest-file> | verify-backup.sh --latest"
fi

log "Step 1/5: checking required commands"
require_commands pg_restore tar awk

log "Step 2/5: reading manifest: $MANIFEST_FILE"
[ -f "$MANIFEST_FILE" ] || fail "manifest not found: $MANIFEST_FILE"

DB_FILE_NAME=""
DB_SHA256_EXPECTED=""
STORAGE_FILE_NAME=""
STORAGE_SHA256_EXPECTED=""
while IFS='=' read -r key value; do
  case "$key" in
    db_backup_file) DB_FILE_NAME="$value" ;;
    db_backup_sha256) DB_SHA256_EXPECTED="$value" ;;
    storage_backup_file) STORAGE_FILE_NAME="$value" ;;
    storage_backup_sha256) STORAGE_SHA256_EXPECTED="$value" ;;
  esac
done < "$MANIFEST_FILE"

[ -n "$DB_FILE_NAME" ] || fail "manifest is missing db_backup_file"
[ -n "$STORAGE_FILE_NAME" ] || fail "manifest is missing storage_backup_file"

DB_FILE="$BACKUP_ROOT/postgres/$DB_FILE_NAME"
STORAGE_FILE="$BACKUP_ROOT/storage/$STORAGE_FILE_NAME"

FAILURES=0
check() {
  local description="$1" ok="$2"
  if [ "$ok" = "1" ]; then
    log "PASS: $description"
  else
    log "FAIL: $description"
    FAILURES=$((FAILURES + 1))
  fi
}

log "Step 3/5: checking artifacts exist"
[ -f "$DB_FILE" ] && check "DB backup file exists ($DB_FILE_NAME)" 1 || check "DB backup file exists ($DB_FILE_NAME)" 0
[ -f "$STORAGE_FILE" ] && check "storage backup file exists ($STORAGE_FILE_NAME)" 1 || check "storage backup file exists ($STORAGE_FILE_NAME)" 0

log "Step 4/5: checking checksums against the manifest's recorded values"
if [ -f "$DB_FILE" ] && [ -n "$DB_SHA256_EXPECTED" ]; then
  DB_SHA256_ACTUAL="$(sha256_of_file "$DB_FILE" | awk '{print $1}')"
  [ "$DB_SHA256_ACTUAL" = "$DB_SHA256_EXPECTED" ] && check "DB backup checksum matches manifest" 1 || check "DB backup checksum matches manifest" 0
fi
if [ -f "$STORAGE_FILE" ] && [ -n "$STORAGE_SHA256_EXPECTED" ]; then
  STORAGE_SHA256_ACTUAL="$(sha256_of_file "$STORAGE_FILE" | awk '{print $1}')"
  [ "$STORAGE_SHA256_ACTUAL" = "$STORAGE_SHA256_EXPECTED" ] && check "storage backup checksum matches manifest" 1 || check "storage backup checksum matches manifest" 0
fi

log "Step 5/5: checking artifacts are readable by their respective tools"
if [ -f "$DB_FILE" ]; then
  pg_restore --list "$DB_FILE" >/dev/null 2>&1 && check "pg_restore --list can read the DB backup" 1 || check "pg_restore --list can read the DB backup" 0
fi
if [ -f "$STORAGE_FILE" ]; then
  tar -tzf "$STORAGE_FILE" >/dev/null 2>&1 && check "tar -tzf can list the storage archive" 1 || check "tar -tzf can list the storage archive" 0
fi

if [ "$FAILURES" -eq 0 ]; then
  log "VERIFY OK: all checks passed for $MANIFEST_FILE"
  exit 0
else
  log "VERIFY FAILED: $FAILURES check(s) failed for $MANIFEST_FILE"
  exit 1
fi
