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
#   restore-db.sh <backup-file> [--target-db <name>] [--recreate] [--skip-checksum]
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
#
# PRIVILEGE MODEL (fixed after a real VPS restore drill failed with
# "permission denied to create database"):
#
# The application role (school_app, from DATABASE_URL) intentionally does
# NOT have CREATEDB/SUPERUSER — that's correct least-privilege and this
# script must never require it to. Connecting to a different database name
# with the SAME role (the original bug) does not grant new privileges:
# CREATEDB is a role attribute, not a per-database one. Database lifecycle
# operations (CREATE DATABASE / DROP DATABASE) here go through a separate
# local PostgreSQL ADMIN context instead — see common.sh's run_pg_admin()
# ("sudo -u postgres" by default, peer-auth, no password, nothing in any
# env file). The actual data restore (pg_restore) still runs as school_app,
# against the database the admin context just created for it.
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
RECREATE=0

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
    --recreate)
      RECREATE=1
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

[ -n "$BACKUP_FILE" ] || fail "usage: restore-db.sh <backup-file> [--target-db <name>] [--recreate] [--production --confirm \"$CONFIRM_PHRASE\"]"

# ---------------------------------------------------------------------------
# Step 1 — required commands
# ---------------------------------------------------------------------------
log "Step 1/8: checking required commands"
require_commands pg_restore psql node
# The admin runner's own command (e.g. "sudo") is checked lazily inside
# run_pg_admin, once we know $PG_ADMIN_RUNNER — not here, since it may be
# legitimately overridden for local testing (see common.sh).

# ---------------------------------------------------------------------------
# Step 2 — verify the backup file itself before touching any database
# ---------------------------------------------------------------------------
log "Step 2/8: verifying backup file"
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
# Step 3 — connection details. APP_ROLE (school_app in production) is
# derived from DATABASE_URL, not hardcoded, and is validated the same way
# TARGET_DB is — it's about to be used in DDL (OWNER "$APP_ROLE").
# ---------------------------------------------------------------------------
log "Step 3/8: loading database connection details"
if [ -z "${DATABASE_URL:-}" ]; then
  load_env_file "$ENV_FILE"
fi
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set (checked \$DATABASE_URL and $ENV_FILE)"
PRODUCTION_DB_NAME="$(db_name_from_url "$DATABASE_URL")"
[ -n "$PRODUCTION_DB_NAME" ] || fail "could not determine a database name from DATABASE_URL"
APP_ROLE="$(db_user_from_url "$DATABASE_URL")"
[ -n "$APP_ROLE" ] || fail "could not determine an application role from DATABASE_URL"
validate_db_identifier "$APP_ROLE"

# ---------------------------------------------------------------------------
# Step 4 — determine and validate the restore target. Never silently drops
# the production database: that only ever happens when BOTH --production
# AND the exact confirmation phrase are supplied.
# ---------------------------------------------------------------------------
log "Step 4/8: determining restore target"
if [ "$PRODUCTION_MODE" = "1" ]; then
  [ -z "$TARGET_DB" ] || fail "--target-db cannot be combined with --production — production mode always targets the database named in DATABASE_URL ($PRODUCTION_DB_NAME)"
  [ "$RECREATE" != "1" ] || fail "--recreate only applies to the safe (non-production) restore path — production mode always recreates the target after confirmation"
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
# Step 5 — (re)create the target database via the ADMIN context (see this
# script's header and common.sh's run_pg_admin — NOT via school_app, which
# deliberately lacks CREATEDB). In safe mode, an already-existing target is
# refused unless --recreate was passed, so a routine restore drill never
# silently destroys whatever was already sitting in that test database.
# ---------------------------------------------------------------------------
log "Step 5/8: preparing target database via the PostgreSQL admin context"
if [ "$PRODUCTION_MODE" = "1" ]; then
  log "dropping and recreating $TARGET_DB via admin context (WITH FORCE — terminates any active connections)"
  run_pg_admin_sql "DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);"
  run_pg_admin_sql "CREATE DATABASE \"$TARGET_DB\" OWNER \"$APP_ROLE\";"
else
  if pg_database_exists "$TARGET_DB"; then
    [ "$RECREATE" = "1" ] || fail "database \"$TARGET_DB\" already exists — refusing to silently destroy it. Pass --recreate to allow dropping and recreating it, or choose a different --target-db."
    log "\"$TARGET_DB\" already exists and --recreate was given — dropping and recreating via admin context"
    run_pg_admin_sql "DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);"
  fi
  run_pg_admin_sql "CREATE DATABASE \"$TARGET_DB\" OWNER \"$APP_ROLE\";"
fi

# ---------------------------------------------------------------------------
# Step 6 — verify the database the admin context just created is actually
# owned by the application role before restoring anything into it.
# ---------------------------------------------------------------------------
log "Step 6/8: verifying target database ownership"
ACTUAL_OWNER="$(pg_database_owner "$TARGET_DB")"
[ "$ACTUAL_OWNER" = "$APP_ROLE" ] || fail "target database \"$TARGET_DB\" is owned by \"$ACTUAL_OWNER\", expected \"$APP_ROLE\" — refusing to restore into it"
log "confirmed: \"$TARGET_DB\" is owned by \"$APP_ROLE\""

# ---------------------------------------------------------------------------
# Step 7 — restore. Runs as the APPLICATION role (school_app), over
# DATABASE_URL's own credentials pointed at $TARGET_DB — never as the
# admin context. school_app owns $TARGET_DB (Step 6), so it has full
# rights to create the restored objects within it. --no-owner/--no-
# privileges make the restored objects' ownership independent of whatever
# role owned them in the source dump, so they always end up owned by
# whichever role performs this restore (school_app here) rather than
# whatever the dump happens to say.
# ---------------------------------------------------------------------------
log "Step 7/8: restoring $BACKUP_FILE into $TARGET_DB (as $APP_ROLE)"
TARGET_URL="$(build_db_url_with_dbname "$DATABASE_URL" "$TARGET_DB")"
if ! pg_restore --no-owner --no-privileges -d "$TARGET_URL" "$BACKUP_FILE"; then
  if [ "$PRODUCTION_MODE" = "1" ]; then
    fail "PRODUCTION restore FAILED — $TARGET_DB may now be empty or only partially restored. This script performs NO automatic rollback. Manual intervention required — see the backup file's checksum/pg_restore --list output and consider restoring from an earlier backup."
  fi
  log "restore into disposable database \"$TARGET_DB\" failed — cleaning it up via admin context (safe: it is not the production database)"
  run_pg_admin_sql "DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);" || log "WARNING: cleanup of failed restore target \"$TARGET_DB\" also failed — it may still exist"
  fail "restore into $TARGET_DB failed — see pg_restore's output above"
fi

# ---------------------------------------------------------------------------
# Step 8 — post-restore verification: the target actually has restored
# content, school_app itself can connect and query it, and — importantly
# after everything above — school_app's own privileges are still exactly
# what they should be (this script must never be the reason they change).
# ---------------------------------------------------------------------------
log "Step 8/8: verifying restored data and role privileges"
RESTORED_TABLE_COUNT="$(psql -v ON_ERROR_STOP=1 -tA "$TARGET_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")"
[ "${RESTORED_TABLE_COUNT:-0}" -gt 0 ] 2>/dev/null || fail "restore reported success but \"$TARGET_DB\" has no tables in schema public — treating this as a failure"
log "restored $RESTORED_TABLE_COUNT table(s) into \"$TARGET_DB\", confirmed queryable as $APP_ROLE"

if pg_role_has_createdb "$APP_ROLE"; then
  fail "SECURITY REGRESSION: role \"$APP_ROLE\" unexpectedly has CREATEDB — this script never grants it and must not proceed if something else did"
fi
if pg_role_is_superuser "$APP_ROLE"; then
  fail "SECURITY REGRESSION: role \"$APP_ROLE\" unexpectedly has SUPERUSER — this script never grants it and must not proceed if something else did"
fi
log "confirmed: $APP_ROLE is NOT CREATEDB and NOT SUPERUSER (unchanged, as intended)"

log "restore succeeded: $BACKUP_FILE -> database \"$TARGET_DB\" (owner: $APP_ROLE)"
if [ "$PRODUCTION_MODE" != "1" ]; then
  log "this was a SAFE, non-production restore. When done, drop it via the admin context — NOT as $APP_ROLE, which cannot: sudo -u postgres psql -d postgres -c 'DROP DATABASE \"$TARGET_DB\";'"
fi
