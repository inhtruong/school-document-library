/**
 * The unguarded core of environment configuration — no `"server-only"`
 * import. `next.config.ts` and the CLI scripts under `prisma/` (run via
 * `tsx`) both need this logic, and neither loading context is compatible
 * with the `server-only` package (confirmed via real `next build`/`tsx`
 * failures — it throws "cannot be imported from a Client Component module"
 * even though nothing here ever runs in a browser).
 *
 * Real Next.js app code (Server Components, API routes, other server-only
 * lib modules) should import from `@/lib/env` instead — a thin
 * `"server-only"`-guarded re-export of this file — so an accidental import
 * from a Client Component still fails loudly at build time. This file is
 * only meant to be reached directly by next.config.ts/prisma/*.ts, which
 * import it by relative path specifically to bypass that guard.
 *
 * No function here returns a value that's secret by itself: `getStorageRoot()`
 * returns a filesystem path (infrastructure detail, not a credential), and
 * nothing exports DATABASE_URL/AUTH_SECRET at all — `validateProductionEnv()`
 * only ever checks *whether* they're set, never returns or logs their value.
 */
import path from "node:path";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Absolute path to the persistent upload storage root. `null` means "use
 * the caller's own dev-friendly default" (see local-storage.ts, which falls
 * back to `./storage_local`). Required in production — see
 * `validateProductionEnv()` — so a deploy can never silently store uploads
 * inside the release directory.
 */
export function getStorageRoot(): string | null {
  const value = process.env.STORAGE_ROOT?.trim();
  return value ? value : null;
}

type ParsedUploadSize = { mb: number; error: string | null };

/**
 * Single source of truth for parsing `MAX_UPLOAD_SIZE_MB`, shared by the
 * always-safe getter below and `validateProductionEnv()` — so "unset" and
 * "set but invalid" are never confused. Unset (or blank) is a normal,
 * intentional default of 10 MB, never an error. Set-but-invalid (zero,
 * negative, non-numeric) is always an error, surfaced by
 * `validateProductionEnv()` in production rather than silently discarded.
 */
function parseMaxUploadSizeMB(raw: string | undefined): ParsedUploadSize {
  const trimmed = raw?.trim();
  if (!trimmed) return { mb: 10, error: null };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { mb: 10, error: `MAX_UPLOAD_SIZE_MB must be a positive number (got "${trimmed}")` };
  }
  return { mb: parsed, error: null };
}

/**
 * Upload size ceiling in MB. Defaults to 10 when unset; also falls back to
 * 10 for an invalid value so the app can still start in development — a
 * production start instead hard-fails on an invalid value via
 * `validateProductionEnv()`, which shares this same parsing function.
 */
export function getMaxUploadSizeMB(): number {
  return parseMaxUploadSizeMB(process.env.MAX_UPLOAD_SIZE_MB).mb;
}

type ParsedAppUrl = { url: string | null; error: string | null };

/** Single source of truth for parsing `APP_URL` — shared by the getter and `validateProductionEnv()`, same "unset is fine, set-but-invalid is an error" split as upload size above. */
function parseAppUrl(raw: string | undefined): ParsedAppUrl {
  const trimmed = raw?.trim();
  if (!trimmed) return { url: null, error: null };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { url: null, error: `APP_URL must be a valid absolute URL (got "${trimmed}")` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url: null, error: `APP_URL must use http:// or https:// (got "${trimmed}")` };
  }

  return { url: trimmed, error: null };
}

/**
 * The app's public base URL (e.g. `https://library.example.com`). Not
 * currently read by any request path in the app — the self-fetch pattern
 * that used to need it was removed for performance (see the api-client.ts
 * deletion). Kept as centralized, documented, *optional* config for ops
 * (what Nginx's `server_name`/proxy target should match) and any future
 * absolute-URL need, rather than required just because it was proposed —
 * see `validateProductionEnv()`, which never requires it but does validate
 * its format when set.
 */
export function getAppUrl(): string | null {
  return parseAppUrl(process.env.APP_URL).url;
}

/** `prisma/seed.ts` refuses to run when this is true — see that file. */
export function isProductionSeedBlocked(): boolean {
  return isProduction();
}

/**
 * Fail-fast check for required production configuration. Called once from
 * `next.config.ts`, which Next.js loads before anything else for both
 * `next build` and `next dev`/`next start` — so a missing/misconfigured
 * production environment surfaces immediately with one clear combined
 * error, instead of as a cryptic downstream error the first time some
 * unrelated request path happens to touch the missing value. A no-op
 * outside production; dev/test are never affected. Never includes the
 * actual value of any variable — only names and, for STORAGE_ROOT/
 * MAX_UPLOAD_SIZE_MB/APP_URL, the specific reason a *set* value is invalid.
 */
export function validateProductionEnv(): void {
  if (!isProduction()) return;

  const issues: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) issues.push("DATABASE_URL is required");
  if (!process.env.AUTH_SECRET?.trim()) issues.push("AUTH_SECRET is required");
  if (!process.env.AUTH_TRUST_HOST?.trim()) {
    issues.push('AUTH_TRUST_HOST is required (set to "true") when running behind Nginx/a custom host');
  }

  const storageRoot = getStorageRoot();
  if (!storageRoot) {
    issues.push(
      "STORAGE_ROOT is required — set it to an absolute path outside the release directory " +
        "(e.g. /var/lib/school-library/storage)"
    );
  } else if (!path.isAbsolute(storageRoot)) {
    issues.push(`STORAGE_ROOT must be an absolute path (got "${storageRoot}")`);
  }

  const uploadSize = parseMaxUploadSizeMB(process.env.MAX_UPLOAD_SIZE_MB);
  if (uploadSize.error) issues.push(uploadSize.error);

  const appUrl = parseAppUrl(process.env.APP_URL);
  if (appUrl.error) issues.push(appUrl.error);

  if (issues.length > 0) {
    throw new Error(
      `Invalid production environment configuration:\n${issues.map((issue) => `  - ${issue}`).join("\n")}\n\nSee .env.example.`
    );
  }
}
