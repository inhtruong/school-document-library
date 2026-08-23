/**
 * Single source of truth for the controlled Report Reason — mirrors the
 * Prisma `ReportReason` enum. Kept as a plain string-literal list (not an
 * import from `@prisma/client`) so it's usable from client components too,
 * matching `document-type.ts`'s convention.
 */
export const REPORT_REASON_VALUES = [
  "BROKEN_FILE",
  "WRONG_CONTENT",
  "WRONG_TAXONOMY",
  "PREVIEW_ISSUE",
  "DUPLICATE_DOCUMENT",
  "COPYRIGHT",
  "OTHER",
] as const;

export type ReportReasonValue = (typeof REPORT_REASON_VALUES)[number];

export const REPORT_REASON_LABELS: Record<ReportReasonValue, string> = {
  BROKEN_FILE: "Broken file",
  WRONG_CONTENT: "Wrong content",
  WRONG_TAXONOMY: "Wrong grade/subject/lesson",
  PREVIEW_ISSUE: "Preview issue",
  DUPLICATE_DOCUMENT: "Duplicate document",
  COPYRIGHT: "Copyright issue",
  OTHER: "Other",
};
