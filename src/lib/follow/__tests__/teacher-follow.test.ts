import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    teacherFollow: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { FOLLOWING_PAGE_SIZE } from "@/lib/follow/follow-config";
import { followTeacher, isFollowingTeacher, listFollowedTeachers, unfollowTeacher } from "@/lib/follow/teacher-follow";

const TEACHER = { id: "teacher_1", role: "TEACHER" as const };
const STUDENT = { id: "student_1", role: "STUDENT" as const };
const ADMIN = { id: "admin_1", role: "ADMIN" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isFollowingTeacher", () => {
  test("returns false without querying the database when followerId is null (guest)", async () => {
    const result = await isFollowingTeacher(null, "teacher_1");

    expect(result).toBe(false);
    expect(prisma.teacherFollow.findUnique).not.toHaveBeenCalled();
  });

  test("returns true when a follow exists", async () => {
    vi.mocked(prisma.teacherFollow.findUnique).mockResolvedValue({ id: "follow_1" } as never);

    const result = await isFollowingTeacher("user_1", "teacher_1");

    expect(result).toBe(true);
    expect(prisma.teacherFollow.findUnique).toHaveBeenCalledWith({
      where: { followerId_teacherId: { followerId: "user_1", teacherId: "teacher_1" } },
      select: { id: true },
    });
  });

  test("returns false when no follow exists", async () => {
    vi.mocked(prisma.teacherFollow.findUnique).mockResolvedValue(null);

    const result = await isFollowingTeacher("user_1", "teacher_1");

    expect(result).toBe(false);
  });
});

describe("followTeacher — self-follow", () => {
  test("a teacher cannot follow themselves, and the database is never touched", async () => {
    const result = await followTeacher("teacher_1", "teacher_1");

    expect(result).toEqual({ outcome: "self-follow" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });
});

describe("followTeacher — target validation", () => {
  test("a TEACHER target is accepted", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(TEACHER as never);
    vi.mocked(prisma.teacherFollow.upsert).mockResolvedValue({} as never);

    const result = await followTeacher("user_1", "teacher_1");

    expect(result).toEqual({ outcome: "followed" });
  });

  test("a STUDENT target is rejected as not-found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(STUDENT as never);

    const result = await followTeacher("user_1", "student_1");

    expect(result).toEqual({ outcome: "not-found" });
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });

  test("an ADMIN target is rejected as not-found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN as never);

    const result = await followTeacher("user_1", "admin_1");

    expect(result).toEqual({ outcome: "not-found" });
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });

  test("a missing user is rejected as not-found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await followTeacher("user_1", "does-not-exist");

    expect(result).toEqual({ outcome: "not-found" });
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });
});

describe("followTeacher — idempotency and other teachers following teachers", () => {
  test("upserts on the compound (followerId, teacherId) key — idempotent, never a duplicate row", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(TEACHER as never);
    vi.mocked(prisma.teacherFollow.upsert).mockResolvedValue({} as never);

    await followTeacher("user_1", "teacher_1");

    expect(prisma.teacherFollow.upsert).toHaveBeenCalledWith({
      where: { followerId_teacherId: { followerId: "user_1", teacherId: "teacher_1" } },
      create: { followerId: "user_1", teacherId: "teacher_1" },
      update: {},
    });
  });

  test("one teacher can follow a different teacher", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "teacher_2", role: "TEACHER" } as never);
    vi.mocked(prisma.teacherFollow.upsert).mockResolvedValue({} as never);

    const result = await followTeacher("teacher_1", "teacher_2");

    expect(result).toEqual({ outcome: "followed" });
  });
});

describe("unfollowTeacher", () => {
  test("deletes by (followerId, teacherId) using deleteMany, which never throws on zero matches", async () => {
    vi.mocked(prisma.teacherFollow.deleteMany).mockResolvedValue({ count: 1 } as never);

    await unfollowTeacher("user_1", "teacher_1");

    expect(prisma.teacherFollow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: "user_1", teacherId: "teacher_1" },
    });
  });

  test("unfollowing a missing relationship resolves without throwing", async () => {
    vi.mocked(prisma.teacherFollow.deleteMany).mockResolvedValue({ count: 0 } as never);

    await expect(unfollowTeacher("user_1", "teacher_1")).resolves.toBeUndefined();
  });
});

describe("listFollowedTeachers", () => {
  test("orders newest followed first, caps take at FOLLOWING_PAGE_SIZE, and computes skip from the page", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([]);
    vi.mocked(prisma.teacherFollow.count).mockResolvedValue(0);

    await listFollowedTeachers("user_1", 2);

    expect(prisma.teacherFollow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { followerId: "user_1" },
        orderBy: { createdAt: "desc" },
        skip: FOLLOWING_PAGE_SIZE,
        take: FOLLOWING_PAGE_SIZE,
      })
    );
  });

  test("is scoped to exactly one follower", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([]);
    vi.mocked(prisma.teacherFollow.count).mockResolvedValue(0);

    await listFollowedTeachers("user_1", 1);

    expect(prisma.teacherFollow.count).toHaveBeenCalledWith({ where: { followerId: "user_1" } });
  });

  test("maps rows to name + document count, no email/passwordHash", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([
      { teacher: { id: "teacher_1", name: "Tara Teacher", _count: { uploadedDocuments: 5 } } },
    ] as never);
    vi.mocked(prisma.teacherFollow.count).mockResolvedValue(1);

    const result = await listFollowedTeachers("user_1", 1);

    expect(result.teachers).toEqual([{ id: "teacher_1", name: "Tara Teacher", documentCount: 5 }]);
  });

  test("returns an empty list with total 0 when following no teachers", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([]);
    vi.mocked(prisma.teacherFollow.count).mockResolvedValue(0);

    const result = await listFollowedTeachers("user_1", 1);

    expect(result).toEqual({ teachers: [], total: 0, page: 1, totalPages: 1 });
  });
});
