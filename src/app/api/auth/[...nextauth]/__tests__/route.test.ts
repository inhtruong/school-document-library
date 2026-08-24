import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({
  handlers: { GET: vi.fn(), POST: vi.fn(async () => new Response("ok", { status: 200 })) },
}));

import { handlers } from "@/auth";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { POST } from "@/app/api/auth/[...nextauth]/route";

const mockAuthPost = vi.mocked(handlers.POST);

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
});

describe("POST /api/auth/[...nextauth] — login rate limiting", () => {
  test("delegates to Auth.js for a non-credentials NextAuth path", async () => {
    const request = new NextRequest("http://localhost/api/auth/session", { method: "POST" });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
  });

  test("delegates to Auth.js for the first several credentials sign-in attempts", async () => {
    for (let i = 0; i < 10; i++) {
      const request = new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.5" },
      });
      const response = await POST(request);
      expect(response.status).toBe(200);
    }
    expect(mockAuthPost).toHaveBeenCalledTimes(10);
  });

  test("returns 429 with Retry-After once the login rate limit is exceeded for one IP", async () => {
    const makeRequest = () =>
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.9" },
      });

    for (let i = 0; i < 10; i++) {
      await POST(makeRequest());
    }
    const blocked = await POST(makeRequest());
    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(body.success).toBe(false);
    expect(mockAuthPost).toHaveBeenCalledTimes(10); // the 11th call never reached Auth.js
  });

  test("tracks login attempts per IP independently", async () => {
    const requestFrom = (ip: string) =>
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { "x-real-ip": ip },
      });

    for (let i = 0; i < 10; i++) await POST(requestFrom("203.0.113.10"));
    const stillAllowed = await POST(requestFrom("203.0.113.11"));

    expect(stillAllowed.status).toBe(200);
  });
});
