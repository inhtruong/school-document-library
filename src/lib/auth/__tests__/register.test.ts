import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { registerStudent } from "@/lib/auth/register";

const createdAt = new Date("2025-01-01T00:00:00.000Z");
const updatedAt = new Date("2025-01-01T00:00:00.000Z");

const mockCreatedUser = {
  id: "user_1",
  name: "New Student",
  email: "newstudent@example.com",
  role: "STUDENT" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.create).mockResolvedValue(mockCreatedUser as never);
});

describe("registerStudent", () => {
  test("creates a user with role STUDENT", async () => {
    const result = await registerStudent({
      name: "New Student",
      email: "newstudent@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.user.role).toBe("STUDENT");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "STUDENT" }) })
    );
  });

  test("ignores a client-supplied TEACHER role and still creates a STUDENT", async () => {
    await registerStudent({
      name: "Sneaky",
      email: "sneaky-teacher@example.com",
      password: "password123",
      role: "TEACHER",
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "STUDENT" }) })
    );
  });

  test("ignores a client-supplied ADMIN role and still creates a STUDENT", async () => {
    await registerStudent({
      name: "Sneaky Admin",
      email: "sneaky-admin@example.com",
      password: "password123",
      role: "ADMIN",
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "STUDENT" }) })
    );
  });

  test("hashes the password before storing it", async () => {
    await registerStudent({
      name: "New Student",
      email: "newstudent@example.com",
      password: "password123",
    });

    const call = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: { passwordHash: string } };
    expect(call.data.passwordHash).not.toBe("password123");
    expect(typeof call.data.passwordHash).toBe("string");
  });

  test("rejects a duplicate email without creating a user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "existing",
      name: "Existing",
      email: "existing@example.com",
      passwordHash: "hash",
      role: "STUDENT",
      createdAt,
      updatedAt,
    });

    const result = await registerStudent({
      name: "Duplicate",
      email: "existing@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test("rejects invalid input without touching the database", async () => {
    const result = await registerStudent({ name: "", email: "not-an-email", password: "short" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
