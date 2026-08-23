import "server-only";
import { prisma } from "@/lib/prisma";
import { FOLLOWING_PAGE_SIZE } from "@/lib/follow/follow-config";

export async function isFollowingTeacher(followerId: string | null, teacherId: string): Promise<boolean> {
  if (!followerId) return false;

  const follow = await prisma.teacherFollow.findUnique({
    where: { followerId_teacherId: { followerId, teacherId } },
    select: { id: true },
  });
  return follow !== null;
}

export type FollowTeacherOutcome = { outcome: "followed" } | { outcome: "not-found" } | { outcome: "self-follow" };

/**
 * Self-follow is checked before touching the database (cheap, and avoids a
 * wasted lookup). The target must exist and have `role = TEACHER` — a
 * STUDENT/ADMIN id (or a missing id) is treated identically as
 * "not-found", so this endpoint never confirms/denies whether an
 * arbitrary user id exists. Idempotent via `upsert` on the compound key —
 * a repeat follow never creates a second row.
 */
export async function followTeacher(followerId: string, teacherId: string): Promise<FollowTeacherOutcome> {
  if (followerId === teacherId) return { outcome: "self-follow" };

  const teacher = await prisma.user.findUnique({ where: { id: teacherId }, select: { id: true, role: true } });
  if (!teacher || teacher.role !== "TEACHER") return { outcome: "not-found" };

  await prisma.teacherFollow.upsert({
    where: { followerId_teacherId: { followerId, teacherId } },
    create: { followerId, teacherId },
    update: {},
  });
  return { outcome: "followed" };
}

/** Safe on a missing follow — `deleteMany` matches zero rows instead of throwing. */
export async function unfollowTeacher(followerId: string, teacherId: string): Promise<void> {
  await prisma.teacherFollow.deleteMany({ where: { followerId, teacherId } });
}

export type FollowedTeacher = { id: string; name: string; documentCount: number };
export type FollowedTeachersPage = {
  teachers: FollowedTeacher[];
  total: number;
  page: number;
  totalPages: number;
};

/** Newest followed first, always capped at FOLLOWING_PAGE_SIZE, scoped to exactly one follower. Never exposes email/passwordHash — only id/name and an efficient _count, no N+1. */
export async function listFollowedTeachers(followerId: string, page: number): Promise<FollowedTeachersPage> {
  const skip = (page - 1) * FOLLOWING_PAGE_SIZE;

  const [follows, total] = await Promise.all([
    prisma.teacherFollow.findMany({
      where: { followerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: FOLLOWING_PAGE_SIZE,
      include: {
        teacher: {
          select: { id: true, name: true, _count: { select: { uploadedDocuments: true } } },
        },
      },
    }),
    prisma.teacherFollow.count({ where: { followerId } }),
  ]);

  return {
    teachers: follows.map((follow) => ({
      id: follow.teacher.id,
      name: follow.teacher.name,
      documentCount: follow.teacher._count.uploadedDocuments,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / FOLLOWING_PAGE_SIZE)),
  };
}
