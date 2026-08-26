import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth/session-validation", () => ({
  getUserForSessionValidation: vi.fn(),
}));

import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { getUserForSessionValidation } from "@/lib/auth/session-validation";
import { attachTokenToSession, attachUserToToken } from "@/lib/auth/session";

const mockGetUser = vi.mocked(getUserForSessionValidation);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("attachUserToToken — sign-in (user present)", () => {
  test("copies id, role, and sessionVersion onto the token, without touching the DB", async () => {
    const token = {} as JWT;
    const user = { id: "user_1", role: "STUDENT", sessionVersion: 3 } as User;

    const result = await attachUserToToken(token, user);

    expect(result?.id).toBe("user_1");
    expect(result?.role).toBe("STUDENT");
    expect(result?.sessionVersion).toBe(3);
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});

describe("attachUserToToken — subsequent request (no user, DB validation)", () => {
  test("keeps a token valid when sessionVersion matches the DB", async () => {
    const token = { id: "user_1", role: "STUDENT", name: "Sam Student", sessionVersion: 2 } as JWT;
    mockGetUser.mockResolvedValue({ id: "user_1", name: "Sam Student", role: "STUDENT", sessionVersion: 2 });

    const result = await attachUserToToken(token, null);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user_1");
  });

  test("invalidates the token when sessionVersion no longer matches (password changed)", async () => {
    const token = { id: "user_1", role: "STUDENT", sessionVersion: 2 } as JWT;
    mockGetUser.mockResolvedValue({ id: "user_1", name: "Sam Student", role: "STUDENT", sessionVersion: 3 });

    const result = await attachUserToToken(token, null);

    expect(result).toBeNull();
  });

  test("invalidates the token when the user no longer exists", async () => {
    const token = { id: "deleted_user", role: "STUDENT", sessionVersion: 0 } as JWT;
    mockGetUser.mockResolvedValue(null);

    const result = await attachUserToToken(token, null);

    expect(result).toBeNull();
  });

  test("invalidates a malformed token with no id, without querying the DB", async () => {
    const token = {} as JWT;

    const result = await attachUserToToken(token, null);

    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  test("refreshes role from the DB row even when the token's own role is stale", async () => {
    const token = { id: "user_1", role: "STUDENT", sessionVersion: 1 } as JWT;
    mockGetUser.mockResolvedValue({ id: "user_1", name: "Sam Student", role: "TEACHER", sessionVersion: 1 });

    const result = await attachUserToToken(token, null);

    expect(result?.role).toBe("TEACHER");
  });

  test("refreshes name from the DB row even when the token's own name is stale", async () => {
    const token = { id: "user_1", role: "STUDENT", name: "Old Name", sessionVersion: 1 } as JWT;
    mockGetUser.mockResolvedValue({ id: "user_1", name: "New Name", role: "STUDENT", sessionVersion: 1 });

    const result = await attachUserToToken(token, null);

    expect(result?.name).toBe("New Name");
  });
});

describe("attachTokenToSession", () => {
  test("exposes user id and role on the session", () => {
    const session = { user: {}, expires: "2099-01-01T00:00:00.000Z" } as unknown as Session;
    const token = { id: "user_1", role: "TEACHER" } as JWT;

    const result = attachTokenToSession(session, token);

    expect(result.user.id).toBe("user_1");
    expect(result.user.role).toBe("TEACHER");
  });

  test("supports the ADMIN role", () => {
    const session = { user: {}, expires: "2099-01-01T00:00:00.000Z" } as unknown as Session;
    const token = { id: "user_2", role: "ADMIN" } as JWT;

    const result = attachTokenToSession(session, token);

    expect(result.user.role).toBe("ADMIN");
  });

  test("never exposes sessionVersion on the session", () => {
    const session = { user: {}, expires: "2099-01-01T00:00:00.000Z" } as unknown as Session;
    const token = { id: "user_1", role: "STUDENT", sessionVersion: 5 } as JWT;

    const result = attachTokenToSession(session, token);

    expect(JSON.stringify(result.user)).not.toContain("sessionVersion");
  });
});
