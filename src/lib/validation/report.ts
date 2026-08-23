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
    reason: z.enum(REPORT_REASON_VALUES, { error: "Select a valid reason" }),
    description: z
      .string()
      .trim()
      .max(
        REPORT_DESCRIPTION_MAX_LENGTH,
        `Description must be ${REPORT_DESCRIPTION_MAX_LENGTH} characters or fewer`
      )
      .optional(),
  })
  .refine((data) => data.reason !== "OTHER" || Boolean(data.description && data.description.length > 0), {
    message: "Description is required when reason is Other",
    path: ["description"],
  })
  .transform((data) => ({
    reason: data.reason,
    description: data.description && data.description.length > 0 ? data.description : null,
  }));

export type CreateReportInput = z.infer<typeof createReportSchema>;
