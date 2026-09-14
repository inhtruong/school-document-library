import { z } from "zod";
import { DOCUMENT_TYPE_VALUES } from "@/lib/documents/document-type";

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, "VALIDATION_TITLE_REQUIRED").max(200, "VALIDATION_TITLE_TOO_LONG"),
  description: z.string().trim().max(2000, "VALIDATION_DESCRIPTION_TOO_LONG|2000").optional().nullable(),
  subject: z.string().trim().min(1, "VALIDATION_SUBJECT_REQUIRED").max(100, "VALIDATION_SUBJECT_TOO_LONG"),
  documentType: z.enum(DOCUMENT_TYPE_VALUES, { error: "VALIDATION_DOCUMENT_TYPE_INVALID" }),
  academicYear: z.string().trim().min(1, "VALIDATION_ACADEMIC_YEAR_REQUIRED").max(20, "VALIDATION_ACADEMIC_YEAR_TOO_LONG"),
});

export const updateDocumentSchema = createDocumentSchema.partial();

/**
 * Metadata schema for the taxonomy-aware upload flow (Step 6A) — distinct
 * from `createDocumentSchema`'s free-text `subject` since uploads now
 * select Grade/Subject/Lesson from cascading dropdowns instead. IDs are
 * only checked for presence here; `validateTaxonomySelection()` does the
 * real existence/hierarchy check server-side.
 */
export const uploadDocumentSchema = z.object({
  title: z.string().trim().min(1, "VALIDATION_TITLE_REQUIRED").max(200, "VALIDATION_TITLE_TOO_LONG"),
  description: z.string().trim().max(2000, "VALIDATION_DESCRIPTION_TOO_LONG|2000").optional().nullable(),
  academicYear: z.string().trim().min(1, "VALIDATION_ACADEMIC_YEAR_REQUIRED").max(20, "VALIDATION_ACADEMIC_YEAR_TOO_LONG"),
  gradeId: z.string().trim().min(1, "VALIDATION_GRADE_REQUIRED"),
  subjectId: z.string().trim().min(1, "VALIDATION_SUBJECT_REQUIRED"),
  lessonId: z.string().trim().min(1, "VALIDATION_LESSON_REQUIRED"),
  documentType: z.enum(DOCUMENT_TYPE_VALUES, { error: "VALIDATION_DOCUMENT_TYPE_INVALID" }),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
