import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { LOGIN_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/security/rate-limit";

export const { GET } = handlers;

/**
 * Auth.js's Credentials `authorize()` callback has no clean way to return a
 * distinct HTTP status (NextAuth's own handler always decides the response
 * shape) — so the rate limit for login attempts is applied here instead,
 * one layer up, only for the actual sign-in POST
 * (`/api/auth/callback/credentials`). Every other NextAuth POST path
 * (session refresh, CSRF token fetch, sign-out, etc.) passes through
 * untouched — this deliberately does not wrap or alter Auth.js itself.
 */
export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("/callback/credentials")) {
    const rateLimit = checkRateLimit({
      scope: "login",
      identity: getClientIp(request),
      ...LOGIN_RATE_LIMIT,
    });
    if (rateLimit.limited) return tooManyRequestsResponse(rateLimit.retryAfterSeconds);
  }

  return handlers.POST(request);
}
