import type { AuditAction, AuditEntityType } from "@prisma/client";

/** Plain string-literal list (not a `@prisma/client` runtime import), matching `DOCUMENT_TYPE_VALUES`/`REPORT_REASON_VALUES`'s established convention — usable for both filter-dropdown options and validating a query-param before it ever reaches Prisma. */
export const AUDIT_ENTITY_TYPE_VALUES: AuditEntityType[] = ["USER", "DOCUMENT", "COMMENT", "REPORT"];

/** Every AuditAction that currently exists — the one single source of truth used to validate a query-param filter and to build the filter dropdown's options. Kept as an explicit list (not derived from a labels map) now that the labels themselves live in the locale message files. */
export const AUDIT_ACTION_VALUES: AuditAction[] = [
  "USER_REGISTERED",
  "USER_LOGGED_IN",
  "USER_LOGIN_FAILED",
  "PASSWORD_CHANGED",
  "PROFILE_UPDATED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_UPDATED",
  "DOCUMENT_DELETED",
  "DOCUMENT_APPROVED",
  "DOCUMENT_REJECTED",
  "DOCUMENT_RESUBMITTED",
  "COMMENT_CREATED",
  "COMMENT_UPDATED",
  "COMMENT_DELETED",
  "REPORT_CREATED",
];

/** FEAT-13: the actual readable copy now lives in the locale message files (`auditLog.actions.*`/`auditLog.entities.*` — see src/i18n/messages/*.json). The Admin UI never shows a raw enum name (FEAT-11 §30) — that guarantee now lives in always calling these before display, not in a static labels map. Explicit literal-union return types (not a generic camelCase string transform) so next-intl's strict typed message keys can verify every call site at compile time. */
const AUDIT_ACTION_MESSAGE_KEYS = {
  USER_REGISTERED: "userRegistered",
  USER_LOGGED_IN: "userLoggedIn",
  USER_LOGIN_FAILED: "userLoginFailed",
  PASSWORD_CHANGED: "passwordChanged",
  PROFILE_UPDATED: "profileUpdated",
  DOCUMENT_UPLOADED: "documentUploaded",
  DOCUMENT_UPDATED: "documentUpdated",
  DOCUMENT_DELETED: "documentDeleted",
  DOCUMENT_APPROVED: "documentApproved",
  DOCUMENT_REJECTED: "documentRejected",
  DOCUMENT_RESUBMITTED: "documentResubmitted",
  COMMENT_CREATED: "commentCreated",
  COMMENT_UPDATED: "commentUpdated",
  COMMENT_DELETED: "commentDeleted",
  REPORT_CREATED: "reportCreated",
} as const satisfies Record<AuditAction, string>;

const AUDIT_ENTITY_TYPE_MESSAGE_KEYS = {
  USER: "user",
  DOCUMENT: "document",
  COMMENT: "comment",
  REPORT: "report",
} as const satisfies Record<AuditEntityType, string>;

export function auditActionMessageKey(action: AuditAction): (typeof AUDIT_ACTION_MESSAGE_KEYS)[AuditAction] {
  return AUDIT_ACTION_MESSAGE_KEYS[action];
}

export function auditEntityTypeMessageKey(
  entityType: AuditEntityType
): (typeof AUDIT_ENTITY_TYPE_MESSAGE_KEYS)[AuditEntityType] {
  return AUDIT_ENTITY_TYPE_MESSAGE_KEYS[entityType];
}
