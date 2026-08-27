import "server-only";
import type { UpdateDocumentInput } from "@/lib/validation/document";

/**
 * Fields whose value actually changing requires a human moderator to
 * re-review the document before it can remain publicly APPROVED (FEAT-10E).
 *
 * `documentType` affects what the document IS (a Lesson note vs. an Exam) —
 * it changes discovery/meaning, so it's material.
 *
 * `subject` is the legacy free-text categorization field. As of this audit,
 * structured `gradeId`/`subjectId`/`lessonId` are NOT editable via
 * `PUT /api/documents/[id]` at all (only `uploadDocument()` sets them, at
 * creation time) — so there is no `subjectId` edit path to classify here.
 * `subject` plays the exact same "what is this filed under" role `subjectId`
 * would for a taxonomy-backed document, so it is classified identically:
 * material. If structured taxonomy editing is ever added to this endpoint,
 * `gradeId`/`subjectId`/`lessonId` must be added to this set too.
 *
 * Everything else PUT can currently change — `title`, `description`,
 * `academicYear` — is a correction/metadata field: changing it doesn't
 * change what the document teaches or how it's categorized, so the document
 * can stay published without another review.
 *
 * File replacement does not currently exist on this endpoint (no file field
 * in `updateDocumentSchema`, no file-handling code in the PUT route) — not
 * built here, per FEAT-10E's scope. Any future file-replacement feature
 * must be treated as material and trigger re-review.
 */
const MATERIAL_DOCUMENT_FIELDS = new Set<keyof UpdateDocumentInput>(["subject", "documentType"]);

export type DocumentChangeSource = {
  title: string;
  description: string | null;
  subject: string;
  documentType: string;
  academicYear: string;
};

export type DocumentChangeClassification = {
  /** Only fields whose value actually differs from `current` — a field resubmitted with its existing value is never "changed". */
  changedFields: (keyof UpdateDocumentInput)[];
  hasMaterialChange: boolean;
};

/**
 * Compares actual old vs. new values, never merely "field present in the
 * request" — resubmitting a field with its current value is correctly
 * treated as no change, so it never triggers unnecessary re-review
 * (FEAT-10E §13/§14). A request that changes both minor and material
 * fields is treated as material as a whole (§12) — this function doesn't
 * special-case that; the caller just checks `hasMaterialChange`.
 */
export function getDocumentChangeClassification(
  current: DocumentChangeSource,
  updates: UpdateDocumentInput
): DocumentChangeClassification {
  const changedFields: (keyof UpdateDocumentInput)[] = [];

  for (const key of Object.keys(updates) as (keyof UpdateDocumentInput)[]) {
    const newValue = updates[key];
    if (newValue === undefined) continue;
    if (newValue !== current[key]) changedFields.push(key);
  }

  return {
    changedFields,
    hasMaterialChange: changedFields.some((field) => MATERIAL_DOCUMENT_FIELDS.has(field)),
  };
}
