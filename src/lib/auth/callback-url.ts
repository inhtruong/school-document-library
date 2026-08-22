/**
 * Accepts only an internal, single-path callback URL (e.g. "/documents/abc123")
 * for post-login redirects. Rejects anything that could send the user
 * off-site: absolute URLs, protocol-relative URLs ("//evil.example.com"),
 * backslash tricks, and non-URL schemes like "javascript:".
 *
 * Resolving the value against a fixed dummy origin and checking that the
 * parsed origin didn't change is the actual security check — the leading
 * "/" requirement is just an early, cheap rejection plus a guarantee that
 * accepted values are always root-relative paths.
 */
export function isSafeCallbackUrl(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/")) return false;

  const DUMMY_ORIGIN = "http://internal.invalid";
  try {
    return new URL(value, DUMMY_ORIGIN).origin === DUMMY_ORIGIN;
  } catch {
    return false;
  }
}

/** Returns `value` if it's a safe internal callback URL, otherwise `fallback`. */
export function resolveCallbackUrl(value: string | null | undefined, fallback: string): string {
  return isSafeCallbackUrl(value) ? value : fallback;
}
