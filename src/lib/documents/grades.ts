import "server-only";
import { prisma } from "@/lib/prisma";
import type { GradeSummary } from "@/types/document";

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
      where: { gradeId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByGradeId = new Map(counts.map((row) => [row.gradeId as string, row._count._all]));

  return grades.map((grade) => ({ ...grade, documentCount: countByGradeId.get(grade.id) ?? 0 }));
}
