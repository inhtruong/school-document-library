import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  resetRateLimitsForTests,
  tooManyRequestsResponse,
} from "@/lib/security/rate-limit";

beforeEach(() => {
  resetRateLimitsForTests();
});

describe("checkRateLimit", () => {
  test("allows requests up to the limit within the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit({ scope: "test", identity: "a", limit: 3, windowMs: 1000 })).toEqual({
        limited: false,
      });
    }
  });

  test("blocks the request that exceeds the limit", () => {
    for (let i = 0; i < 3; i++) checkRateLimit({ scope: "test", identity: "a", limit: 3, windowMs: 1000 });

    const result = checkRateLimit({ scope: "test", identity: "a", limit: 3, windowMs: 1000 });

    expect(result.limited).toBe(true);
    if (result.limited) expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("tracks different identities independently", () => {
    for (let i = 0; i < 3; i++) checkRateLimit({ scope: "test", identity: "a", limit: 3, windowMs: 1000 });

    const result = checkRateLimit({ scope: "test", identity: "b", limit: 3, windowMs: 1000 });

    expect(result.limited).toBe(false);
  });

  test("tracks different scopes independently even with the same identity", () => {
    for (let i = 0; i < 3; i++) checkRateLimit({ scope: "scope-a", identity: "a", limit: 3, windowMs: 1000 });

    const result = checkRateLimit({ scope: "scope-b", identity: "a", limit: 3, windowMs: 1000 });

    expect(result.limited).toBe(false);
  });

  test("resets the window after it expires", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 3; i++) checkRateLimit({ scope: "test", identity: "a", limit: 3, windowMs: 1000 });
      expect(checkRateLimit({ scope: "test", identity: "a", limit: 3, windowMs: 1000 }).limited).toBe(true);

      vi.advanceTimersByTime(1001);

      expect(checkRateLimit({ scope: "test", identity: "a", limit: 3, windowMs: 1000 }).limited).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("getClientIp", () => {
  test("trusts X-Real-IP when present", () => {
    const request = new Request("http://localhost/", { headers: { "x-real-ip": "203.0.113.7" } });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  test("never falls back to X-Forwarded-For — a client-supplied value must not become the identity", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.7" },
    });
    expect(getClientIp(request)).toBe("local");
  });

  test("falls back to a fixed sentinel when no proxy header is present", () => {
    const request = new Request("http://localhost/");
    expect(getClientIp(request)).toBe("local");
  });
});

describe("tooManyRequestsResponse", () => {
  test("returns 429 with a Retry-After header and the standard error envelope", async () => {
    const response = tooManyRequestsResponse(42);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(body).toEqual({ success: false, data: null, error: expect.any(String) });
  });
});
