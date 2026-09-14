import "server-only";
import type { Grade, Lesson, Subject } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TaxonomySelection = { grade: Grade; subject: Subject; lesson: Lesson };

export type TaxonomyValidationResult =
  | ({ valid: true } & TaxonomySelection)
  | { valid: false; error: string };

/**
 * Confirms a Grade/Subject/Lesson combination is real and correctly
 * nested — Subject must belong to the given Grade, Lesson must belong to
 * the given Subject. Never trusts that IDs picked from cascading dropdowns
 * are actually consistent; always re-checks against the database. Shared by
 * the upload service (and anything else that accepts taxonomy IDs from a
 * client) so hierarchy enforcement lives in exactly one place.
 */
export async function validateTaxonomySelection(input: {
  gradeId: string;
  subjectId: string;
  lessonId: string;
}): Promise<TaxonomyValidationResult> {
  const [grade, subject, lesson] = await Promise.all([
    prisma.grade.findUnique({ where: { id: input.gradeId } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
    prisma.lesson.findUnique({ where: { id: input.lessonId } }),
  ]);

  if (!grade) return { valid: false, error: "TAXONOMY_GRADE_NOT_FOUND" };
  if (!subject) return { valid: false, error: "TAXONOMY_SUBJECT_NOT_FOUND" };
  if (!lesson) return { valid: false, error: "TAXONOMY_LESSON_NOT_FOUND" };

  if (subject.gradeId !== grade.id) {
    return { valid: false, error: "TAXONOMY_SUBJECT_GRADE_MISMATCH" };
  }
  if (lesson.subjectId !== subject.id) {
    return { valid: false, error: "TAXONOMY_LESSON_SUBJECT_MISMATCH" };
  }

  return { valid: true, grade, subject, lesson };
}
