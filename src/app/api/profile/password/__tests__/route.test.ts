import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { PASSWORD_CHANGE_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { POST } from "@/app/api/profile/password/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const OLD_PASSWORD = "old-correct-password";
const NEW_PASSWORD = "new-correct-password";

function sessionFor(userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role: "STUDENT" },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/profile/password", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: await hashPassword(OLD_PASSWORD) } as never);
  vi.mocked(prisma.user.update).mockResolvedValue({} as never);
});

describe("POST /api/profile/password — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(
      postRequest({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/password — happy path and ownership", () => {
  test("changes the caller's own password with the correct current password", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));

    const response = await POST(
      postRequest({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
    );

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" } })
    );
  });

  test("cannot target another user's password even if the body claims a different userId", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));

    await POST(
      postRequest({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
        userId: "victim-user",
      })
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" } })
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" } })
    );
  });
});

describe("POST /api/profile/password — validation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor());
  });

  test("rejects an incorrect current password with 401", async () => {
    const response = await POST(
      postRequest({ currentPassword: "wrong", newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
    );

    expect(response.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects a new password shorter than the registration minimum", async () => {
    const response = await POST(
      postRequest({ currentPassword: OLD_PASSWORD, newPassword: "short", confirmPassword: "short" })
    );

    expect(response.status).toBe(400);
  });

  test("rejects a mismatched confirmation", async () => {
    const response = await POST(
      postRequest({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: "different" })
    );

    expect(response.status).toBe(400);
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await POST(postRequest("{not valid json"));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/profile/password — rate limiting", () => {
  test("returns 429 with a Retry-After header once the per-user threshold is exceeded", async () => {
    mockAuth.mockResolvedValue(sessionFor("rate-limited-user"));

    for (let i = 0; i < PASSWORD_CHANGE_RATE_LIMIT.limit; i++) {
      const response = await POST(postRequest({ currentPassword: "wrong", newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }));
      expect(response.status).not.toBe(429);
    }

    const limitedResponse = await POST(
      postRequest({ currentPassword: "wrong", newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
    );

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get("Retry-After")).toBeTruthy();
  });

  test("does not share the rate-limit bucket across different users", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_a"));
    for (let i = 0; i < PASSWORD_CHANGE_RATE_LIMIT.limit; i++) {
      await POST(postRequest({ currentPassword: "wrong", newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }));
    }

    mockAuth.mockResolvedValue(sessionFor("user_b"));
    const response = await POST(
      postRequest({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
    );

    expect(response.status).toBe(200);
  });
});

describe("POST /api/profile/password — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor());
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await POST(
      postRequest({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
