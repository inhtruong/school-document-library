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
  getRejectionReasonForViewer,
  listTeacherUploads,
  resubmitDocument,
} from "@/lib/documents/teacher-uploads";

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
  rejectionReason: null,
  grade: { name: "Grade 11" },
  subjectRef: { name: "Mathematics" },
  lesson: { name: "Derivatives" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTeacherUploads", () => {
  test("always scopes the query by uploadedById, never trusting a client-supplied id", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listTeacherUploads("teacher_1", "ALL", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.where).toEqual({ uploadedById: "teacher_1" });
  });

  test("ALL filter does not add a moderationStatus constraint", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listTeacherUploads("teacher_1", "ALL", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.where).not.toHaveProperty("moderationStatus");
  });

  test.each(["PENDING", "APPROVED", "REJECTED"] as const)(
    "%s filter scopes by both uploadedById and moderationStatus",
    async (status) => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([]);
      vi.mocked(prisma.document.count).mockResolvedValue(0);

      await listTeacherUploads("teacher_1", status, 1);

      const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
      expect(call?.where).toEqual({ uploadedById: "teacher_1", moderationStatus: status });
    }
  );

  test("sorts newest-upload-first regardless of filter", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listTeacherUploads("teacher_1", "REJECTED", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.orderBy).toEqual({ createdAt: "desc" });
  });

  test("never selects fileKey or reviewedById", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listTeacherUploads("teacher_1", "ALL", 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0] as { select: Record<string, unknown> };
    expect(call.select).not.toHaveProperty("fileKey");
    expect(call.select).not.toHaveProperty("reviewedById");
  });

  test("computes pagination from the requested page and total count", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(25);

    const result = await listTeacherUploads("teacher_1", "ALL", 2);

    expect(result.page).toBe(2);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  test("maps rows into serialized list items, including the own rejection reason", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ ...mockRow, rejectionReason: "Wrong grade" }] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(1);

    const result = await listTeacherUploads("teacher_1", "REJECTED", 1);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe("doc_1");
    expect(result.documents[0].rejectionReason).toBe("Wrong grade");
    expect(result.documents[0].createdAt).toBe(now.toISOString());
  });
});

describe("getRejectionReasonForViewer", () => {
  test("returns the stored reason", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ rejectionReason: "Unreadable scan" } as never);

    const result = await getRejectionReasonForViewer("doc_1");

    expect(result).toBe("Unreadable scan");
  });

  test("returns null for a missing document instead of throwing", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const result = await getRejectionReasonForViewer("missing");

    expect(result).toBeNull();
  });
});

describe("resubmitDocument", () => {
  test("transitions REJECTED to PENDING and clears all review metadata, in one atomic call", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    const result = await resubmitDocument("teacher_1", "doc_1");

    expect(result.outcome).toBe("success");
    expect(prisma.document.updateMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.document.updateMany).mock.calls[0][0];
    expect(call.where).toEqual({ id: "doc_1", uploadedById: "teacher_1", moderationStatus: "REJECTED" });
    expect(call.data).toEqual({
      moderationStatus: "PENDING",
      reviewedAt: null,
      reviewedById: null,
      rejectionReason: null,
    });
  });

  test("a PENDING document (not REJECTED) returns not-rejected", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      uploadedById: "teacher_1",
      moderationStatus: "PENDING",
    } as never);

    const result = await resubmitDocument("teacher_1", "doc_1");

    expect(result.outcome).toBe("not-rejected");
  });

  test("an APPROVED document returns not-rejected", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      uploadedById: "teacher_1",
      moderationStatus: "APPROVED",
    } as never);

    const result = await resubmitDocument("teacher_1", "doc_1");

    expect(result.outcome).toBe("not-rejected");
  });

  test("a document belonging to another Teacher returns forbidden, never resubmitting it", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      uploadedById: "other_teacher",
      moderationStatus: "REJECTED",
    } as never);

    const result = await resubmitDocument("teacher_1", "doc_1");

    expect(result.outcome).toBe("forbidden");
  });

  test("a missing document returns not-found", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const result = await resubmitDocument("teacher_1", "missing");

    expect(result.outcome).toBe("not-found");
  });

  test("concurrency: only one of two simultaneous resubmit attempts on the same document wins", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      uploadedById: "teacher_1",
      moderationStatus: "REJECTED",
    } as never);

    const [first, second] = await Promise.all([
      resubmitDocument("teacher_1", "doc_1"),
      resubmitDocument("teacher_1", "doc_1"),
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["not-rejected", "success"]);
  });
});
