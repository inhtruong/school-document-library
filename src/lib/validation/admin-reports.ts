import { z } from "zod";

/** Only RESOLVED/DISMISSED are ever a client-supplied target — OPEN is never a transition destination (a report starts OPEN and can only leave it once). */
export const updateReportStatusSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"], { error: "VALIDATION_REPORT_STATUS_INVALID" }),
});

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>;
