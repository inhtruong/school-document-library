/**
 * Centralized production security headers (Step 13C). Split in two pieces:
 *
 * - `STATIC_SECURITY_HEADERS` — fixed values, applied globally via
 *   `next.config.ts`'s `headers()` (framework-level, no per-request work).
 * - `buildContentSecurityPolicy(nonce)` — CSP needs a fresh per-request
 *   nonce for script-src, so it's built in `middleware.ts` instead, which
 *   is the only place a nonce can be generated per-request and threaded
 *   through to Next.js's own inline bootstrap script.
 *
 * CSP directive choices, and why each was needed (verified against a real
 * `next build && next start` run, not assumed):
 * - `script-src 'self' 'nonce-<value>' 'strict-dynamic'` — no
 *   `'unsafe-inline'`. Next.js's App Router emits an inline
 *   `<script>self.__next_f.push(...)</script>` per page for RSC streaming;
 *   `strict-dynamic` + the nonce lets that (and anything it loads) run
 *   without falling back to a broad `'unsafe-inline'`.
 * - `style-src 'self' 'unsafe-inline'` — `docx-preview` (DOCX preview)
 *   maps OOXML formatting onto generated DOM nodes via the `style`
 *   attribute directly, which CSP only permits under `'unsafe-inline'`
 *   (nonces/hashes only cover `<style>` elements, never inline `style="…"`
 *   attributes). This is a deliberate, narrow compromise: CSS injection
 *   cannot execute script on its own, and `script-src` above stays strict.
 * - `img-src 'self' data: blob:` — `data:`/`blob:` cover images
 *   `docx-preview` extracts and re-embeds from a rendered .docx.
 * - `media-src 'self'` — the `<video>` preview streams from this app's own
 *   `/api/documents/[id]/preview`, nothing external.
 * - `font-src 'self'` — `next/font/google` self-hosts font files at build
 *   time (no runtime request to Google), so no external font host is
 *   needed at all.
 * - `connect-src 'self'` — DOCX preview `fetch()`s its own preview URL;
 *   Auth.js/Server Actions/API calls are all same-origin.
 * - `frame-src 'self'` — the PDF preview embeds `/api/documents/[id]/preview`
 *   in an `<iframe>`; this is "this app embedding its own file response",
 *   a different concern from `frame-ancestors` below (this app being
 *   embedded by someone else).
 * - `frame-ancestors 'self'` — clickjacking protection; paired with
 *   `X-Frame-Options: SAMEORIGIN` in the static headers for older-browser
 *   compatibility. The app has no need to be embedded in third-party sites.
 * - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` — no
 *   plugins/objects are used; both narrow known injection vectors without
 *   touching anything the app actually uses.
 *
 * Deliberately NOT included: a blanket `*` anywhere, and `default-src
 * 'none'` (would require enumerating every directive above just to make the
 * app function at all, with no safety benefit over the explicit list here).
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `media-src 'self'`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `frame-src 'self'`,
    `frame-ancestors 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];
  return directives.join("; ");
}

/** Applied to every route via next.config.ts's headers(). No per-request state needed. */
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Paired with CSP frame-ancestors above for older-browser compatibility.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Locks down browser features this app never uses; extend only if a real feature needs one.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];
