import { z } from "zod";

export const rejectDocumentSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required").max(1000),
});

export type RejectDocumentInput = z.infer<typeof rejectDocumentSchema>;
