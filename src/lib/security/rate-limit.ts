import "server-only";
import { NextResponse } from "next/server";

/**
 * Minimal in-memory, fixed-window rate limiter — intentionally
 * process-local (Step 13C). This app runs as exactly one `next start`
 * process on a single VPS behind Nginx (see README's Deployment section);
 * there is no shared store (Redis etc.) by design for this MVP. Limits
 * reset on every process restart and are never shared across multiple
 * instances — acceptable for a single-VPS deployment, but NOT sufficient if
 * this app is ever horizontally scaled to more than one Node process.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Unique namespace so different endpoints never share counters even with the same identity. */
  scope: string;
  /** Identity to key on — typically a user id (authenticated routes) or client IP (guest routes). */
  identity: string;
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

/**
 * Fixed-window counter — simple and cheap, adequate for stopping obvious
 * abuse (brute force, spam). Not a precise sliding-window/token-bucket
 * limiter, and that precision isn't needed for this MVP's threat model.
 */
export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const key = `${options.scope}:${options.identity}`;
  const now = Date.now();

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { limited: false };
  }

  if (existing.count >= options.limit) {
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { limited: false };
}

/** Test-only: clears all counters so test files don't leak state into each other. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}

/**
 * Resolves the caller's IP for rate-limiting identity. Trusts ONLY
 * `X-Real-IP` — the Nginx template (deploy/nginx/school-library.conf)
 * sets this from `$remote_addr` (the actual TCP peer Nginx saw), which
 * overwrites whatever a client sends, so a public client cannot spoof it.
 * `X-Forwarded-For` is deliberately NOT trusted for identity purposes:
 * Nginx appends to it rather than replacing it, so a client can prepend
 * attacker-controlled entries ahead of the real one. Next.js itself binds
 * to 127.0.0.1 only in production (see README's Production section), so
 * every request reaching this process either came through Nginx (which
 * sets X-Real-IP correctly) or arrived over localhost directly (dev).
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local"; // No reverse proxy in front (e.g. `next dev`) — single shared bucket is fine outside production.
}

/** Consistent 429 response using the app's existing API envelope, plus a Retry-After header. */
export function tooManyRequestsResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { success: false, data: null, error: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
