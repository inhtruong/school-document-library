import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() }, auditLog: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { authenticateCredentials } from "@/lib/auth/authenticate";
import { hashPassword } from "@/lib/auth/password";

const createdAt = new Date("2025-01-01T00:00:00.000Z");
const updatedAt = new Date("2025-01-01T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
});

describe("authenticateCredentials", () => {
  test("authenticates a user with the correct email and password", async () => {
    const passwordHash = await hashPassword("student123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Sam Student",
      email: "student@example.com",
      passwordHash,
      role: "STUDENT",
      sessionVersion: 0,
      createdAt,
      updatedAt,
    });

    const result = await authenticateCredentials({
      email: "student@example.com",
      password: "student123",
    });

    expect(result).toEqual({
      id: "user_1",
      name: "Sam Student",
      email: "student@example.com",
      role: "STUDENT",
      sessionVersion: 0,
    });
  });

  test("reads sessionVersion from the DB user, not a fixed default", async () => {
    const passwordHash = await hashPassword("student123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Sam Student",
      email: "student@example.com",
      passwordHash,
      role: "STUDENT",
      sessionVersion: 7,
      createdAt,
      updatedAt,
    });

    const result = await authenticateCredentials({
      email: "student@example.com",
      password: "student123",
    });

    expect(result?.sessionVersion).toBe(7);
  });

  test("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("student123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Sam Student",
      email: "student@example.com",
      passwordHash,
      role: "STUDENT",
      sessionVersion: 0,
      createdAt,
      updatedAt,
    });

    const result = await authenticateCredentials({
      email: "student@example.com",
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });

  test("rejects an unknown email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await authenticateCredentials({
      email: "missing@example.com",
      password: "anything",
    });

    expect(result).toBeNull();
  });

  test("rejects malformed credentials without querying the database", async () => {
    const result = await authenticateCredentials({ email: "not-an-email", password: "" });

    expect(result).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("recognizes the TEACHER role on the authenticated user", async () => {
    const passwordHash = await hashPassword("teacher123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_2",
      name: "Tara Teacher",
      email: "teacher@example.com",
      passwordHash,
      role: "TEACHER",
      sessionVersion: 0,
      createdAt,
      updatedAt,
    });

    const result = await authenticateCredentials({
      email: "teacher@example.com",
      password: "teacher123",
    });

    expect(result?.role).toBe("TEACHER");
  });

  test("recognizes the ADMIN role on the authenticated user", async () => {
    const passwordHash = await hashPassword("admin123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_3",
      name: "Alex Admin",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
      sessionVersion: 0,
      createdAt,
      updatedAt,
    });

    const result = await authenticateCredentials({
      email: "admin@example.com",
      password: "admin123",
    });

    expect(result?.role).toBe("ADMIN");
  });
});

describe("authenticateCredentials — FEAT-11 audit log", () => {
  test("a successful login writes USER_LOGGED_IN with the real actor", async () => {
    const passwordHash = await hashPassword("student123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Sam Student",
      email: "student@example.com",
      passwordHash,
      role: "STUDENT",
      sessionVersion: 0,
      createdAt,
      updatedAt,
    });

    await authenticateCredentials({ email: "student@example.com", password: "student123" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_1",
        actorEmail: "student@example.com",
        actorRole: "STUDENT",
        action: "USER_LOGGED_IN",
        entityType: "USER",
        entityId: "user_1",
        status: "SUCCESS",
        metadata: undefined,
      },
    });
  });

  test("a wrong password writes USER_LOGIN_FAILED with no actor and no password in metadata", async () => {
    const passwordHash = await hashPassword("student123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Sam Student",
      email: "student@example.com",
      passwordHash,
      role: "STUDENT",
      sessionVersion: 0,
      createdAt,
      updatedAt,
    });

    await authenticateCredentials({ email: "student@example.com", password: "wrong-password" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: null,
        actorEmail: null,
        actorRole: null,
        action: "USER_LOGIN_FAILED",
        entityType: "USER",
        entityId: null,
        status: "FAILURE",
        metadata: { attemptedEmail: "student@example.com" },
      },
    });
    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain("wrong-password");
    expect(JSON.stringify(call)).not.toContain(passwordHash);
  });

  test("an unknown email also writes USER_LOGIN_FAILED", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await authenticateCredentials({ email: "missing@example.com", password: "anything" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "USER_LOGIN_FAILED", metadata: { attemptedEmail: "missing@example.com" } }),
      })
    );
  });

  test("a malformed submission (failed schema parse) is never audited — no real email to attribute it to", async () => {
    await authenticateCredentials({ email: "not-an-email", password: "" });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
