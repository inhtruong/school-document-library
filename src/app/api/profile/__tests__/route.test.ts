import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/profile/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/profile", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.update).mockResolvedValue({ id: "user_1", name: "Updated Name" } as never);
});

describe("PATCH /api/profile — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "New Name" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can update their own name", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const response = await PATCH(patchRequest({ name: "Updated Name" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Updated Name");
  });
});

describe("PATCH /api/profile — ownership", () => {
  test("always updates the session's own user id, ignoring any id in the body", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await PATCH(patchRequest({ name: "Updated Name", id: "attacker-controlled-id" }));

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" } })
    );
  });
});

describe("PATCH /api/profile — validation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
  });

  test("rejects an empty name", async () => {
    const response = await PATCH(patchRequest({ name: "" }));
    expect(response.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await PATCH(patchRequest("{not valid json"));
    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/profile — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await PATCH(patchRequest({ name: "Updated Name" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
