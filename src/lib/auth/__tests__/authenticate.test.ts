import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { authenticateCredentials } from "@/lib/auth/authenticate";
import { hashPassword } from "@/lib/auth/password";

const createdAt = new Date("2025-01-01T00:00:00.000Z");
const updatedAt = new Date("2025-01-01T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
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
    });
  });

  test("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("student123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Sam Student",
      email: "student@example.com",
      passwordHash,
      role: "STUDENT",
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
