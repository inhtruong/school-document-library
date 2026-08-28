import type { DocumentModerationStatus } from "@prisma/client";

/**
 * Single color source for the moderation "status rail" — the colored left
 * edge reused across /moderation, /my-uploads, and the /documents/[id]
 * status panel, so a document's review state reads the same way at a
 * glance everywhere it appears, before any label is even read. Values
 * mirror the existing success/warning/destructive design tokens
 * (globals.css) exactly — no new colors introduced.
 */
export const MODERATION_STATUS_COLOR: Record<DocumentModerationStatus, string> = {
  PENDING: "#b45309",
  APPROVED: "#15803d",
  REJECTED: "#b91c1c",
};
