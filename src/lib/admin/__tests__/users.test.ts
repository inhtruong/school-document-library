import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    user: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";
import { getAdminUserById, listAdminUsers, updateUserRole } from "@/lib/admin/users";

const ACTOR = { id: "admin_1", email: "admin@example.com", role: "ADMIN" as const };
const now = new Date("2026-01-01T00:00:00.000Z");

const STUDENT_USER = { id: "user_1", name: "Sam Student", email: "sam@example.com", role: "STUDENT" as const, createdAt: now };
const TEACHER_USER = { id: "user_2", name: "Tara Teacher", email: "tara@example.com", role: "TEACHER" as const, createdAt: now };
const ADMIN_USER = { id: "admin_1", name: "Alex Admin", email: "admin@example.com", role: "ADMIN" as const, createdAt: now };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAdminUsers", () => {
  test("returns a page of users, newest first, without passwordHash/sessionVersion", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([STUDENT_USER] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const result = await listAdminUsers({}, 1);

    expect(result).toEqual({ users: [STUDENT_USER], total: 1, page: 1, totalPages: 1 });
    const call = vi.mocked(prisma.user.findMany).mock.calls[0]![0]!;
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(call.select).toEqual({ id: true, name: true, email: true, role: true, createdAt: true });
    expect(call.select).not.toHaveProperty("passwordHash");
    expect(call.select).not.toHaveProperty("sessionVersion");
  });

  test("paginates using skip/take", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(45);

    const result = await listAdminUsers({}, 3);

    const call = vi.mocked(prisma.user.findMany).mock.calls[0]![0]!;
    expect(call.skip).toBe(40);
    expect(call.take).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  test("searches name/email case-insensitively", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    await listAdminUsers({ search: "sam" }, 1);

    const call = vi.mocked(prisma.user.findMany).mock.calls[0]![0]!;
    expect(call.where).toEqual({
      OR: [{ name: { contains: "sam", mode: "insensitive" } }, { email: { contains: "sam", mode: "insensitive" } }],
    });
  });

  test("filters by role", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    await listAdminUsers({ role: "TEACHER" }, 1);

    const call = vi.mocked(prisma.user.findMany).mock.calls[0]![0]!;
    expect(call.where).toEqual({ role: "TEACHER" });
  });
});

describe("getAdminUserById", () => {
  test("returns a user with safe aggregate counts", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...STUDENT_USER,
      _count: { uploadedDocuments: 3, comments: 1, ratings: 2, reports: 0 },
    } as never);

    const result = await getAdminUserById(STUDENT_USER.id);

    expect(result).toMatchObject({ id: STUDENT_USER.id, counts: { uploadedDocuments: 3, comments: 1, ratings: 2, reports: 0 } });
    const call = vi.mocked(prisma.user.findUnique).mock.calls[0]![0]!;
    expect(call.select).not.toHaveProperty("passwordHash");
    expect(call.select).not.toHaveProperty("sessionVersion");
  });

  test("returns null for a nonexistent user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const result = await getAdminUserById("missing");

    expect(result).toBeNull();
  });
});

describe("updateUserRole", () => {
  test("promotes STUDENT to TEACHER, increments sessionVersion, writes an audit row", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(STUDENT_USER as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...STUDENT_USER, role: "TEACHER" } as never);

    const result = await updateUserRole(STUDENT_USER.id, "TEACHER", ACTOR);

    expect(result.outcome).toBe("success");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: STUDENT_USER.id },
        data: { role: "TEACHER", sessionVersion: { increment: 1 } },
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "USER_ROLE_CHANGED",
          entityType: "USER",
          entityId: STUDENT_USER.id,
        }),
      })
    );
  });

  test("promotes TEACHER to ADMIN", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(TEACHER_USER as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...TEACHER_USER, role: "ADMIN" } as never);

    const result = await updateUserRole(TEACHER_USER.id, "ADMIN", ACTOR);

    expect(result.outcome).toBe("success");
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  test("demotes a non-last ADMIN when another admin exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...ADMIN_USER, role: "TEACHER" } as never);

    const result = await updateUserRole(ADMIN_USER.id, "TEACHER", ACTOR);

    expect(result.outcome).toBe("success");
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { role: "ADMIN", id: { not: ADMIN_USER.id } } });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  test("blocks demoting the last remaining ADMIN", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const result = await updateUserRole(ADMIN_USER.id, "TEACHER", ACTOR);

    expect(result.outcome).toBe("last-admin");
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test("returns not-found for a nonexistent user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const result = await updateUserRole("missing", "TEACHER", ACTOR);

    expect(result.outcome).toBe("not-found");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("no-ops when the role is unchanged — no audit row, no sessionVersion bump", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(STUDENT_USER as never);

    const result = await updateUserRole(STUDENT_USER.id, "STUDENT", ACTOR);

    expect(result.outcome).toBe("success");
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test("maps a Postgres serialization failure (P2034) to a conflict outcome", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce({ code: "P2034" });

    const result = await updateUserRole(ADMIN_USER.id, "TEACHER", ACTOR);

    expect(result.outcome).toBe("conflict");
  });

  test("runs the transaction with Serializable isolation", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(STUDENT_USER as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...STUDENT_USER, role: "TEACHER" } as never);

    await updateUserRole(STUDENT_USER.id, "TEACHER", ACTOR);

    const options = vi.mocked(prisma.$transaction).mock.calls[0]![1] as { isolationLevel?: string } | undefined;
    expect(options?.isolationLevel).toBe("Serializable");
  });
});
