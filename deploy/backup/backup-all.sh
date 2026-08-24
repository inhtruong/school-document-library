#!/usr/bin/env bash
#
# backup-all.sh — full backup orchestration: PostgreSQL + storage (Step 13D)
#
# Repository artifact only — NOT executed against any server by this task.
# Intended to run ON THE VPS, directly or from the optional
# deploy/backup/systemd/school-library-backup.timer template (not installed
# by this task — see that directory's own header comment).
#
# Runs backup-db.sh and backup-storage.sh back-to-back under ONE shared
# timestamp, validates both artifacts, writes a manifest, then prunes old
# backup sets beyond KEEP_BACKUPS.
#
# IMPORTANT — consistency window: PostgreSQL and the storage filesystem are
# two separate systems. This script provides NO cross-system transactional
# guarantee — the DB dump and the storage archive are two back-to-back
# operations, not one atomic snapshot. A file uploaded (or a DB row
# committed) in the brief window between the two steps could end up
# reflected in one artifact but not the other. The window is kept as tight
# as practical (DB dump immediately followed by storage archive, no
# unrelated work in between) but is NOT eliminated. See the Step 13D final
# report for the full explanation — this is a documented limitation, not an
# oversight.
#
# LOCAL BACKUP IS NOT DISASTER RECOVERY: everything this script writes stays
# on $BACKUP_ROOT, which is the SAME VPS disk as the application and
# database. It protects against accidental deletion and some
# application-level mistakes. It does NOT protect against VPS disk failure,
# provider loss, VPS deletion, or ransomware/system compromise. Off-site
# sync (see sync-backups.sh) is a separate, NOT-yet-configured concern.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_ROOT="${BACKUP_ROOT:-/var/lib/school-library/backups}"
MANIFEST_DIR="$BACKUP_ROOT/manifests"
KEEP_BACKUPS="${KEEP_BACKUPS:-14}" # MVP retention: keep the N most recent full backup sets
MANIFEST_FORMAT_VERSION="1"

log "Step 1/7: checking required commands"
require_commands mkdir mv find sort du awk

TIMESTAMP="$(utc_timestamp)"
log "Step 2/7: starting full backup, timestamp=$TIMESTAMP"

mkdir -p "$MANIFEST_DIR" || fail "cannot create $MANIFEST_DIR — check ownership/permissions"
chmod 750 "$BACKUP_ROOT" "$MANIFEST_DIR" 2>/dev/null || true

# Top-level lock — the individual backup-db.sh/backup-storage.sh scripts
# each hold their own component-specific lock only while they run; this one
# serializes whole backup-all.sh RUNS against each other (e.g. two
# overlapping cron/timer firings), so manifest writing and retention pruning
# below never race against a second concurrent run.
log "Step 3/7: acquiring overall backup lock"
acquire_lock "$BACKUP_ROOT/.lock-all"

# ---------------------------------------------------------------------------
# Step 4 — PostgreSQL backup (fails loudly under `set -e` if backup-db.sh
# exits non-zero — no manifest is ever written past this point in that case)
# ---------------------------------------------------------------------------
log "Step 4/7: backing up PostgreSQL"
DB_BACKUP_FILE="$("$SCRIPT_DIR/backup-db.sh" --timestamp "$TIMESTAMP")"

# ---------------------------------------------------------------------------
# Step 5 — storage backup (same fail-loudly behavior as above)
# ---------------------------------------------------------------------------
log "Step 5/7: backing up storage"
STORAGE_BACKUP_FILE="$("$SCRIPT_DIR/backup-storage.sh" --timestamp "$TIMESTAMP")"

# ---------------------------------------------------------------------------
# Step 6 — re-validate both artifacts explicitly (defense in depth — each
# sub-script already validated its own output before returning) and collect
# manifest metadata. Never reports success if either is missing/empty.
# ---------------------------------------------------------------------------
log "Step 6/7: validating both artifacts and writing manifest"
[ -s "$DB_BACKUP_FILE" ] || fail "DB backup file missing or empty after backup-db.sh reported success: $DB_BACKUP_FILE"
[ -s "$STORAGE_BACKUP_FILE" ] || fail "storage backup file missing or empty after backup-storage.sh reported success: $STORAGE_BACKUP_FILE"
require_commands pg_restore tar
pg_restore --list "$DB_BACKUP_FILE" >/dev/null || fail "DB backup failed re-validation (pg_restore --list)"
tar -tzf "$STORAGE_BACKUP_FILE" >/dev/null || fail "storage backup failed re-validation (tar -tzf)"

DB_SHA256_FILE="$DB_BACKUP_FILE.sha256"
STORAGE_SHA256_FILE="$STORAGE_BACKUP_FILE.sha256"
[ -f "$DB_SHA256_FILE" ] || fail "missing checksum file: $DB_SHA256_FILE"
[ -f "$STORAGE_SHA256_FILE" ] || fail "missing checksum file: $STORAGE_SHA256_FILE"

DB_SHA256="$(awk '{print $1}' "$DB_SHA256_FILE")"
STORAGE_SHA256="$(awk '{print $1}' "$STORAGE_SHA256_FILE")"
DB_SIZE_BYTES="$(wc -c < "$DB_BACKUP_FILE" | tr -d '[:space:]')"
STORAGE_SIZE_BYTES="$(wc -c < "$STORAGE_BACKUP_FILE" | tr -d '[:space:]')"

MANIFEST_FINAL="$MANIFEST_DIR/backup_${TIMESTAMP}.manifest"
MANIFEST_TMP="$MANIFEST_FINAL.partial"

# Never includes: DB password, AUTH_SECRET, DATABASE_URL, file contents, or
# session tokens — only filenames, sizes, and checksums.
{
  echo "format_version=$MANIFEST_FORMAT_VERSION"
  echo "timestamp=$TIMESTAMP"
  echo "db_backup_file=$(basename "$DB_BACKUP_FILE")"
  echo "db_backup_size_bytes=$DB_SIZE_BYTES"
  echo "db_backup_sha256=$DB_SHA256"
  echo "storage_backup_file=$(basename "$STORAGE_BACKUP_FILE")"
  echo "storage_backup_size_bytes=$STORAGE_SIZE_BYTES"
  echo "storage_backup_sha256=$STORAGE_SHA256"
} > "$MANIFEST_TMP"
mv -f "$MANIFEST_TMP" "$MANIFEST_FINAL"
chmod 640 "$MANIFEST_FINAL"

# ---------------------------------------------------------------------------
# Step 7 — retention: keep the KEEP_BACKUPS most recent full backup sets.
# Simple MVP policy (not daily/weekly/monthly tiers — see Step 13D's final
# report for why). Only ever deletes files whose manifest names the exact
# basename, and only from inside $BACKUP_ROOT (canonical-path-checked) —
# never touches active storage, source code, production env, or anything
# outside the backup root.
# ---------------------------------------------------------------------------
log "Step 7/7: pruning backup sets beyond the $KEEP_BACKUPS most recent"
ALL_MANIFESTS=()
while IFS= read -r manifest; do
  ALL_MANIFESTS+=("$manifest")
done < <(find "$MANIFEST_DIR" -maxdepth 1 -type f -name 'backup_*.manifest' | sort)

TOTAL_MANIFESTS=${#ALL_MANIFESTS[@]}
if [ "$TOTAL_MANIFESTS" -gt "$KEEP_BACKUPS" ]; then
  TO_DELETE_COUNT=$((TOTAL_MANIFESTS - KEEP_BACKUPS))
  DELETED=0
  for manifest in "${ALL_MANIFESTS[@]}"; do
    [ "$DELETED" -lt "$TO_DELETE_COUNT" ] || break

    OLD_DB_FILE=""
    OLD_STORAGE_FILE=""
    while IFS='=' read -r key value; do
      case "$key" in
        db_backup_file) OLD_DB_FILE="$value" ;;
        storage_backup_file) OLD_STORAGE_FILE="$value" ;;
      esac
    done < "$manifest"

    log "removing old backup set: $(basename "$manifest")"
    for candidate in \
      "$BACKUP_ROOT/postgres/$OLD_DB_FILE" "$BACKUP_ROOT/postgres/$OLD_DB_FILE.sha256" \
      "$BACKUP_ROOT/storage/$OLD_STORAGE_FILE" "$BACKUP_ROOT/storage/$OLD_STORAGE_FILE.sha256" \
      "$manifest"
    do
      if [ -n "$candidate" ] && [ -f "$candidate" ] && path_is_within "$candidate" "$BACKUP_ROOT"; then
        rm -f "$candidate"
      fi
    done
    DELETED=$((DELETED + 1))
  done
else
  log "only $TOTAL_MANIFESTS backup set(s) present — nothing to prune (keeping up to $KEEP_BACKUPS)"
fi

log "full backup succeeded: $MANIFEST_FINAL"
log "  db:      $DB_BACKUP_FILE"
log "  storage: $STORAGE_BACKUP_FILE"
echo "$MANIFEST_FINAL"
