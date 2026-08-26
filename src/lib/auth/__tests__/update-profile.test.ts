import { beforeEach, describe, expect, test } from "vitest";
import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { updateProfileName } from "@/lib/auth/update-profile";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.update).mockResolvedValue({ id: "user_1", name: "Updated Name" } as never);
});

describe("updateProfileName", () => {
  test("updates the given user's name", async () => {
    const result = await updateProfileName("user_1", { name: "Updated Name" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.user.name).toBe("Updated Name");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { name: "Updated Name" },
      select: { id: true, name: true },
    });
  });

  test("trims whitespace from the name", async () => {
    await updateProfileName("user_1", { name: "  Nguyen Van A  " });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Nguyen Van A" } })
    );
  });

  test("rejects an empty name without touching the database", async () => {
    const result = await updateProfileName("user_1", { name: "" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects a whitespace-only name without touching the database", async () => {
    const result = await updateProfileName("user_1", { name: "   " });

    expect(result.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects an oversized name without touching the database", async () => {
    const result = await updateProfileName("user_1", { name: "a".repeat(101) });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("ignores a client-supplied role and never includes it in the update", async () => {
    await updateProfileName("user_1", { name: "Valid Name", role: "ADMIN" });

    const call = vi.mocked(prisma.user.update).mock.calls[0][0];
    expect(call.data).toEqual({ name: "Valid Name" });
  });

  test("always targets the userId argument, ignoring any id/userId in the input", async () => {
    await updateProfileName("real-caller-id", {
      name: "Valid Name",
      id: "attacker-controlled-id",
      userId: "attacker-controlled-id",
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "real-caller-id" } })
    );
  });
});
