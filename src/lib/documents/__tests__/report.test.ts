import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentReport: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { createReport, getMyOpenReportReasons } from "@/lib/documents/report";

beforeEach(() => {
  vi.clearAllMocks();
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
