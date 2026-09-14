import { z } from "zod";

export const rateDocumentSchema = z.object({
  value: z
    .number({ error: "VALIDATION_RATING_REQUIRED" })
    .int("VALIDATION_RATING_NOT_INTEGER")
    .min(1, "VALIDATION_RATING_OUT_OF_RANGE")
    .max(5, "VALIDATION_RATING_OUT_OF_RANGE"),
});

export type RateDocumentInput = z.infer<typeof rateDocumentSchema>;
