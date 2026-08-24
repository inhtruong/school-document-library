#!/usr/bin/env bash
#
# common.sh — shared helpers for the Step 13D backup/restore scripts.
#
# Repository artifact only — not executed against any server by this task.
# Meant to be `source`d (not executed directly) by backup-db.sh,
# backup-storage.sh, backup-all.sh, restore-db.sh, restore-storage.sh, and
# verify-backup.sh, so the same logging/locking/checksum/env-loading/
# disk-space/path-safety behavior is never copy-pasted and drifting between
# scripts (mirrors deploy.sh's own log()/fail() style from Step 13B).
#
# Every caller is expected to already have `set -euo pipefail` active
# (each top-level script sets it before sourcing this file); this file sets
# it too, defensively, in case it's ever sourced somewhere that didn't.
set -euo pipefail

# stderr, not stdout — several scripts print a single machine-readable
# result path on stdout as their last line (e.g. the final backup file's
# absolute path) so backup-all.sh can capture it via command substitution
# without log lines mixed in.
log() { printf '[backup] %s\n' "$*" >&2; }
fail() { printf '[backup] ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Command availability
# ---------------------------------------------------------------------------
require_commands() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || fail "required command not found: $cmd"
  done
}

# ---------------------------------------------------------------------------
# Production env loading — same file, same pattern as deploy.sh (Step 13B).
# Never prints the file's contents and never runs under `set -x`, so
# DATABASE_URL/AUTH_SECRET are never echoed to a log.
# ---------------------------------------------------------------------------
load_env_file() {
  local env_file="$1"
  [ -f "$env_file" ] || fail "env file not found: $env_file"
  [ -r "$env_file" ] || fail "env file not readable by this user: $env_file"
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

# ---------------------------------------------------------------------------
# Checksums — prefer GNU `sha256sum` (standard on the real Ubuntu target);
# fall back to `shasum -a 256` for local dev on macOS, which doesn't ship
# sha256sum by default. Output format matches `sha256sum` either way
# ("<hash>  <filename>"), so `.sha256` sidecar files are always verifiable
# with `sha256sum -c` on the real target regardless of which tool wrote them.
# ---------------------------------------------------------------------------
sha256_of_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file"
  else
    fail "neither sha256sum nor shasum is available — cannot checksum $file"
  fi
}

verify_sha256_file() {
  local checksum_file="$1"
  local dir
  dir="$(dirname "$checksum_file")"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$dir" && sha256sum -c "$(basename "$checksum_file")" >/dev/null)
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$dir" && shasum -a 256 -c "$(basename "$checksum_file")" >/dev/null)
  else
    fail "neither sha256sum nor shasum is available — cannot verify $checksum_file"
  fi
}

# ---------------------------------------------------------------------------
# Canonical path helpers — used before any destructive/deletion operation so
# a symlinked ancestor directory (e.g. macOS's /tmp -> /private/tmp) never
# causes a raw string comparison to silently miss a match. Same reasoning as
# deploy.sh's release-retention step (Step 13B), which found this exact bug
# via live testing.
# ---------------------------------------------------------------------------
canonical_path() {
  readlink -f "$1"
}

# True only if $1 (canonicalized) is inside $2 (canonicalized) — used to
# refuse to delete/overwrite anything outside an expected root.
path_is_within() {
  local target root
  target="$(canonical_path "$1")"
  root="$(canonical_path "$2")"
  [ "$target" = "$root" ] && return 1 # never "within" itself for deletion purposes
  case "$target" in
    "$root"/*) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Disk space safety — not a precise prediction, just a reasonable guard
# against silently filling the disk. `df -P -k` is POSIX-portable output
# (works identically on the real Ubuntu target and on macOS for local
# testing), reported in 1024-byte blocks.
# ---------------------------------------------------------------------------
check_free_space_mb() {
  local path="$1" min_free_mb="$2" available_kb
  mkdir -p "$path"
  available_kb="$(df -Pk "$path" | awk 'NR==2 {print $4}')"
  local available_mb=$((available_kb / 1024))
  if [ "$available_mb" -lt "$min_free_mb" ]; then
    fail "insufficient free space at $path: ${available_mb}MB available, ${min_free_mb}MB required"
  fi
  log "free space check OK at $path: ${available_mb}MB available"
}

# ---------------------------------------------------------------------------
# Lock — a plain `mkdir` is atomic on every POSIX filesystem, so this works
# identically on the real Ubuntu target and for local testing, without
# depending on `flock` (not installed by default on macOS, where this
# tooling is also exercised in local dry-run testing — see the Step 13D
# final report's local verification section).
# Sets a trap to release the lock on exit; callers should acquire the lock
# AFTER their own more specific traps are registered, or chain cleanup
# themselves, since a second `trap ... EXIT` overwrites the first.
# ---------------------------------------------------------------------------
LOCK_DIR_ACQUIRED=""

acquire_lock() {
  local lock_dir="$1"
  mkdir -p "$(dirname "$lock_dir")"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    fail "another backup/restore appears to be running (lock held: $lock_dir) — skipping to avoid conflicting artifacts"
  fi
  LOCK_DIR_ACQUIRED="$lock_dir"
  trap release_lock EXIT
}

release_lock() {
  if [ -n "$LOCK_DIR_ACQUIRED" ]; then
    rmdir "$LOCK_DIR_ACQUIRED" 2>/dev/null || true
    LOCK_DIR_ACQUIRED=""
  fi
}

# ---------------------------------------------------------------------------
# Timestamp — UTC, sortable, matches deploy.sh's RELEASE_ID convention
# (lexical sort == chronological sort).
# ---------------------------------------------------------------------------
utc_timestamp() {
  date -u +%Y%m%dT%H%M%SZ
}

# ---------------------------------------------------------------------------
# Derives a libpq connection URI that points at a DIFFERENT database name
# than the one in $1, keeping the same host/port/user/password/query
# string. Used by restore-db.sh to connect to the "postgres" maintenance
# database (to CREATE/DROP a target database) and to the restore target
# database itself, without ever manually regexing DATABASE_URL apart in
# bash — genuinely error-prone for a URI that can contain '@'/':'/special
# characters in its password (see Step 13D's env-loading notes). Uses
# Node's URL parser (Node is already a hard dependency of this whole
# project) instead. Prints only the derived URL on stdout — the caller is
# responsible for never logging it.
# ---------------------------------------------------------------------------
build_db_url_with_dbname() {
  local base_url="$1" new_dbname="$2"
  node -e '
    const u = new URL(process.argv[1]);
    u.pathname = "/" + process.argv[2];
    process.stdout.write(u.toString());
  ' "$base_url" "$new_dbname"
}

# Extracts just the database name (path component) from a libpq URI —
# same reasoning as build_db_url_with_dbname above: parsed via Node's URL
# class rather than bash string manipulation.
db_name_from_url() {
  local url="$1"
  node -e '
    const u = new URL(process.argv[1]);
    process.stdout.write(u.pathname.replace(/^\//, ""));
  ' "$url"
}

# ---------------------------------------------------------------------------
# Path-traversal protection for restoring an UNTRUSTED tar archive — a
# backup artifact is data at rest, and from a restore perspective it must
# be treated the same as any other untrusted input before extraction.
# Rejects: absolute-path entries, and any entry with a literal ".." path
# SEGMENT (not a substring match — a filename that merely CONTAINS ".."
# like "notes..final.pdf" is legitimate and must not be rejected).
# ---------------------------------------------------------------------------
reject_unsafe_archive_entries() {
  local archive="$1" entry segment
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    case "$entry" in
      /*) fail "archive contains an absolute-path entry (rejected before extraction): $entry" ;;
    esac
    local IFS='/'
    # shellcheck disable=SC2086
    for segment in $entry; do
      if [ "$segment" = ".." ]; then
        fail "archive contains a path-traversal entry (rejected before extraction): $entry"
      fi
    done
  done < <(tar -tzf "$archive")
}

# Strict allowlist for a PostgreSQL identifier used directly in DDL (where
# it cannot be parameterized like a value can) — rejects anything that
# isn't a plain, short, ASCII identifier, closing off SQL-injection-via-
# identifier before it ever reaches psql.
validate_db_identifier() {
  local name="$1"
  case "$name" in
    "") fail "database name is empty" ;;
  esac
  if ! [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
    fail "refusing to use \"$name\" as a database identifier — must match ^[A-Za-z_][A-Za-z0-9_]{0,62}\$"
  fi
}
