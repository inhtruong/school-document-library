import "server-only";
import type { Lesson } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditActor } from "@/lib/audit/audit";
import { writeAuditLog } from "@/lib/audit/audit";
import type { CreateLessonInput, UpdateLessonInput } from "@/lib/validation/taxonomy-admin";

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export type LessonWithDocumentCount = {
  id: string;
  name: string;
  code: string;
  subjectId: string;
  documentCount: number;
};

/** FEAT-15B: Admin taxonomy page — same two-query groupBy pattern as listGradeSummaries(). */
export async function listLessonsForSubject(subjectId: string): Promise<LessonWithDocumentCount[]> {
  const [lessons, counts] = await Promise.all([
    prisma.lesson.findMany({
      where: { subjectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, subjectId: true },
    }),
    prisma.document.groupBy({
      by: ["lessonId"],
      where: { lessonId: { not: null }, subjectId },
      _count: { _all: true },
    }),
  ]);

  const countByLessonId = new Map(counts.map((row) => [row.lessonId as string, row._count._all]));

  return lessons.map((lesson) => ({ ...lesson, documentCount: countByLessonId.get(lesson.id) ?? 0 }));
}

export type CreateLessonOutcome =
  | { outcome: "created"; lesson: Lesson }
  | { outcome: "duplicate" }
  | { outcome: "subject-not-found" };
export type UpdateLessonOutcome =
  | { outcome: "success"; lesson: Lesson }
  | { outcome: "not-found" }
  | { outcome: "duplicate" };
export type DeleteLessonOutcome = { outcome: "success" } | { outcome: "not-found" } | { outcome: "in-use" };

/** FEAT-15B: ADMIN-only. Re-checks the parent Subject exists server-side — same discipline as createSubject()/validateTaxonomySelection(). */
export async function createLesson(input: CreateLessonInput, actor: AuditActor): Promise<CreateLessonOutcome> {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId }, select: { id: true } });
  if (!subject) return { outcome: "subject-not-found" };

  try {
    const lesson = await prisma.$transaction(async (tx) => {
      const created = await tx.lesson.create({
        data: { name: input.name, code: input.code, subjectId: input.subjectId },
      });
      await writeAuditLog(
        {
          actor,
          action: "LESSON_CREATED",
          entityType: "LESSON",
          entityId: created.id,
          metadata: { name: created.name, code: created.code, subjectId: created.subjectId },
        },
        tx
      );
      return created;
    });
    return { outcome: "created", lesson };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

/** Name/code only — re-parenting to a different Subject is deliberately not exposed here (FEAT-15B scope decision: could invalidate existing Document taxonomy assumptions, deferred). */
export async function updateLesson(
  id: string,
  input: UpdateLessonInput,
  actor: AuditActor
): Promise<UpdateLessonOutcome> {
  try {
    const lesson = await prisma.$transaction(async (tx) => {
      const existing = await tx.lesson.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await tx.lesson.update({ where: { id }, data: input });
      await writeAuditLog(
        { actor, action: "LESSON_UPDATED", entityType: "LESSON", entityId: id, metadata: { changes: input } },
        tx
      );
      return updated;
    });

    if (!lesson) return { outcome: "not-found" };
    return { outcome: "success", lesson };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

/** Same in-use guard as deleteGrade()/deleteSubject() — see deleteGrade's doc comment. Cascade-deletes any LessonFollow rows automatically. */
export async function deleteLesson(id: string, actor: AuditActor): Promise<DeleteLessonOutcome> {
  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (!existing) return { outcome: "not-found" };

  const documentCount = await prisma.document.count({ where: { lessonId: id } });
  if (documentCount > 0) return { outcome: "in-use" };

  await prisma.$transaction(async (tx) => {
    await tx.lesson.delete({ where: { id } });
    await writeAuditLog(
      {
        actor,
        action: "LESSON_DELETED",
        entityType: "LESSON",
        entityId: id,
        metadata: { name: existing.name, code: existing.code, subjectId: existing.subjectId },
      },
      tx
    );
  });

  return { outcome: "success" };
}
