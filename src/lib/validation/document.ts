import { z } from "zod";
import { DOCUMENT_TYPE_VALUES } from "@/lib/documents/document-type";

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  subject: z.string().trim().min(1, "Subject is required").max(100),
  documentType: z.enum(DOCUMENT_TYPE_VALUES),
  academicYear: z.string().trim().min(1, "Academic year is required").max(20),
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
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  academicYear: z.string().trim().min(1, "Academic year is required").max(20),
  gradeId: z.string().trim().min(1, "Grade is required"),
  subjectId: z.string().trim().min(1, "Subject is required"),
  lessonId: z.string().trim().min(1, "Lesson is required"),
  documentType: z.enum(DOCUMENT_TYPE_VALUES),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
