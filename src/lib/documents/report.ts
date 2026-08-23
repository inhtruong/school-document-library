import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReportReasonValue } from "@/lib/documents/report-reason";

export type CreatedReport = { id: string; reason: ReportReasonValue; status: "OPEN" };

export type CreateReportOutcome = { outcome: "created"; report: CreatedReport } | { outcome: "duplicate" };

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Pre-checks for an existing OPEN report on (documentId, userId, reason)
 * for a friendly 409 in the common case, then relies on the database's
 * partial unique index (see the hand-written migration) as a race-condition
 * safety net — two concurrent submissions could both pass the pre-check,
 * but only one `create()` can win against the DB constraint.
 */
export async function createReport(
  documentId: string,
  userId: string,
  reason: ReportReasonValue,
  description: string | null
): Promise<CreateReportOutcome> {
  const existingOpenReport = await prisma.documentReport.findFirst({
    where: { documentId, userId, reason, status: "OPEN" },
    select: { id: true },
  });
  if (existingOpenReport) return { outcome: "duplicate" };

  try {
    const report = await prisma.documentReport.create({
      data: { documentId, userId, reason, description, status: "OPEN" },
      select: { id: true, reason: true, status: true },
    });
    return { outcome: "created", report: report as CreatedReport };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
}

/** Reasons the caller already has an OPEN report for on this Document — never exposes other users' reports. */
export async function getMyOpenReportReasons(documentId: string, userId: string): Promise<ReportReasonValue[]> {
  const reports = await prisma.documentReport.findMany({
    where: { documentId, userId, status: "OPEN" },
    select: { reason: true },
  });
  return reports.map((report) => report.reason as ReportReasonValue);
}
