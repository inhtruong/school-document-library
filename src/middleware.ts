import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security/security-headers";
import { isMutatingMethod, isSameOriginRequest } from "@/lib/security/origin-check";

/**
 * Two small, centralized, per-request security checks (Step 13C):
 *
 * 1. CSP nonce — generated fresh per request and threaded through both the
 *    response header (`Content-Security-Policy`) and a request header
 *    (`x-nonce`) that Next.js's App Router reads automatically to nonce its
 *    own inline RSC-streaming bootstrap script. See security-headers.ts for
 *    the full CSP rationale.
 * 2. Same-origin check for mutating `/api/*` requests — see origin-check.ts
 *    for why this is needed (Server Actions already get this from Next.js
 *    itself; plain Route Handlers under /api/* don't).
 *
 * Deliberately does NOT do rate limiting here — that stays in individual
 * route handlers (see src/lib/security/rate-limit.ts) so each endpoint's
 * identity strategy (user id vs. IP) and threshold stay explicit and
 * independently testable, rather than encoding per-route policy into a
 * single global chokepoint.
 */
export function middleware(request: NextRequest): NextResponse {
  if (isMutatingMethod(request.method) && request.nextUrl.pathname.startsWith("/api/")) {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { success: false, data: null, error: "Cross-origin request rejected" },
        { status: 403 }
      );
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimization output — CSP/nonce/origin
    // checks are meaningless for them and this avoids needless work on
    // every asset request.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
