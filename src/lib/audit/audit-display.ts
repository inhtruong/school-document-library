import type { AuditAction, AuditEntityType } from "@prisma/client";

/** Plain string-literal list (not a `@prisma/client` runtime import), matching `DOCUMENT_TYPE_VALUES`/`REPORT_REASON_VALUES`'s established convention — usable for both filter-dropdown options and validating a query-param before it ever reaches Prisma. */
export const AUDIT_ENTITY_TYPE_VALUES: AuditEntityType[] = ["USER", "DOCUMENT", "COMMENT", "REPORT"];

export const AUDIT_ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  USER: "User",
  DOCUMENT: "Document",
  COMMENT: "Comment",
  REPORT: "Report",
};

/** Readable copy for each AuditAction — the Admin UI never shows a raw enum name (FEAT-11 §30). */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_REGISTERED: "Registered account",
  USER_LOGGED_IN: "Logged in",
  USER_LOGIN_FAILED: "Failed login attempt",
  PASSWORD_CHANGED: "Changed password",
  PROFILE_UPDATED: "Updated profile",
  DOCUMENT_UPLOADED: "Uploaded document",
  DOCUMENT_UPDATED: "Updated document",
  DOCUMENT_DELETED: "Deleted document",
  DOCUMENT_APPROVED: "Approved document",
  DOCUMENT_REJECTED: "Rejected document",
  DOCUMENT_RESUBMITTED: "Resubmitted document",
  COMMENT_CREATED: "Posted comment",
  COMMENT_UPDATED: "Edited comment",
  COMMENT_DELETED: "Deleted comment",
  REPORT_CREATED: "Reported document",
};

/** Derived from the label map's own keys — one single source of truth for "every AuditAction that currently exists," used to validate a query-param filter and to build the filter dropdown's options. */
export const AUDIT_ACTION_VALUES = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];
