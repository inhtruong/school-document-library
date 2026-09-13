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

const REPORT_REASON_MESSAGE_KEYS = {
  BROKEN_FILE: "brokenFile",
  WRONG_CONTENT: "wrongContent",
  WRONG_TAXONOMY: "wrongTaxonomy",
  PREVIEW_ISSUE: "previewIssue",
  DUPLICATE_DOCUMENT: "duplicateDocument",
  COPYRIGHT: "copyright",
  OTHER: "other",
} as const satisfies Record<ReportReasonValue, string>;

export function reportReasonMessageKey(value: ReportReasonValue): (typeof REPORT_REASON_MESSAGE_KEYS)[ReportReasonValue] {
  return REPORT_REASON_MESSAGE_KEYS[value];
}
