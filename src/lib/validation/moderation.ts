import { z } from "zod";

export const rejectDocumentSchema = z.object({
  reason: z.string().trim().min(1, "VALIDATION_REJECTION_REASON_REQUIRED").max(1000, "VALIDATION_REJECTION_REASON_TOO_LONG"),
});

export type RejectDocumentInput = z.infer<typeof rejectDocumentSchema>;
