/**
 * The `/login?callbackUrl=...` href that returns a guest to `path` after
 * signing in. `isSafeCallbackUrl()`/`resolveCallbackUrl()`
 * (`src/lib/auth/callback-url.ts`) still do the one and only validation of
 * that value, on the receiving (login) side — this just builds the string
 * the same way everywhere it's needed.
 */
export function loginHrefFor(path: string): string {
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

/**
 * The `/login?callbackUrl=...` href that returns a guest to a specific
 * Document Detail page after signing in — shared by any guest-facing
 * document action that needs auth (download, rating, comments, reports,
 * bookmark).
 */
export function documentLoginHref(documentId: string): string {
  return loginHrefFor(`/documents/${documentId}`);
}
