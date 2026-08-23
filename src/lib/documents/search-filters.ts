import "server-only";
import { prisma } from "@/lib/prisma";

export type ResolvedTaxonomyFilters = {
  gradeId?: string;
  subjectId?: string;
  lessonId?: string;
};

/**
 * Resolves Grade/Subject/Lesson filter IDs from an untrusted search query
 * against the DB, dropping anything invalid or inconsistent instead of
 * erroring — a mismatched Subject/Lesson from a hand-edited URL should
 * degrade to a broader (but still valid) search, never crash or leak a DB
 * error. Mirrors the hierarchy check in `validateTaxonomySelection()`
 * (upload path), but tolerant rather than rejecting, since this is a read.
 */
export async function resolveSearchTaxonomyFilters(input: {
  gradeId?: string;
  subjectId?: string;
  lessonId?: string;
}): Promise<ResolvedTaxonomyFilters> {
  const [grade, subject, lesson] = await Promise.all([
    input.gradeId ? prisma.grade.findUnique({ where: { id: input.gradeId } }) : null,
    input.subjectId ? prisma.subject.findUnique({ where: { id: input.subjectId } }) : null,
    input.lessonId ? prisma.lesson.findUnique({ where: { id: input.lessonId } }) : null,
  ]);

  const result: ResolvedTaxonomyFilters = {};
  if (grade) result.gradeId = grade.id;

  if (subject && (!result.gradeId || subject.gradeId === result.gradeId)) {
    result.subjectId = subject.id;
  }

  if (lesson && result.subjectId && lesson.subjectId === result.subjectId) {
    result.lessonId = lesson.id;
  }

  return result;
}
