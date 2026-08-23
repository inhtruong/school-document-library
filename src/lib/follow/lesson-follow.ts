import "server-only";
import { prisma } from "@/lib/prisma";
import { FOLLOWING_PAGE_SIZE } from "@/lib/follow/follow-config";

export async function isFollowingLesson(userId: string | null, lessonId: string): Promise<boolean> {
  if (!userId) return false;

  const follow = await prisma.lessonFollow.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { id: true },
  });
  return follow !== null;
}

export type FollowLessonOutcome = { outcome: "followed" } | { outcome: "not-found" };

/** Idempotent via `upsert` on the compound key — a repeat follow never creates a second row. */
export async function followLesson(userId: string, lessonId: string): Promise<FollowLessonOutcome> {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return { outcome: "not-found" };

  await prisma.lessonFollow.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: {},
  });
  return { outcome: "followed" };
}

/** Safe on a missing follow — `deleteMany` matches zero rows instead of throwing. */
export async function unfollowLesson(userId: string, lessonId: string): Promise<void> {
  await prisma.lessonFollow.deleteMany({ where: { userId, lessonId } });
}

export type FollowedLesson = { id: string; name: string; subjectName: string; gradeName: string };
export type FollowedLessonsPage = {
  lessons: FollowedLesson[];
  total: number;
  page: number;
  totalPages: number;
};

/** Newest followed first, always capped at FOLLOWING_PAGE_SIZE, scoped to exactly one user. No follower counts denormalized or returned. */
export async function listFollowedLessons(userId: string, page: number): Promise<FollowedLessonsPage> {
  const skip = (page - 1) * FOLLOWING_PAGE_SIZE;

  const [follows, total] = await Promise.all([
    prisma.lessonFollow.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: FOLLOWING_PAGE_SIZE,
      include: {
        lesson: { include: { subject: { include: { grade: true } } } },
      },
    }),
    prisma.lessonFollow.count({ where: { userId } }),
  ]);

  return {
    lessons: follows.map((follow) => ({
      id: follow.lesson.id,
      name: follow.lesson.name,
      subjectName: follow.lesson.subject.name,
      gradeName: follow.lesson.subject.grade.name,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / FOLLOWING_PAGE_SIZE)),
  };
}
