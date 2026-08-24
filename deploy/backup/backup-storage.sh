#!/usr/bin/env bash
#
# backup-storage.sh — uploaded-document storage backup (Step 13D)
#
# Repository artifact only — NOT executed against any server by this task.
# Intended to run ON THE VPS (directly, or invoked by backup-all.sh).
# Archives the CONTENTS of STORAGE_ROOT (see @/lib/env's STORAGE_ROOT,
# Step 13A) into a timestamped tar.gz — never assumes a source-tree storage
# path like storage_local/, always uses the configured production root.
#
# Usage:
#   backup-storage.sh [--timestamp <UTC-timestamp>]
#
# Prints the final archive's absolute path as the ONLY line on stdout on
# success — everything else goes to stderr via common.sh's log()/fail().
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ENV_FILE="${ENV_FILE:-/etc/school-library/production.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/lib/school-library/backups}"
STORAGE_BACKUP_DIR="$BACKUP_ROOT/storage"
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
require_commands tar mkdir mv df

# ---------------------------------------------------------------------------
# Step 2 — resolve STORAGE_ROOT, unless already set — lets tests/local
# dry-runs supply STORAGE_ROOT directly without a real env file.
# ---------------------------------------------------------------------------
log "Step 2/6: resolving STORAGE_ROOT"
if [ -z "${STORAGE_ROOT:-}" ]; then
  load_env_file "$ENV_FILE"
fi
[ -n "${STORAGE_ROOT:-}" ] || fail "STORAGE_ROOT is not set (checked \$STORAGE_ROOT and $ENV_FILE)"

# ---------------------------------------------------------------------------
# Step 3 — safety checks on the source path before touching anything
# ---------------------------------------------------------------------------
log "Step 3/6: validating STORAGE_ROOT ($STORAGE_ROOT)"
case "$STORAGE_ROOT" in
  /) fail "STORAGE_ROOT is '/' — refusing to back up the entire filesystem" ;;
  /*) : ;; # absolute — required
  *) fail "STORAGE_ROOT must be an absolute path (got \"$STORAGE_ROOT\")" ;;
esac
[ -e "$STORAGE_ROOT" ] || fail "STORAGE_ROOT does not exist: $STORAGE_ROOT"
[ -d "$STORAGE_ROOT" ] || fail "STORAGE_ROOT is not a directory: $STORAGE_ROOT"

RESOLVED_ROOT="$(canonical_path "$STORAGE_ROOT")"
# Refuse an obviously-too-shallow path — a handful of well-known system
# roots that a misconfigured STORAGE_ROOT could otherwise resolve to.
case "$RESOLVED_ROOT" in
  "/"|"/etc"|"/etc/"*|"/home"|"/root"|"/usr"|"/bin"|"/sbin"|"/boot"|"/var"|"/lib"|"/lib64")
    fail "STORAGE_ROOT resolves to a system path ($RESOLVED_ROOT) — refusing to archive it" ;;
esac

# ---------------------------------------------------------------------------
# Step 4 — target directory + disk space
# ---------------------------------------------------------------------------
log "Step 4/6: preparing $STORAGE_BACKUP_DIR"
mkdir -p "$STORAGE_BACKUP_DIR" || fail "cannot create $STORAGE_BACKUP_DIR — check ownership/permissions"
chmod 750 "$BACKUP_ROOT" "$STORAGE_BACKUP_DIR" 2>/dev/null || true
[ -w "$STORAGE_BACKUP_DIR" ] || fail "$STORAGE_BACKUP_DIR is not writable by this user"
check_free_space_mb "$STORAGE_BACKUP_DIR" "$MIN_FREE_MB"

# ---------------------------------------------------------------------------
# Step 5 — lock, archive to a temp file, validate, rename to final name.
# This only ever READS from STORAGE_ROOT — nothing here modifies or deletes
# a single file under it.
# ---------------------------------------------------------------------------
log "Step 5/6: acquiring backup lock"
acquire_lock "$BACKUP_ROOT/.lock-storage"

FINAL_FILE="$STORAGE_BACKUP_DIR/storage_${TIMESTAMP}.tar.gz"
TMP_FILE="$FINAL_FILE.partial"

cleanup_partial_archive() {
  release_lock
  if [ -f "$TMP_FILE" ]; then
    log "backup failed — removing partial archive $TMP_FILE"
    rm -f "$TMP_FILE"
  fi
}
trap cleanup_partial_archive EXIT

log "archiving contents of $STORAGE_ROOT -> $TMP_FILE"
# `-C "$STORAGE_ROOT" .` archives STORAGE_ROOT's CONTENTS at the archive
# root (not wrapped in an extra "storage/" directory), so restoring into
# any target directory reproduces the exact original layout. No `-h`/
# `--dereference` — symlinks are stored as symlinks, never followed into
# their target's content (tar's safe default), avoiding an unexpectedly
# large or out-of-tree archive from a stray symlink under STORAGE_ROOT.
tar -czf "$TMP_FILE" -C "$STORAGE_ROOT" .

[ -s "$TMP_FILE" ] || fail "tar produced an empty file — refusing to keep it"

log "Step 6/6: validating archive with tar -tzf"
tar -tzf "$TMP_FILE" >/dev/null || fail "tar -tzf could not list the archive — refusing to keep it"

mv -f "$TMP_FILE" "$FINAL_FILE"
chmod 640 "$FINAL_FILE"

log "generating checksum"
(cd "$STORAGE_BACKUP_DIR" && sha256_of_file "$(basename "$FINAL_FILE")" > "$(basename "$FINAL_FILE").sha256")
chmod 640 "$FINAL_FILE.sha256"

log "storage backup succeeded: $FINAL_FILE ($(du -h "$FINAL_FILE" 2>/dev/null | cut -f1))"
echo "$FINAL_FILE"
