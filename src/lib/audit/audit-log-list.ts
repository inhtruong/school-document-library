import "server-only";
import type { AuditAction, AuditEntityType, AuditStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_LOG_PAGE_SIZE } from "@/lib/audit/audit-log-config";

export type AuditLogFilter = {
  action?: AuditAction;
  entityType?: AuditEntityType;
  /** Substring, case-insensitive match against the actorEmail snapshot — never a live User lookup. */
  actorEmail?: string;
};

export type AuditLogListItem = {
  id: string;
  actorEmail: string | null;
  actorRole: Role | null;
  action: AuditAction;
  entityType: AuditEntityType | null;
  entityId: string | null;
  status: AuditStatus;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
  /** The Document this row is about — `entityId` for a DOCUMENT-typed row, or `metadata.documentId` for a COMMENT/REPORT row. Null when the action has no associated Document (account events). */
  linkedDocumentId: string | null;
  /** False when `linkedDocumentId` no longer exists (or is null) — the Admin UI renders plain text instead of a link in that case (FEAT-11 §19/§31), without a per-row existence query. */
  linkedDocumentExists: boolean;
};

export type AuditLogPage = {
  logs: AuditLogListItem[];
  total: number;
  page: number;
  totalPages: number;
};

function extractMetadataDocumentId(metadata: Prisma.JsonValue | null): string | null {
  if (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    typeof (metadata as Record<string, unknown>).documentId === "string"
  ) {
    return (metadata as Record<string, unknown>).documentId as string;
  }
  return null;
}

function linkedDocumentIdFor(row: {
  entityType: AuditEntityType | null;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
}): string | null {
  if (row.entityType === "DOCUMENT") return row.entityId;
  if (row.entityType === "COMMENT" || row.entityType === "REPORT") return extractMetadataDocumentId(row.metadata);
  return null;
}

/**
 * Admin-only history read — newest first, always capped at
 * AUDIT_LOG_PAGE_SIZE, SQL-side filtering (never fetch-all-then-filter in
 * JS). Callers MUST have already validated `filter.action`/`entityType`
 * against the real enum values before calling (see the page's own
 * `parseAction`/`parseEntityType`) — this function trusts its input is
 * already a valid enum member, matching `listModerationDocuments`'s
 * established contract.
 *
 * The one extra `document.findMany` batches an existence check for every
 * Document this page's rows reference (via `entityId` or a `documentId` in
 * metadata) in a SINGLE query — not a per-row query — so a page of 25 rows
 * costs exactly 3 queries total (rows, count, existence), never N+1
 * (FEAT-11 §41). No User/Document JOIN is used to build the actor/entity
 * display itself — every row already carries its own actorEmail/actorRole
 * snapshot, which is the entire point of snapshotting at write time.
 */
export async function listAuditLogs(filter: AuditLogFilter, page: number): Promise<AuditLogPage> {
  const skip = (page - 1) * AUDIT_LOG_PAGE_SIZE;
  const where: Prisma.AuditLogWhereInput = {
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.actorEmail ? { actorEmail: { contains: filter.actorEmail, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: AUDIT_LOG_PAGE_SIZE,
      select: {
        id: true,
        actorEmail: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const documentIds = Array.from(
    new Set(rows.map(linkedDocumentIdFor).filter((id): id is string => id !== null))
  );
  const existing =
    documentIds.length > 0
      ? await prisma.document.findMany({ where: { id: { in: documentIds } }, select: { id: true } })
      : [];
  const existingIds = new Set(existing.map((document) => document.id));

  return {
    logs: rows.map((row) => {
      const linkedDocumentId = linkedDocumentIdFor(row);
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        linkedDocumentId,
        linkedDocumentExists: linkedDocumentId !== null && existingIds.has(linkedDocumentId),
      };
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE)),
  };
}
