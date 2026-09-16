import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentReport: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { createReport, getMyOpenReportReasons } from "@/lib/documents/report";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
});

describe("createReport", () => {
  test("creates a report with status OPEN when no duplicate exists", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.documentReport.create).mockResolvedValue(
      { id: "report_1", reason: "BROKEN_FILE", status: "OPEN" } as never
    );

    const result = await createReport("doc_1", "user_1", "BROKEN_FILE", null);

    expect(result).toEqual({ outcome: "created", report: { id: "report_1", reason: "BROKEN_FILE", status: "OPEN" } });
    expect(prisma.documentReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { documentId: "doc_1", userId: "user_1", reason: "BROKEN_FILE", description: null, status: "OPEN" },
      })
    );
  });

  test("returns duplicate when an OPEN report already exists for the same documentId/userId/reason", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue({ id: "existing" } as never);

    const result = await createReport("doc_1", "user_1", "BROKEN_FILE", null);

    expect(result).toEqual({ outcome: "duplicate" });
    expect(prisma.documentReport.create).not.toHaveBeenCalled();
  });

  test("checks duplicates scoped to OPEN status only", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.documentReport.create).mockResolvedValue(
      { id: "report_2", reason: "BROKEN_FILE", status: "OPEN" } as never
    );

    await createReport("doc_1", "user_1", "BROKEN_FILE", null);

    expect(prisma.documentReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: "doc_1", userId: "user_1", reason: "BROKEN_FILE", status: "OPEN" } })
    );
  });

  test("treats a unique-constraint violation from a race condition as a duplicate, not a crash", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.documentReport.create).mockRejectedValue({ code: "P2002" });

    const result = await createReport("doc_1", "user_1", "BROKEN_FILE", null);

    expect(result).toEqual({ outcome: "duplicate" });
  });

  test("rethrows an unrelated database error", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.documentReport.create).mockRejectedValue(new Error("connection refused"));

    await expect(createReport("doc_1", "user_1", "BROKEN_FILE", null)).rejects.toThrow("connection refused");
  });

  test("with an actor, writes a REPORT_CREATED audit row without the free-text description (FEAT-11)", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.documentReport.create).mockResolvedValue(
      { id: "report_1", reason: "OTHER", status: "OPEN" } as never
    );

    await createReport("doc_1", "user_1", "OTHER", "a very specific private complaint", {
      id: "user_1",
      email: "student@example.com",
      role: "STUDENT",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_1",
        actorEmail: "student@example.com",
        actorRole: "STUDENT",
        action: "REPORT_CREATED",
        entityType: "REPORT",
        entityId: "report_1",
        status: "SUCCESS",
        metadata: { documentId: "doc_1", reason: "OTHER" },
      },
    });
    expect(JSON.stringify(vi.mocked(prisma.auditLog.create).mock.calls[0][0])).not.toContain(
      "a very specific private complaint"
    );
  });

  test("allows a new report for the same user/document/reason once the prior one is no longer OPEN (FEAT-15E)", async () => {
    // The duplicate check is scoped to status: "OPEN" (see the "checks duplicates
    // scoped to OPEN status only" test above), so once the earlier report has been
    // resolved/dismissed, findFirst correctly finds nothing and a fresh report may
    // be created — this locks in that existing, unmodified behavior.
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.documentReport.create).mockResolvedValue(
      { id: "report_3", reason: "BROKEN_FILE", status: "OPEN" } as never
    );

    const result = await createReport("doc_1", "user_1", "BROKEN_FILE", null);

    expect(result).toEqual({ outcome: "created", report: { id: "report_3", reason: "BROKEN_FILE", status: "OPEN" } });
  });

  test("a duplicate report never writes an audit row", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue({ id: "existing" } as never);

    await createReport("doc_1", "user_1", "BROKEN_FILE", null, {
      id: "user_1",
      email: "student@example.com",
      role: "STUDENT",
    });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("getMyOpenReportReasons", () => {
  test("returns only the caller's own OPEN report reasons", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([{ reason: "BROKEN_FILE" }, { reason: "OTHER" }] as never);

    const result = await getMyOpenReportReasons("doc_1", "user_1");

    expect(result).toEqual(["BROKEN_FILE", "OTHER"]);
    expect(prisma.documentReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: "doc_1", userId: "user_1", status: "OPEN" } })
    );
  });

  test("returns an empty array when the caller has no open reports", async () => {
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([]);

    const result = await getMyOpenReportReasons("doc_1", "user_1");

    expect(result).toEqual([]);
  });
});
