import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    // Test double for prisma.$transaction: invokes the callback with the
    // SAME mocked client, so `tx.document.updateMany` etc. inside
    // resubmitDocument() hit the exact mocks configured below — matches
    // how the real interactive transaction hands every query the same
    // connection/client.
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";
import {
  getRejectionReasonForViewer,
  getTeacherUploadStatusCounts,
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
  sourceType: "FILE" as const,
  createdAt: now,
  reviewedAt: null,
  rejectionReason: null,
  grade: { name: "Grade 11" },
  subjectRef: { name: "Mathematics" },
  lesson: { name: "Derivatives" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
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

describe("getTeacherUploadStatusCounts", () => {
  test("scopes the groupBy query by uploadedById, never trusting a client-supplied id", async () => {
    vi.mocked(prisma.document.groupBy).mockResolvedValue([]);

    await getTeacherUploadStatusCounts("teacher_1");

    const call = vi.mocked(prisma.document.groupBy).mock.calls[0][0];
    expect(call.where).toEqual({ uploadedById: "teacher_1" });
    expect(call.by).toEqual(["moderationStatus"]);
  });

  test("sums per-status groups into total/pending/approved/rejected", async () => {
    vi.mocked(prisma.document.groupBy).mockResolvedValue([
      { moderationStatus: "PENDING", _count: { _all: 2 } },
      { moderationStatus: "APPROVED", _count: { _all: 5 } },
      { moderationStatus: "REJECTED", _count: { _all: 1 } },
    ] as never);

    const result = await getTeacherUploadStatusCounts("teacher_1");

    expect(result).toEqual({ total: 8, pending: 2, approved: 5, rejected: 1 });
  });

  test("a status with no documents stays 0 instead of missing from the result", async () => {
    vi.mocked(prisma.document.groupBy).mockResolvedValue([
      { moderationStatus: "APPROVED", _count: { _all: 3 } },
    ] as never);

    const result = await getTeacherUploadStatusCounts("teacher_1");

    expect(result).toEqual({ total: 3, pending: 0, approved: 3, rejected: 0 });
  });

  test("no uploads at all returns all zeros", async () => {
    vi.mocked(prisma.document.groupBy).mockResolvedValue([]);

    const result = await getTeacherUploadStatusCounts("teacher_1");

    expect(result).toEqual({ total: 0, pending: 0, approved: 0, rejected: 0 });
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
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: "doc_1",
      title: "Test Document",
      uploadedBy: { id: "teacher_1", name: "Tara Teacher" },
    } as never);

    const result = await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1");

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

    const result = await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1");

    expect(result.outcome).toBe("not-rejected");
  });

  test("an APPROVED document returns not-rejected", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      uploadedById: "teacher_1",
      moderationStatus: "APPROVED",
    } as never);

    const result = await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1");

    expect(result.outcome).toBe("not-rejected");
  });

  test("a document belonging to another Teacher returns forbidden, never resubmitting it", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      uploadedById: "other_teacher",
      moderationStatus: "REJECTED",
    } as never);

    const result = await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1");

    expect(result.outcome).toBe("forbidden");
  });

  test("a missing document returns not-found", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const result = await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "missing");

    expect(result.outcome).toBe("not-found");
  });

  test("concurrency: only one of two simultaneous resubmit attempts on the same document wins", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: "doc_1",
      title: "Test Document",
      uploadedById: "teacher_1",
      moderationStatus: "REJECTED",
      uploadedBy: { id: "teacher_1", name: "Tara Teacher" },
    } as never);

    const [first, second] = await Promise.all([
      resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1"),
      resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1"),
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["not-rejected", "success"]);
  });
});

describe("resubmitDocument — pending-review notification (Admin bell)", () => {
  const RESUBMITTED_DOCUMENT_ROW = {
    id: "doc_1",
    title: "Test Document",
    uploadedBy: { id: "teacher_1", name: "Tara Teacher" },
  };

  test("notifies every ADMIN that the document is waiting for review again", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(RESUBMITTED_DOCUMENT_ROW as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }, { id: "admin_2" }] as never);

    const result = await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1");

    expect(result.outcome).toBe("success");
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: Array<{ userId: string; type: string; message: string }>;
    };
    expect(call.data.map((row) => row.userId).sort()).toEqual(["admin_1", "admin_2"]);
    expect(call.data[0].type).toBe("DOCUMENT_PENDING_REVIEW");
    expect(call.data[0].message).toMatch(/resubmitted/i);
  });

  test("FEAT-10F: a resubmit notification failure now rolls back the whole resubmit (transactional) — document stays REJECTED, not silently PENDING with no Admin told", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(RESUBMITTED_DOCUMENT_ROW as never);
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("connection refused"));

    await expect(resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1")).rejects.toThrow();
  });

  test("does not notify Admins when the transition did not succeed", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      uploadedById: "teacher_1",
      moderationStatus: "PENDING",
    } as never);

    await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1");

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("resubmitDocument — FEAT-11 audit log", () => {
  const RESUBMITTED_DOCUMENT_ROW = {
    id: "doc_1",
    title: "Test Document",
    uploadedBy: { id: "teacher_1", name: "Tara Teacher" },
  };

  test("writes a DOCUMENT_RESUBMITTED audit row with the uploader as actor", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(RESUBMITTED_DOCUMENT_ROW as never);

    await resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1");

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "teacher_1",
        actorEmail: "teacher_1@example.com",
        actorRole: "TEACHER",
        action: "DOCUMENT_RESUBMITTED",
        entityType: "DOCUMENT",
        entityId: "doc_1",
        status: "SUCCESS",
        metadata: { documentTitle: "Test Document", fromStatus: "REJECTED", toStatus: "PENDING" },
      },
    });
  });

  test("a failing audit write rolls back the resubmit — document stays REJECTED", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue(RESUBMITTED_DOCUMENT_ROW as never);
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("audit db unavailable"));

    await expect(
      resubmitDocument({ id: "teacher_1", email: "teacher_1@example.com", role: "TEACHER" }, "doc_1")
    ).rejects.toThrow("audit db unavailable");
  });
});
