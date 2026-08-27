import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  approveDocument,
  getModerationDocumentById,
  listModerationDocuments,
  rejectDocument,
} from "@/lib/moderation/moderation";

const now = new Date("2026-01-01T00:00:00.000Z");

const mockRow = {
  id: "doc_1",
  title: "Test Document",
  moderationStatus: "PENDING" as const,
  documentType: "EXAM",
  academicYear: "2025-2026",
  fileName: "test.pdf",
  fileSize: 1024,
  fileCategory: "PDF" as const,
  createdAt: now,
  reviewedAt: null,
  uploadedBy: { id: "teacher_1", name: "Tara Teacher", role: "TEACHER" },
  grade: { name: "Grade 11" },
  subjectRef: { name: "Mathematics" },
  lesson: { name: "Derivatives" },
  reviewedBy: null,
  description: "A test document",
  mimeType: "application/pdf",
  rejectionReason: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listModerationDocuments", () => {
  test("filters explicitly by the requested status, not APPROVED-only", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listModerationDocuments("PENDING", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.where).toEqual({ moderationStatus: "PENDING" });
  });

  test("PENDING sorts oldest-first (fair review queue)", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listModerationDocuments("PENDING", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.orderBy).toEqual({ createdAt: "asc" });
  });

  test("APPROVED sorts by most-recently-reviewed first", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listModerationDocuments("APPROVED", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.orderBy).toEqual({ reviewedAt: "desc" });
  });

  test("never selects fileKey", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listModerationDocuments("PENDING", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0] as { select: Record<string, unknown> };
    expect(call.select).not.toHaveProperty("fileKey");
  });

  test("computes pagination from the requested page and total count", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(45);

    const result = await listModerationDocuments("PENDING", 2);

    expect(result.page).toBe(2);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3);
  });

  test("maps rows into serialized list items", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([mockRow] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(1);

    const result = await listModerationDocuments("PENDING", 1);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe("doc_1");
    expect(result.documents[0].createdAt).toBe(now.toISOString());
  });
});

describe("getModerationDocumentById", () => {
  test("returns null for a missing document", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const result = await getModerationDocumentById("missing");

    expect(result).toBeNull();
  });

  test("returns full detail, including description/mimeType/rejectionReason, for any status", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockRow as never);

    const result = await getModerationDocumentById("doc_1");

    expect(result?.description).toBe("A test document");
    expect(result?.mimeType).toBe("application/pdf");
    expect(result?.rejectionReason).toBeNull();
  });

  test("does not filter by moderationStatus — Admin may inspect PENDING, APPROVED, or REJECTED alike", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ...mockRow, moderationStatus: "REJECTED" } as never);

    await getModerationDocumentById("doc_1");

    const call = vi.mocked(prisma.document.findUnique).mock.calls[0][0];
    expect(call?.where).toEqual({ id: "doc_1" });
  });
});

describe("approveDocument", () => {
  test("transitions PENDING to APPROVED, sets reviewedAt/reviewedById, clears rejectionReason, in one atomic call", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    const result = await approveDocument("doc_1", "admin_1");

    expect(result.outcome).toBe("success");
    expect(prisma.document.updateMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.document.updateMany).mock.calls[0][0];
    expect(call.where).toEqual({ id: "doc_1", moderationStatus: "PENDING" });
    expect(call.data).toEqual({
      moderationStatus: "APPROVED",
      reviewedAt: expect.any(Date),
      reviewedById: "admin_1",
      rejectionReason: null,
    });
  });

  test("a non-PENDING document (count 0, but exists) returns not-pending", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: "doc_1" } as never);

    const result = await approveDocument("doc_1", "admin_1");

    expect(result.outcome).toBe("not-pending");
  });

  test("a missing document (count 0, does not exist) returns not-found", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const result = await approveDocument("missing", "admin_1");

    expect(result.outcome).toBe("not-found");
  });

  test("concurrency: only one of two simultaneous approve attempts on the same document wins", async () => {
    // The FIRST updateMany call "wins" the atomic conditional update (matches
    // count: 1); a SECOND concurrent call against the same now-already-APPROVED
    // row would match zero rows in the real DB — simulated here by the second
    // mocked call resolving count: 0, then existing.
    vi.mocked(prisma.document.updateMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: "doc_1" } as never);

    const [first, second] = await Promise.all([
      approveDocument("doc_1", "admin_1"),
      approveDocument("doc_1", "admin_2"),
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["not-pending", "success"]);
  });
});

describe("rejectDocument", () => {
  test("transitions PENDING to REJECTED with the validated reason, in one atomic call", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    const result = await rejectDocument("doc_1", "admin_1", { reason: "Wrong grade level" });

    expect(result.outcome).toBe("success");
    const call = vi.mocked(prisma.document.updateMany).mock.calls[0][0];
    expect(call.where).toEqual({ id: "doc_1", moderationStatus: "PENDING" });
    expect(call.data).toEqual({
      moderationStatus: "REJECTED",
      reviewedAt: expect.any(Date),
      reviewedById: "admin_1",
      rejectionReason: "Wrong grade level",
    });
  });

  test("trims the reason before storing it", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    await rejectDocument("doc_1", "admin_1", { reason: "  needs work  " });

    const call = vi.mocked(prisma.document.updateMany).mock.calls[0][0];
    expect(call.data.rejectionReason).toBe("needs work");
  });

  test("rejects a whitespace-only reason without touching the database", async () => {
    const result = await rejectDocument("doc_1", "admin_1", { reason: "   " });

    expect(result.outcome).toBe("invalid");
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  test("rejects a missing reason without touching the database", async () => {
    const result = await rejectDocument("doc_1", "admin_1", {});

    expect(result.outcome).toBe("invalid");
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  test("rejects a reason longer than 1000 characters", async () => {
    const result = await rejectDocument("doc_1", "admin_1", { reason: "a".repeat(1001) });

    expect(result.outcome).toBe("invalid");
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  test("accepts a reason at exactly the 1000 character limit", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    const result = await rejectDocument("doc_1", "admin_1", { reason: "a".repeat(1000) });

    expect(result.outcome).toBe("success");
  });

  test("a non-PENDING document returns not-pending", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: "doc_1" } as never);

    const result = await rejectDocument("doc_1", "admin_1", { reason: "test" });

    expect(result.outcome).toBe("not-pending");
  });

  test("a missing document returns not-found", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const result = await rejectDocument("missing", "admin_1", { reason: "test" });

    expect(result.outcome).toBe("not-found");
  });

  test("always targets the reviewerId argument, ignoring any reviewedById in the input", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    await rejectDocument("doc_1", "real-admin-id", { reason: "test", reviewedById: "attacker-controlled-id" });

    const call = vi.mocked(prisma.document.updateMany).mock.calls[0][0];
    expect(call.data.reviewedById).toBe("real-admin-id");
  });
});
