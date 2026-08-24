/**
 * Same-origin check for cookie-authenticated, state-changing `/api/*`
 * requests (Step 13C). Next.js Server Actions already validate Origin vs.
 * Host internally (framework behavior, since Next 14) — this covers the
 * gap: plain Route Handlers under `/api/*` get no such protection on their
 * own, and this app's session cookie is sent automatically by the browser
 * on any cross-site form/fetch, so a malicious third-party site could
 * otherwise trigger authenticated POST/PUT/PATCH/DELETE requests here.
 *
 * Deliberately NOT a token-based CSRF scheme — for a cookie-session app
 * with no cross-origin API consumers, comparing the browser-supplied
 * `Origin` header against the request's own `Host` is sufficient and adds
 * no state, no token plumbing, and no risk of breaking same-origin
 * fetches/Server Actions. Modern browsers attach `Origin` to every
 * same-origin AND cross-origin fetch/form submission for POST/PUT/PATCH/
 * DELETE, so a *present-but-mismatched* Origin reliably signals a
 * cross-site request. A *missing* Origin is allowed through rather than
 * rejected — some legitimate non-browser or older-browser requests omit it,
 * and blocking on absence would risk breaking things this task must not
 * redesign; the real protection here is catching an explicit mismatch.
 *
 * Host resolution deliberately uses only the request's own `Host` header —
 * never `X-Forwarded-Host` or any other client-suppliable forwarding
 * header — because Next.js binds to 127.0.0.1 in production (see README's
 * Production section) and the Nginx template forwards the original `Host`
 * unchanged (`proxy_set_header Host $host;`), so `Host` already reflects
 * the public domain by the time a request reaches this app. Trusting a
 * forwarding header here would let a direct request to the app (bypassing
 * Nginx) spoof its way past this check.
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // No Origin header present — see file header comment.

  const host = request.headers.get("host");
  if (!host) return false; // No Host to compare against — fail closed.

  try {
    return new URL(origin).host === host;
  } catch {
    return false; // Malformed Origin header — fail closed.
  }
}
