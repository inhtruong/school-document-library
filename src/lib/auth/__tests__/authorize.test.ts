import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasRole, requireAuth, requireRole } from "@/lib/auth/authorize";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

function makeSession(role: Role): Session {
  return {
    user: { id: "user_1", name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

// `auth` from Auth.js is polymorphic (plain call vs. middleware signature); pin the
// overload we actually use (no-arg, resolving Session | null) for the mock's type.
const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasRole", () => {
  test("recognizes the STUDENT role", () => {
    expect(hasRole(makeSession("STUDENT"), "STUDENT")).toBe(true);
  });

  test("recognizes the TEACHER role", () => {
    expect(hasRole(makeSession("TEACHER"), "TEACHER")).toBe(true);
  });

  test("recognizes the ADMIN role", () => {
    expect(hasRole(makeSession("ADMIN"), "ADMIN")).toBe(true);
  });

  test("supports multi-role authorization such as [TEACHER, ADMIN]", () => {
    expect(hasRole(makeSession("TEACHER"), ["TEACHER", "ADMIN"])).toBe(true);
    expect(hasRole(makeSession("ADMIN"), ["TEACHER", "ADMIN"])).toBe(true);
    expect(hasRole(makeSession("STUDENT"), ["TEACHER", "ADMIN"])).toBe(false);
  });

  test("returns false for a guest (no session)", () => {
    expect(hasRole(null, "STUDENT")).toBe(false);
  });
});

describe("requireAuth", () => {
  test("returns the session for a signed-in user", async () => {
    mockAuth.mockResolvedValue(makeSession("STUDENT"));

    const session = await requireAuth();

    expect(session.user.id).toBe("user_1");
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects a guest to /login", async () => {
    mockAuth.mockResolvedValue(null);

    await requireAuth();

    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

describe("requireRole", () => {
  test("returns the session when the role matches", async () => {
    mockAuth.mockResolvedValue(makeSession("TEACHER"));

    const session = await requireRole("TEACHER");

    expect(session.user.role).toBe("TEACHER");
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects to / when the signed-in user's role does not match", async () => {
    mockAuth.mockResolvedValue(makeSession("STUDENT"));

    await requireRole("TEACHER");

    expect(redirect).toHaveBeenCalledWith("/");
  });

  test("accepts a multi-role array such as [TEACHER, ADMIN]", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN"));

    const session = await requireRole(["TEACHER", "ADMIN"]);

    expect(session.user.role).toBe("ADMIN");
    expect(redirect).not.toHaveBeenCalled();
  });
});
