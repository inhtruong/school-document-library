import "server-only";
import type { DocumentModerationStatus, Prisma, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditActor } from "@/lib/audit/audit";
import { writeAuditLog } from "@/lib/audit/audit";
import type { ReportReasonValue } from "@/lib/documents/report-reason";
import { ADMIN_REPORTS_PAGE_SIZE } from "@/lib/admin/admin-reports-config";

export type AdminReportFilter = { status?: ReportStatus; reason?: ReportReasonValue; search?: string };

export type AdminReportListItem = {
  id: string;
  reason: ReportReasonValue;
  description: string | null;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
  document: { id: string; title: string };
  user: { id: string; name: string };
};

export type AdminReportListPage = {
  reports: AdminReportListItem[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * Admin-only browse — same "one status at a time, filtered in SQL" contract
 * as `listModerationDocuments()`. OPEN sorts oldest-first (fair queue,
 * matches PENDING documents); RESOLVED/DISMISSED sort newest-first (recent
 * history first). Search matches the reported Document's title only —
 * reporter identity search is deliberately not implemented (see plan).
 */
export async function listAdminReports(filter: AdminReportFilter, page: number): Promise<AdminReportListPage> {
  const skip = (page - 1) * ADMIN_REPORTS_PAGE_SIZE;
  const where: Prisma.DocumentReportWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.reason ? { reason: filter.reason } : {}),
    ...(filter.search ? { document: { title: { contains: filter.search, mode: "insensitive" } } } : {}),
  };
  const orderBy: Prisma.DocumentReportOrderByWithRelationInput =
    filter.status && filter.status !== "OPEN" ? { createdAt: "desc" } : { createdAt: "asc" };

  const [reports, total] = await Promise.all([
    prisma.documentReport.findMany({
      where,
      orderBy,
      skip,
      take: ADMIN_REPORTS_PAGE_SIZE,
      select: {
        id: true,
        reason: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        document: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.documentReport.count({ where }),
  ]);

  return {
    reports: reports as AdminReportListItem[],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_REPORTS_PAGE_SIZE)),
  };
}

export type AdminReportDetail = AdminReportListItem & {
  document: { id: string; title: string; moderationStatus: DocumentModerationStatus };
  user: { id: string; name: string; email: string };
  resolvedByEmail: string | null;
  resolvedAt: Date | null;
};

/**
 * One query for the report itself, plus — only when the report has already
 * left OPEN — one extra `auditLog.findFirst()` to surface who handled it
 * and when. No new Report columns: `updatedAt` already doubles as the
 * handled timestamp (the only mutation a Report ever gets IS this
 * transition), and the AuditLog row the transition writes is the durable
 * "who" record — reused here rather than duplicated onto the Report row.
 */
export async function getAdminReportById(id: string): Promise<AdminReportDetail | null> {
  const report = await prisma.documentReport.findUnique({
    where: { id },
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      document: { select: { id: true, title: true, moderationStatus: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!report) return null;

  let resolvedByEmail: string | null = null;
  let resolvedAt: Date | null = null;
  if (report.status !== "OPEN") {
    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: "REPORT", entityId: id, action: { in: ["REPORT_RESOLVED", "REPORT_DISMISSED"] } },
      orderBy: { createdAt: "desc" },
      select: { actorEmail: true, createdAt: true },
    });
    resolvedByEmail = auditRow?.actorEmail ?? null;
    resolvedAt = auditRow?.createdAt ?? report.updatedAt;
  }

  return { ...(report as AdminReportDetail), resolvedByEmail, resolvedAt };
}

export type UpdateReportStatusOutcome = { outcome: "success" } | { outcome: "not-found" } | { outcome: "already-handled" };

/**
 * ADMIN-only, terminal transition — OPEN is the only status a report can
 * transition FROM; RESOLVED/DISMISSED are terminal (no reopening). Same
 * atomic-guard shape as `approveDocument()`/`rejectDocument()`: the
 * `updateMany({ where: { id, status: "OPEN" } })` guard makes a concurrent
 * second Admin's attempt land on the exact same `already-handled` outcome
 * as a report that was simply already resolved — no special-casing needed.
 * Never touches the reported Document in any way.
 */
async function updateReportStatus(
  reportId: string,
  newStatus: "RESOLVED" | "DISMISSED",
  actor: AuditActor
): Promise<UpdateReportStatusOutcome> {
  const transitioned = await prisma.$transaction(async (tx) => {
    const result = await tx.documentReport.updateMany({
      where: { id: reportId, status: "OPEN" },
      data: { status: newStatus },
    });
    if (result.count !== 1) return false;

    const report = await tx.documentReport.findUnique({
      where: { id: reportId },
      select: { reason: true, documentId: true },
    });
    if (!report) throw new Error(`Report ${reportId} vanished mid-transaction after a successful transition`);

    await writeAuditLog(
      {
        actor,
        action: newStatus === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_DISMISSED",
        entityType: "REPORT",
        entityId: reportId,
        metadata: { oldStatus: "OPEN", newStatus, reportReason: report.reason, documentId: report.documentId },
      },
      tx
    );

    return true;
  });

  if (transitioned) return { outcome: "success" };

  const existing = await prisma.documentReport.findUnique({ where: { id: reportId }, select: { id: true } });
  return existing ? { outcome: "already-handled" } : { outcome: "not-found" };
}

export function resolveReport(reportId: string, actor: AuditActor): Promise<UpdateReportStatusOutcome> {
  return updateReportStatus(reportId, "RESOLVED", actor);
}

export function dismissReport(reportId: string, actor: AuditActor): Promise<UpdateReportStatusOutcome> {
  return updateReportStatus(reportId, "DISMISSED", actor);
}
