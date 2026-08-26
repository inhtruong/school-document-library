import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { changePassword } from "@/lib/auth/change-password";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const OLD_PASSWORD = "old-correct-password";
const NEW_PASSWORD = "new-correct-password";

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    passwordHash: await hashPassword(OLD_PASSWORD),
  } as never);
  vi.mocked(prisma.user.update).mockResolvedValue({} as never);
});

describe("changePassword", () => {
  test("succeeds with the correct current password and a valid new password", async () => {
    const result = await changePassword("user_1", {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { passwordHash: expect.any(String), sessionVersion: { increment: 1 } },
    });
  });

  test("increments sessionVersion and updates passwordHash in a single atomic call", async () => {
    await changePassword("user_1", {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    // Exactly one prisma.user.update call carries both fields together —
    // not two separate loosely-coupled updates.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.user.update).mock.calls[0][0];
    expect(call.data).toHaveProperty("passwordHash");
    expect(call.data).toHaveProperty("sessionVersion", { increment: 1 });
  });

  test("rejects an incorrect current password without updating anything", async () => {
    const result = await changePassword("user_1", {
      currentPassword: "totally-wrong",
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects a new password that is too short, without touching the database", async () => {
    const result = await changePassword("user_1", {
      currentPassword: OLD_PASSWORD,
      newPassword: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects a mismatched confirmation", async () => {
    const result = await changePassword("user_1", {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: "does-not-match",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects a new password equal to the current password", async () => {
    const result = await changePassword("user_1", {
      currentPassword: OLD_PASSWORD,
      newPassword: OLD_PASSWORD,
      confirmPassword: OLD_PASSWORD,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("the stored hash actually changes, the old password stops working, and the new one works", async () => {
    await changePassword("user_1", {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    const call = vi.mocked(prisma.user.update).mock.calls[0][0] as { data: { passwordHash: string } };
    const newHash = call.data.passwordHash;

    expect(newHash).not.toBe(await hashPassword(OLD_PASSWORD));
    await expect(verifyPassword(OLD_PASSWORD, newHash)).resolves.toBe(false);
    await expect(verifyPassword(NEW_PASSWORD, newHash)).resolves.toBe(true);
  });

  test("never returns passwordHash in the result", async () => {
    const result = await changePassword("user_1", {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  test("always targets the userId argument, ignoring any id/userId in the input", async () => {
    await changePassword("real-caller-id", {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
      userId: "attacker-controlled-id",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "real-caller-id" } })
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "real-caller-id" } })
    );
  });

  test("rejects when the account no longer exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await changePassword("ghost-user", {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
