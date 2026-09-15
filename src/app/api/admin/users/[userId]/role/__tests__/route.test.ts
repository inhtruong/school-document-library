import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/admin/users", () => ({ updateUserRole: vi.fn() }));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { updateUserRole } from "@/lib/admin/users";
import { PATCH } from "@/app/api/admin/users/[userId]/role/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockUpdateUserRole = vi.mocked(updateUserRole);
const context = { params: Promise.resolve({ userId: "user_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "admin_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users/user_1/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/users/:userId/role — authorization", () => {
  test("a guest gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);

    expect(response.status).toBe(401);
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });

  test("a STUDENT gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);

    expect(response.status).toBe(403);
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });

  test("a TEACHER gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/admin/users/:userId/role — self-role-change", () => {
  test("an ADMIN changing their own role gets 403, without touching the database", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "user_1"));

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("USER_SELF_ROLE_CHANGE_FORBIDDEN");
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/users/:userId/role — outcomes", () => {
  test("an ADMIN successfully changes another user's role", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const user = { id: "user_1", name: "Sam", email: "sam@example.com", role: "TEACHER", createdAt: new Date() };
    mockUpdateUserRole.mockResolvedValue({ outcome: "success", user } as never);

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.role).toBe("TEACHER");
  });

  test("returns 404 when the target user does not exist", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateUserRole.mockResolvedValue({ outcome: "not-found" } as never);

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);

    expect(response.status).toBe(404);
  });

  test("returns 409 when demoting the last admin", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateUserRole.mockResolvedValue({ outcome: "last-admin" } as never);

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("LAST_ADMIN_ROLE_CHANGE_FORBIDDEN");
  });

  test("returns 409 on a concurrent-write conflict", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateUserRole.mockResolvedValue({ outcome: "conflict" } as never);

    const response = await PATCH(patchRequest({ role: "TEACHER" }), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("USER_ROLE_CHANGE_CONFLICT");
  });

  test("returns 400 for an invalid role", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));

    const response = await PATCH(patchRequest({ role: "SUPERADMIN" }), context);

    expect(response.status).toBe(400);
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });

  test("returns 400 for a malformed JSON body", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const request = new NextRequest("http://localhost/api/admin/users/user_1/role", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    const response = await PATCH(request, context);

    expect(response.status).toBe(400);
  });
});
