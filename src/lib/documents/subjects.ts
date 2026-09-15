import "server-only";
import type { Subject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditActor } from "@/lib/audit/audit";
import { writeAuditLog } from "@/lib/audit/audit";
import type { CreateSubjectInput, UpdateSubjectInput } from "@/lib/validation/taxonomy-admin";

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export type SubjectWithDocumentCount = {
  id: string;
  name: string;
  code: string;
  gradeId: string;
  documentCount: number;
};

/** FEAT-15B: Admin taxonomy page — same two-query groupBy pattern as listGradeSummaries(). */
export async function listSubjectsForGrade(gradeId: string): Promise<SubjectWithDocumentCount[]> {
  const [subjects, counts] = await Promise.all([
    prisma.subject.findMany({
      where: { gradeId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, gradeId: true },
    }),
    prisma.document.groupBy({
      by: ["subjectId"],
      where: { subjectId: { not: null }, gradeId },
      _count: { _all: true },
    }),
  ]);

  const countBySubjectId = new Map(counts.map((row) => [row.subjectId as string, row._count._all]));

  return subjects.map((subject) => ({ ...subject, documentCount: countBySubjectId.get(subject.id) ?? 0 }));
}

export type CreateSubjectOutcome =
  | { outcome: "created"; subject: Subject }
  | { outcome: "duplicate" }
  | { outcome: "grade-not-found" };
export type UpdateSubjectOutcome =
  | { outcome: "success"; subject: Subject }
  | { outcome: "not-found" }
  | { outcome: "duplicate" };
export type DeleteSubjectOutcome = { outcome: "success" } | { outcome: "not-found" } | { outcome: "in-use" };

/** FEAT-15B: ADMIN-only. Re-checks the parent Grade exists server-side — never trusts a client-supplied gradeId, same discipline as validateTaxonomySelection(). */
export async function createSubject(input: CreateSubjectInput, actor: AuditActor): Promise<CreateSubjectOutcome> {
  const grade = await prisma.grade.findUnique({ where: { id: input.gradeId }, select: { id: true } });
  if (!grade) return { outcome: "grade-not-found" };

  try {
    const subject = await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: { name: input.name, code: input.code, gradeId: input.gradeId },
      });
      await writeAuditLog(
        {
          actor,
          action: "SUBJECT_CREATED",
          entityType: "SUBJECT",
          entityId: created.id,
          metadata: { name: created.name, code: created.code, gradeId: created.gradeId },
        },
        tx
      );
      return created;
    });
    return { outcome: "created", subject };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

/** Name/code only — re-parenting to a different Grade is deliberately not exposed here (FEAT-15B scope decision: could invalidate existing Document taxonomy assumptions, deferred). */
export async function updateSubject(
  id: string,
  input: UpdateSubjectInput,
  actor: AuditActor
): Promise<UpdateSubjectOutcome> {
  try {
    const subject = await prisma.$transaction(async (tx) => {
      const existing = await tx.subject.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await tx.subject.update({ where: { id }, data: input });
      await writeAuditLog(
        { actor, action: "SUBJECT_UPDATED", entityType: "SUBJECT", entityId: id, metadata: { changes: input } },
        tx
      );
      return updated;
    });

    if (!subject) return { outcome: "not-found" };
    return { outcome: "success", subject };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

/** Same in-use guard as deleteGrade() — see its doc comment. A Subject's Lessons cascade-delete automatically (onDelete: Cascade) once this passes. */
export async function deleteSubject(id: string, actor: AuditActor): Promise<DeleteSubjectOutcome> {
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) return { outcome: "not-found" };

  const documentCount = await prisma.document.count({ where: { subjectId: id } });
  if (documentCount > 0) return { outcome: "in-use" };

  await prisma.$transaction(async (tx) => {
    await tx.subject.delete({ where: { id } });
    await writeAuditLog(
      {
        actor,
        action: "SUBJECT_DELETED",
        entityType: "SUBJECT",
        entityId: id,
        metadata: { name: existing.name, code: existing.code, gradeId: existing.gradeId },
      },
      tx
    );
  });

  return { outcome: "success" };
}
