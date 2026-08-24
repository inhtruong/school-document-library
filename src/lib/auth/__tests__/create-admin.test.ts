import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { createAdminUser } from "@/lib/auth/create-admin";

const VALID_INPUT = { name: "Ops Admin", email: "ops-admin@example.com", password: "a-strong-password" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.create).mockResolvedValue({
    id: "user_1",
    name: VALID_INPUT.name,
    email: VALID_INPUT.email,
  } as never);
});

describe("createAdminUser — success", () => {
  test("creates the user with role ADMIN", async () => {
    const result = await createAdminUser(VALID_INPUT);

    expect(result).toEqual({
      success: true,
      user: { id: "user_1", name: VALID_INPUT.name, email: VALID_INPUT.email },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) })
    );
  });

  test("stores a bcrypt hash, never the plaintext password", async () => {
    await createAdminUser(VALID_INPUT);

    const call = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: { passwordHash: string } };
    expect(call.data.passwordHash).not.toBe(VALID_INPUT.password);
    expect(call.data.passwordHash.startsWith("$2")).toBe(true);
  });

  test("normalizes the email (trim + lowercase), matching registerSchema", async () => {
    await createAdminUser({ ...VALID_INPUT, email: "  OPS-Admin@Example.com  " });

    const call = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: { email: string } };
    expect(call.data.email).toBe("ops-admin@example.com");
  });
});

describe("createAdminUser — validation", () => {
  test("rejects a password shorter than 8 characters and never touches the database", async () => {
    const result = await createAdminUser({ ...VALID_INPUT, password: "short" });

    expect(result.success).toBe(false);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test("rejects an invalid email", async () => {
    const result = await createAdminUser({ ...VALID_INPUT, email: "not-an-email" });

    expect(result.success).toBe(false);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test("rejects an empty name", async () => {
    const result = await createAdminUser({ ...VALID_INPUT, name: "" });

    expect(result.success).toBe(false);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("createAdminUser — duplicate email", () => {
  test("refuses to create a second account for the same email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing_user" } as never);

    const result = await createAdminUser(VALID_INPUT);

    expect(result).toEqual({ success: false, error: "An account with this email already exists" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
