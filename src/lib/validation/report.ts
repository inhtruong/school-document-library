import { z } from "zod";
import { REPORT_DESCRIPTION_MAX_LENGTH } from "@/lib/documents/report-config";
import { REPORT_REASON_VALUES } from "@/lib/documents/report-reason";

/**
 * Description is optional for every reason except OTHER, where a
 * whitespace-only value is treated the same as a missing one (both trim
 * to empty and fail the refine below). Normalizes to `null` (not `""`)
 * when absent, matching the rest of the schema's nullable-field style.
 */
export const createReportSchema = z
  .object({
    reason: z.enum(REPORT_REASON_VALUES, { error: "VALIDATION_REPORT_REASON_INVALID" }),
    description: z
      .string()
      .trim()
      .max(REPORT_DESCRIPTION_MAX_LENGTH, `VALIDATION_DESCRIPTION_TOO_LONG|${REPORT_DESCRIPTION_MAX_LENGTH}`)
      .optional(),
  })
  .refine((data) => data.reason !== "OTHER" || Boolean(data.description && data.description.length > 0), {
    message: "VALIDATION_REPORT_DESCRIPTION_REQUIRED_FOR_OTHER",
    path: ["description"],
  })
  .transform((data) => ({
    reason: data.reason,
    description: data.description && data.description.length > 0 ? data.description : null,
  }));

export type CreateReportInput = z.infer<typeof createReportSchema>;
