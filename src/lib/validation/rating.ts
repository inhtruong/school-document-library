import { z } from "zod";

export const rateDocumentSchema = z.object({
  value: z
    .number({ error: "Rating is required" })
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
});

export type RateDocumentInput = z.infer<typeof rateDocumentSchema>;
