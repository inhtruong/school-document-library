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

/** FEAT-13: the actual label text now lives in the locale message files (`documentType.*` — see src/i18n/messages/*.json). Maps a value to its message key, e.g. "ANSWER" -> "answer" (whose text is "Answer key"/"Đáp án", not literally the key name). */
export function documentTypeMessageKey(value: DocumentTypeValue): Lowercase<DocumentTypeValue> {
  return value.toLowerCase() as Lowercase<DocumentTypeValue>;
}
