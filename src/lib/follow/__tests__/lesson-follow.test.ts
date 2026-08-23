import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lesson: { findUnique: vi.fn() },
    lessonFollow: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { FOLLOWING_PAGE_SIZE } from "@/lib/follow/follow-config";
import { followLesson, isFollowingLesson, listFollowedLessons, unfollowLesson } from "@/lib/follow/lesson-follow";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isFollowingLesson", () => {
  test("returns false without querying the database when userId is null (guest)", async () => {
    const result = await isFollowingLesson(null, "lesson_1");

    expect(result).toBe(false);
    expect(prisma.lessonFollow.findUnique).not.toHaveBeenCalled();
  });

  test("returns true when a follow exists", async () => {
    vi.mocked(prisma.lessonFollow.findUnique).mockResolvedValue({ id: "follow_1" } as never);

    const result = await isFollowingLesson("user_1", "lesson_1");

    expect(result).toBe(true);
    expect(prisma.lessonFollow.findUnique).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: "user_1", lessonId: "lesson_1" } },
      select: { id: true },
    });
  });

  test("returns false when no follow exists", async () => {
    vi.mocked(prisma.lessonFollow.findUnique).mockResolvedValue(null);

    const result = await isFollowingLesson("user_1", "lesson_1");

    expect(result).toBe(false);
  });
});

describe("followLesson", () => {
  test("a valid Lesson is accepted and upserted idempotently", async () => {
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue({ id: "lesson_1" } as never);
    vi.mocked(prisma.lessonFollow.upsert).mockResolvedValue({} as never);

    const result = await followLesson("user_1", "lesson_1");

    expect(result).toEqual({ outcome: "followed" });
    expect(prisma.lessonFollow.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: "user_1", lessonId: "lesson_1" } },
      create: { userId: "user_1", lessonId: "lesson_1" },
      update: {},
    });
  });

  test("a missing Lesson is rejected as not-found and never upserted", async () => {
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(null);

    const result = await followLesson("user_1", "does-not-exist");

    expect(result).toEqual({ outcome: "not-found" });
    expect(prisma.lessonFollow.upsert).not.toHaveBeenCalled();
  });

  test("a repeat follow of the same Lesson makes the same idempotent upsert call again", async () => {
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue({ id: "lesson_1" } as never);
    vi.mocked(prisma.lessonFollow.upsert).mockResolvedValue({} as never);

    await followLesson("user_1", "lesson_1");
    await followLesson("user_1", "lesson_1");

    expect(prisma.lessonFollow.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("unfollowLesson", () => {
  test("deletes by (userId, lessonId) using deleteMany, which never throws on zero matches", async () => {
    vi.mocked(prisma.lessonFollow.deleteMany).mockResolvedValue({ count: 1 } as never);

    await unfollowLesson("user_1", "lesson_1");

    expect(prisma.lessonFollow.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", lessonId: "lesson_1" },
    });
  });

  test("unfollowing a missing relationship resolves without throwing", async () => {
    vi.mocked(prisma.lessonFollow.deleteMany).mockResolvedValue({ count: 0 } as never);

    await expect(unfollowLesson("user_1", "lesson_1")).resolves.toBeUndefined();
  });
});

describe("listFollowedLessons", () => {
  test("orders newest followed first, caps take at FOLLOWING_PAGE_SIZE, and computes skip from the page", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lessonFollow.count).mockResolvedValue(0);

    await listFollowedLessons("user_1", 2);

    expect(prisma.lessonFollow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        orderBy: { createdAt: "desc" },
        skip: FOLLOWING_PAGE_SIZE,
        take: FOLLOWING_PAGE_SIZE,
      })
    );
  });

  test("is scoped to exactly one user (isolation)", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lessonFollow.count).mockResolvedValue(0);

    await listFollowedLessons("user_1", 1);

    expect(prisma.lessonFollow.count).toHaveBeenCalledWith({ where: { userId: "user_1" } });
  });

  test("maps rows to name + subject + grade", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([
      {
        lesson: {
          id: "lesson_1",
          name: "Derivatives",
          subject: { name: "Mathematics", grade: { name: "Grade 12" } },
        },
      },
    ] as never);
    vi.mocked(prisma.lessonFollow.count).mockResolvedValue(1);

    const result = await listFollowedLessons("user_1", 1);

    expect(result.lessons).toEqual([
      { id: "lesson_1", name: "Derivatives", subjectName: "Mathematics", gradeName: "Grade 12" },
    ]);
  });

  test("returns an empty list with total 0 when following no lessons", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lessonFollow.count).mockResolvedValue(0);

    const result = await listFollowedLessons("user_1", 1);

    expect(result).toEqual({ lessons: [], total: 0, page: 1, totalPages: 1 });
  });
});
