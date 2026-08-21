import { describe, expect, test } from "vitest";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { attachTokenToSession, attachUserToToken } from "@/lib/auth/session";

describe("attachUserToToken", () => {
  test("copies id and role onto the token on sign-in", () => {
    const token = {} as JWT;
    const user = { id: "user_1", role: "STUDENT" } as User;

    const result = attachUserToToken(token, user);

    expect(result.id).toBe("user_1");
    expect(result.role).toBe("STUDENT");
  });

  test("leaves an existing token's id/role untouched on subsequent requests (no user)", () => {
    const token = { id: "user_1", role: "STUDENT" } as JWT;

    const result = attachUserToToken(token, null);

    expect(result.id).toBe("user_1");
    expect(result.role).toBe("STUDENT");
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
});
