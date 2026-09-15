import { z } from "zod";

const NAME_MAX_LENGTH = 100;
const CODE_MAX_LENGTH = 40;
const CODE_FORMAT = /^[A-Z0-9_]+$/;

/**
 * Shared shape for a Grade/Subject/Lesson name + code pair — the code is
 * normalized to uppercase (matching the seed data style, e.g. `G10`,
 * `MOTION`) before the format check runs, so an admin typing lowercase in
 * the create/edit form doesn't get rejected for it.
 */
function nameField(requiredCode: string, tooLongCode: string) {
  return z.string().trim().min(1, requiredCode).max(NAME_MAX_LENGTH, tooLongCode);
}

function codeField(requiredCode: string, tooLongCode: string, invalidFormatCode: string) {
  return z
    .string()
    .trim()
    .min(1, requiredCode)
    .max(CODE_MAX_LENGTH, tooLongCode)
    .transform((value) => value.toUpperCase())
    .refine((value) => CODE_FORMAT.test(value), invalidFormatCode);
}

export const createGradeSchema = z.object({
  name: nameField("VALIDATION_GRADE_NAME_REQUIRED", "VALIDATION_GRADE_NAME_TOO_LONG"),
  code: codeField("VALIDATION_GRADE_CODE_REQUIRED", "VALIDATION_GRADE_CODE_TOO_LONG", "VALIDATION_GRADE_CODE_INVALID_FORMAT"),
  sortOrder: z.number().int().optional(),
});

export const updateGradeSchema = createGradeSchema.partial();

const subjectNameAndCode = {
  name: nameField("VALIDATION_SUBJECT_NAME_REQUIRED", "VALIDATION_SUBJECT_NAME_TOO_LONG"),
  code: codeField(
    "VALIDATION_SUBJECT_CODE_REQUIRED",
    "VALIDATION_SUBJECT_CODE_TOO_LONG",
    "VALIDATION_SUBJECT_CODE_INVALID_FORMAT"
  ),
};

export const createSubjectSchema = z.object({
  ...subjectNameAndCode,
  gradeId: z.string().trim().min(1, "VALIDATION_SUBJECT_GRADE_ID_REQUIRED"),
});

/** Name/code only — no gradeId. Re-parenting a Subject to a different Grade is out of scope for FEAT-15B (see updateSubject()'s doc comment). */
export const updateSubjectSchema = z.object(subjectNameAndCode).partial();

const lessonNameAndCode = {
  name: nameField("VALIDATION_LESSON_NAME_REQUIRED", "VALIDATION_LESSON_NAME_TOO_LONG"),
  code: codeField(
    "VALIDATION_LESSON_CODE_REQUIRED",
    "VALIDATION_LESSON_CODE_TOO_LONG",
    "VALIDATION_LESSON_CODE_INVALID_FORMAT"
  ),
};

export const createLessonSchema = z.object({
  ...lessonNameAndCode,
  subjectId: z.string().trim().min(1, "VALIDATION_LESSON_SUBJECT_ID_REQUIRED"),
});

/** Name/code only — no subjectId. Re-parenting a Lesson to a different Subject is out of scope for FEAT-15B (see updateLesson()'s doc comment). */
export const updateLessonSchema = z.object(lessonNameAndCode).partial();

export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
