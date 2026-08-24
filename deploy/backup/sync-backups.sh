#!/usr/bin/env bash
#
# sync-backups.sh — off-site backup sync PLACEHOLDER (Step 13D)
#
# Repository artifact only — NOT executed against any server by this task.
#
# OFF-SITE BACKUP IS NOT CONFIGURED. This script does not contact any
# external service, does not embed any provider credentials, and does not
# hardcode a vendor. It exists purely as the future hook point: once local
# backups (backup-all.sh) are working and verified on the real VPS, a
# LATER, separate task can wire this up to a real off-site destination.
#
# Local backups under $BACKUP_ROOT are on the SAME VPS disk as the
# application and database — see backup-all.sh's header comment. They do
# NOT protect against VPS disk failure, provider loss, VPS deletion, or
# ransomware/system compromise. Off-site sync is what would close that gap,
# and it is intentionally not built here.
#
# Future options (any of these — not chosen or configured here):
#   - rclone sync "$BACKUP_ROOT" "remote:bucket/school-library-backups"
#   - restic (repository on S3-compatible storage / Backblaze B2 / another host)
#   - S3-compatible storage (AWS S3, MinIO, ...)
#   - Backblaze B2
#   - Cloudflare R2
#   - rsync/scp to a second, independent VPS
#
# Usage:
#   sync-backups.sh
#
# Behavior TODAY: reads OFFSITE_SYNC_TARGET from the environment. If unset
# (the default), logs that off-site sync is not configured and exits 0 —
# this is a deliberate no-op, safe to call from backup-all.sh or a timer in
# the future without breaking anything, and safe to call right now.
#
# If a future task sets OFFSITE_SYNC_TARGET AND OFFSITE_SYNC_COMMAND (a
# command template — this script never assumes which tool is installed),
# this script runs that command with $BACKUP_ROOT and $OFFSITE_SYNC_TARGET
# available to it. That wiring is provided as a hook only — no such command
# is configured or invoked by this task.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

BACKUP_ROOT="${BACKUP_ROOT:-/var/lib/school-library/backups}"

if [ -z "${OFFSITE_SYNC_TARGET:-}" ]; then
  log "off-site sync is NOT configured (OFFSITE_SYNC_TARGET is unset) — skipping."
  log "See this script's header comment for future rclone/restic/S3/R2/another-VPS options."
  exit 0
fi

[ -n "${OFFSITE_SYNC_COMMAND:-}" ] || fail "OFFSITE_SYNC_TARGET is set but OFFSITE_SYNC_COMMAND is not — refusing to guess a sync tool/command"

log "running configured off-site sync command against $BACKUP_ROOT -> $OFFSITE_SYNC_TARGET"
# The command template itself, its tool, and its credentials are entirely
# the operator's own future configuration — never provided or assumed here.
eval "$OFFSITE_SYNC_COMMAND"
log "off-site sync command completed"
