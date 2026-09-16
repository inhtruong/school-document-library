import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    documentReport: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";
import { dismissReport, getAdminReportById, listAdminReports, resolveReport } from "@/lib/admin/reports";

const ACTOR = { id: "admin_1", email: "admin@example.com", role: "ADMIN" as const };
const now = new Date("2026-01-01T00:00:00.000Z");

const OPEN_REPORT = {
  id: "report_1",
  reason: "BROKEN_FILE" as const,
  description: null,
  status: "OPEN" as const,
  createdAt: now,
  updatedAt: now,
  documentId: "doc_1",
  document: { id: "doc_1", title: "Database Final Exam" },
  user: { id: "student_1", name: "Sam Student" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAdminReports", () => {
  test("returns a page of reports", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([OPEN_REPORT] as never);
    vi.mocked(prisma.documentReport.count).mockResolvedValue(1);

    const result = await listAdminReports({}, 1);

    expect(result).toEqual({ reports: [OPEN_REPORT], total: 1, page: 1, totalPages: 1 });
  });

  test("paginates using skip/take", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.documentReport.count).mockResolvedValue(45);

    const result = await listAdminReports({}, 3);

    const call = vi.mocked(prisma.documentReport.findMany).mock.calls[0]![0]!;
    expect(call.skip).toBe(40);
    expect(call.take).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  test("OPEN reports sort oldest-first (fair queue)", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.documentReport.count).mockResolvedValue(0);

    await listAdminReports({ status: "OPEN" }, 1);

    const call = vi.mocked(prisma.documentReport.findMany).mock.calls[0]![0]!;
    expect(call.orderBy).toEqual({ createdAt: "asc" });
    expect(call.where).toMatchObject({ status: "OPEN" });
  });

  test("RESOLVED/DISMISSED reports sort newest-first", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.documentReport.count).mockResolvedValue(0);

    await listAdminReports({ status: "RESOLVED" }, 1);

    const call = vi.mocked(prisma.documentReport.findMany).mock.calls[0]![0]!;
    expect(call.orderBy).toEqual({ createdAt: "desc" });
  });

  test("filters by reason", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.documentReport.count).mockResolvedValue(0);

    await listAdminReports({ reason: "COPYRIGHT" }, 1);

    const call = vi.mocked(prisma.documentReport.findMany).mock.calls[0]![0]!;
    expect(call.where).toMatchObject({ reason: "COPYRIGHT" });
  });

  test("searches by the reported document's title, case-insensitively", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.documentReport.count).mockResolvedValue(0);

    await listAdminReports({ search: "exam" }, 1);

    const call = vi.mocked(prisma.documentReport.findMany).mock.calls[0]![0]!;
    expect(call.where).toMatchObject({ document: { title: { contains: "exam", mode: "insensitive" } } });
  });
});

describe("getAdminReportById", () => {
  test("returns an OPEN report without an audit lookup", async () => {
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue({
      ...OPEN_REPORT,
      document: { id: "doc_1", title: "Database Final Exam", moderationStatus: "APPROVED" },
      user: { id: "student_1", name: "Sam Student", email: "sam@example.com" },
    } as never);

    const result = await getAdminReportById("report_1");

    expect(result).toMatchObject({ id: "report_1", status: "OPEN" });
    expect(prisma.auditLog.findFirst).not.toHaveBeenCalled();
  });

  test("returns a RESOLVED report with resolvedBy/resolvedAt from the audit trail", async () => {
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue({
      ...OPEN_REPORT,
      status: "RESOLVED",
      document: { id: "doc_1", title: "Database Final Exam", moderationStatus: "APPROVED" },
      user: { id: "student_1", name: "Sam Student", email: "sam@example.com" },
    } as never);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({
      actorEmail: "admin@example.com",
      createdAt: now,
    } as never);

    const result = await getAdminReportById("report_1");

    expect(result).toMatchObject({ status: "RESOLVED", resolvedByEmail: "admin@example.com" });
    expect(prisma.auditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entityType: "REPORT",
          entityId: "report_1",
          action: { in: ["REPORT_RESOLVED", "REPORT_DISMISSED"] },
        }),
      })
    );
  });

  test("returns null for a nonexistent report", async () => {
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue(null as never);

    const result = await getAdminReportById("missing");

    expect(result).toBeNull();
  });
});

describe("resolveReport / dismissReport", () => {
  test("resolveReport transitions OPEN -> RESOLVED and writes an audit row", async () => {
    vi.mocked(prisma.documentReport.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue({
      ...OPEN_REPORT,
      status: "RESOLVED",
    } as never);

    const result = await resolveReport("report_1", ACTOR);

    expect(result.outcome).toBe("success");
    expect(prisma.documentReport.updateMany).toHaveBeenCalledWith({
      where: { id: "report_1", status: "OPEN" },
      data: { status: "RESOLVED" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REPORT_RESOLVED", entityType: "REPORT", entityId: "report_1" }),
      })
    );
  });

  test("dismissReport transitions OPEN -> DISMISSED and writes an audit row", async () => {
    vi.mocked(prisma.documentReport.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue({
      ...OPEN_REPORT,
      status: "DISMISSED",
    } as never);

    const result = await dismissReport("report_1", ACTOR);

    expect(result.outcome).toBe("success");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REPORT_DISMISSED" }),
      })
    );
  });

  test("returns not-found when the report does not exist", async () => {
    vi.mocked(prisma.documentReport.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue(null as never);

    const result = await resolveReport("missing", ACTOR);

    expect(result.outcome).toBe("not-found");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test("returns already-handled when the report is no longer OPEN", async () => {
    vi.mocked(prisma.documentReport.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue({ ...OPEN_REPORT, status: "DISMISSED" } as never);

    const result = await resolveReport("report_1", ACTOR);

    expect(result.outcome).toBe("already-handled");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test("audit metadata includes oldStatus/newStatus/reportReason/documentId, never the description body", async () => {
    vi.mocked(prisma.documentReport.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.documentReport.findUnique).mockResolvedValue({
      ...OPEN_REPORT,
      description: "Sensitive free-text description",
      status: "RESOLVED",
    } as never);

    await resolveReport("report_1", ACTOR);

    const call = vi.mocked(prisma.auditLog.create).mock.calls[0]![0]! as { data: { metadata: Record<string, unknown> } };
    expect(call.data.metadata).toEqual({
      oldStatus: "OPEN",
      newStatus: "RESOLVED",
      reportReason: "BROKEN_FILE",
      documentId: "doc_1",
    });
  });
});
