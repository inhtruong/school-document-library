import "server-only";
import type { Grade } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditActor } from "@/lib/audit/audit";
import { writeAuditLog } from "@/lib/audit/audit";
import { APPROVED_DOCUMENT_WHERE } from "@/lib/documents/visibility";
import type { CreateGradeInput, UpdateGradeInput } from "@/lib/validation/taxonomy-admin";
import type { GradeSummary } from "@/types/document";

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Grades are seed/static data, not user-editable in this step. Shared by
 * `GET /api/grades` (the client-side taxonomy selects) and any Server
 * Component that needs the initial Grade list without a self-fetch
 * (`/search`, `/upload`).
 */
export async function listGrades(): Promise<GradeSummary[]> {
  return prisma.grade.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, code: true, sortOrder: true },
  });
}

export type GradeWithDocumentCount = GradeSummary & { documentCount: number };

/**
 * Grades + their document count, for Homepage "browse by grade" cards
 * (UI-2) — same `groupBy` pattern as `listSubjectSummaries()`. Two cheap
 * queries (grade list is tiny/static; the groupBy is a single indexed
 * aggregate), never one count query per grade. Grades with zero documents
 * still appear (count 0) rather than being silently dropped, so the list
 * always reflects the real, current taxonomy — never hardcoded.
 */
export async function listGradeSummaries(): Promise<GradeWithDocumentCount[]> {
  const [grades, counts] = await Promise.all([
    listGrades(),
    prisma.document.groupBy({
      by: ["gradeId"],
      where: { gradeId: { not: null }, ...APPROVED_DOCUMENT_WHERE },
      _count: { _all: true },
    }),
  ]);

  const countByGradeId = new Map(counts.map((row) => [row.gradeId as string, row._count._all]));

  return grades.map((grade) => ({ ...grade, documentCount: countByGradeId.get(grade.id) ?? 0 }));
}

export type CreateGradeOutcome = { outcome: "created"; grade: Grade } | { outcome: "duplicate" };
export type UpdateGradeOutcome =
  | { outcome: "success"; grade: Grade }
  | { outcome: "not-found" }
  | { outcome: "duplicate" };
export type DeleteGradeOutcome = { outcome: "success" } | { outcome: "not-found" } | { outcome: "in-use" };

/** FEAT-15B: ADMIN-only. Audit row committed in the same transaction as the insert (FEAT-11 §17). */
export async function createGrade(input: CreateGradeInput, actor: AuditActor): Promise<CreateGradeOutcome> {
  try {
    const grade = await prisma.$transaction(async (tx) => {
      const created = await tx.grade.create({
        data: { name: input.name, code: input.code, sortOrder: input.sortOrder ?? 0 },
      });
      await writeAuditLog(
        { actor, action: "GRADE_CREATED", entityType: "GRADE", entityId: created.id, metadata: { name: created.name, code: created.code } },
        tx
      );
      return created;
    });
    return { outcome: "created", grade };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

export async function updateGrade(id: string, input: UpdateGradeInput, actor: AuditActor): Promise<UpdateGradeOutcome> {
  try {
    const grade = await prisma.$transaction(async (tx) => {
      const existing = await tx.grade.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await tx.grade.update({ where: { id }, data: input });
      await writeAuditLog(
        { actor, action: "GRADE_UPDATED", entityType: "GRADE", entityId: id, metadata: { changes: input } },
        tx
      );
      return updated;
    });

    if (!grade) return { outcome: "not-found" };
    return { outcome: "success", grade };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

/**
 * Blocks deletion while any Document still references this Grade — the FK
 * is `onDelete: SetNull` (not Restrict), so the database itself would
 * silently detach those documents rather than refuse the delete. A
 * taxonomy-backed Document always sets grade+subject+lesson together (the
 * upload service's invariant), so this single count also covers every
 * document nested under the grade's Subjects/Lessons — no recursive
 * aggregation needed.
 */
export async function deleteGrade(id: string, actor: AuditActor): Promise<DeleteGradeOutcome> {
  const existing = await prisma.grade.findUnique({ where: { id } });
  if (!existing) return { outcome: "not-found" };

  const documentCount = await prisma.document.count({ where: { gradeId: id } });
  if (documentCount > 0) return { outcome: "in-use" };

  await prisma.$transaction(async (tx) => {
    await tx.grade.delete({ where: { id } });
    await writeAuditLog(
      { actor, action: "GRADE_DELETED", entityType: "GRADE", entityId: id, metadata: { name: existing.name, code: existing.code } },
      tx
    );
  });

  return { outcome: "success" };
}
