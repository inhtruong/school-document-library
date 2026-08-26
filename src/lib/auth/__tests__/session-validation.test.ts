import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getUserForSessionValidation } from "@/lib/auth/session-validation";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserForSessionValidation", () => {
  // Distinct userId per test — this function is wrapped in React's cache(),
  // which memoizes by argument for the lifetime of the module in a plain
  // Vitest run (there's no per-request reset outside Next.js); reusing the
  // same id across tests with different expected results would read a
  // stale memoized value instead of exercising the mock.
  test("selects only id/name/role/sessionVersion — never passwordHash or email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "svtest_1",
      name: "Sam Student",
      role: "STUDENT",
      sessionVersion: 0,
    } as never);

    await getUserForSessionValidation("svtest_1");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "svtest_1" },
      select: { id: true, name: true, role: true, sessionVersion: true },
    });
  });

  test("returns null when the user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await getUserForSessionValidation("svtest_2_missing");

    expect(result).toBeNull();
  });
});
