import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  subject: z.string().trim().min(1, "Subject is required").max(100),
  documentType: z.string().trim().min(1, "Document type is required").max(100),
  academicYear: z.string().trim().min(1, "Academic year is required").max(20),
});

export const updateDocumentSchema = createDocumentSchema.partial();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
