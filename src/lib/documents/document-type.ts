/**
 * Single source of truth for the controlled Document Type — mirrors the
 * Prisma `DocumentType` enum. Kept as a plain string-literal list (not an
 * import from `@prisma/client`) so it's usable from client components too.
 */
export const DOCUMENT_TYPE_VALUES = [
  "LECTURE",
  "EXERCISE",
  "EXAM",
  "ANSWER",
  "REFERENCE",
  "OTHER",
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPE_VALUES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeValue, string> = {
  LECTURE: "Lecture",
  EXERCISE: "Exercise",
  EXAM: "Exam",
  ANSWER: "Answer key",
  REFERENCE: "Reference",
  OTHER: "Other",
};
