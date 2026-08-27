import "server-only";
import type { Session } from "next-auth";

/**
 * Listing-query filter (concern A from FEAT-10A's spec: "listing filter:
 * APPROVED only"). Spread directly into any `where`/`groupBy` clause for a
 * public document listing or aggregate — never fetch-then-filter in JS.
 */
export const APPROVED_DOCUMENT_WHERE = { moderationStatus: "APPROVED" as const };

/**
 * Single-document authorization (concern B: "approved OR owner OR admin").
 * Takes an already-fetched document's moderationStatus/uploadedById —
 * never queries the DB itself, so callers fold these two fields into
 * whatever `select`/`include` they already use instead of adding a second
 * query. A PENDING/REJECTED document is visible only to its uploader or
 * an ADMIN; everyone else (including guests) gets the same "not visible"
 * result a genuinely missing document would produce — callers should
 * respond with 404, never a different status, to avoid letting moderation
 * state be enumerated.
 */
export function isDocumentVisibleTo(
  document: { moderationStatus: string; uploadedById: string | null },
  session: Session | null
): boolean {
  if (document.moderationStatus === "APPROVED") return true;
  if (!session?.user) return false;
  if (session.user.role === "ADMIN") return true;
  return document.uploadedById !== null && document.uploadedById === session.user.id;
}
