/**
 * The `/login?callbackUrl=...` href that returns a guest to a specific
 * Document Detail page after signing in — shared by any guest-facing
 * document action that needs auth (download, rating, ...) so the callback
 * URL is built the same way everywhere. `isSafeCallbackUrl()`/
 * `resolveCallbackUrl()` (`src/lib/auth/callback-url.ts`) still do the one
 * and only validation of that value, on the receiving (login) side.
 */
export function documentLoginHref(documentId: string): string {
  return `/login?callbackUrl=${encodeURIComponent(`/documents/${documentId}`)}`;
}
