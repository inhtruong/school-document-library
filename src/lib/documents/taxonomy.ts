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

  if (!grade) return { valid: false, error: "Selected grade does not exist" };
  if (!subject) return { valid: false, error: "Selected subject does not exist" };
  if (!lesson) return { valid: false, error: "Selected lesson does not exist" };

  if (subject.gradeId !== grade.id) {
    return { valid: false, error: "Selected subject does not belong to the selected grade" };
  }
  if (lesson.subjectId !== subject.id) {
    return { valid: false, error: "Selected lesson does not belong to the selected subject" };
  }

  return { valid: true, grade, subject, lesson };
}
