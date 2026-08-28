import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    teacherFollow: { findMany: vi.fn() },
    lessonFollow: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), deleteMany: vi.fn() },
    // Test double for prisma.$transaction: just invokes the callback with
    // the SAME mocked client, so `tx.document.updateMany` etc. inside
    // approveDocument() hit the exact mocks configured below — matches how
    // the real interactive transaction hands every query the same
    // connection/client.
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

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

const APPROVE_DOCUMENT_ROW = {
  id: "doc_1",
  title: "Test Document",
  lessonId: "lesson_1",
  lesson: { name: "Derivatives" },
  uploadedBy: { id: "teacher_1", name: "Tara Teacher", role: "TEACHER" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([]);
  vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([]);
  vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
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
    // The loser's failure-path findUnique only needs `{id:true}` in the
    // real code, but the winner's success-path findUnique (for notification
    // recipient resolution) needs the fuller shape — one mock covers both.
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    const [first, second] = await Promise.all([
      approveDocument("doc_1", "admin_1"),
      approveDocument("doc_1", "admin_2"),
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["not-pending", "success"]);
    // Exactly two notification batches for the whole race — one follower
    // (NEW_DOCUMENT) batch and one Teacher-result (DOCUMENT_APPROVED) batch,
    // both from the single winner; the loser never reaches notification
    // generation at all.
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(prisma.notification.createMany).mock.calls as unknown as Array<
      [{ data: Array<{ type: string }> }]
    >;
    for (const call of calls) expect(call[0].data).toHaveLength(1);
    const types = calls.map((call) => call[0].data[0].type).sort();
    expect(types).toEqual(["DOCUMENT_APPROVED", "NEW_DOCUMENT"]);
  });
});

describe("approveDocument — notification generation (FEAT-10D)", () => {
  beforeEach(() => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
  });

  test("notifies Teacher followers and Lesson followers, unioned and deduplicated, uploader excluded", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([
      { followerId: "student_a" },
      { followerId: "student_c" },
    ] as never);
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([
      { userId: "student_b" },
      { userId: "student_c" },
      { userId: APPROVE_DOCUMENT_ROW.uploadedBy.id },
    ] as never);

    await approveDocument("doc_1", "admin_1");

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: Array<{ userId: string }>;
    };
    const recipientIds = call.data.map((row) => row.userId).sort();
    expect(recipientIds).toEqual(["student_a", "student_b", "student_c"]);
  });

  test("does not generate notifications if the transition did not succeed", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: "doc_1" } as never);
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    const result = await approveDocument("doc_1", "admin_1");

    expect(result.outcome).toBe("not-pending");
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  test("zero follower notifications when neither the Teacher nor the Lesson has followers — the Teacher result notification is separate and still fires", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    const result = await approveDocument("doc_1", "admin_1");

    expect(result.outcome).toBe("success");
    const calls = vi.mocked(prisma.notification.createMany).mock.calls as unknown as Array<
      [{ data: Array<{ type: string }> }]
    >;
    expect(calls.every((call) => call[0].data.every((row) => row.type !== "NEW_DOCUMENT"))).toBe(true);
  });

  test("a document with no Lesson notifies only Teacher followers", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...APPROVE_DOCUMENT_ROW,
      lessonId: null,
      lesson: null,
    } as never);
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await approveDocument("doc_1", "admin_1");

    expect(prisma.lessonFollow.findMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: Array<{ userId: string }>;
    };
    expect(call.data.map((row) => row.userId)).toEqual(["student_1"]);
  });

  test("a document whose uploader account was deleted (uploadedBy null) still notifies Lesson followers, skipping Teacher followers", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...APPROVE_DOCUMENT_ROW,
      uploadedBy: null,
    } as never);
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([{ userId: "student_1" }] as never);

    const result = await approveDocument("doc_1", "admin_1");

    expect(result.outcome).toBe("success");
    expect(prisma.teacherFollow.findMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: Array<{ userId: string }>;
    };
    expect(call.data.map((row) => row.userId)).toEqual(["student_1"]);
  });

  test("passes skipDuplicates so a retried/duplicate call is idempotent", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await approveDocument("doc_1", "admin_1");

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as { skipDuplicates: boolean };
    expect(call.skipDuplicates).toBe(true);
  });

  test("createdAt is not passed explicitly — notifications are timestamped at approval time via the DB default, never backdated to upload time", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await approveDocument("doc_1", "admin_1");

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(call.data[0]).not.toHaveProperty("createdAt");
  });

  test("runs the transition, recipient resolution, and notification insertion inside prisma.$transaction", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await approveDocument("doc_1", "admin_1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("approveDocument / rejectDocument — clears stale DOCUMENT_PENDING_REVIEW (FEAT-10F)", () => {
  beforeEach(() => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
  });

  test("approve clears any outstanding pending-review notification for the document — the task is resolved for every Admin, not just this reviewer", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await approveDocument("doc_1", "admin_1");

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { documentId: "doc_1", type: "DOCUMENT_PENDING_REVIEW" },
    });
  });

  test("reject clears any outstanding pending-review notification for the document too", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await rejectDocument("doc_1", "admin_1", { reason: "test" });

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { documentId: "doc_1", type: "DOCUMENT_PENDING_REVIEW" },
    });
  });
});

describe("approveDocument — Teacher result notification (FEAT-10F)", () => {
  beforeEach(() => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
  });

  test("notifies the uploader with DOCUMENT_APPROVED", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await approveDocument("doc_1", "admin_1");

    const calls = vi.mocked(prisma.notification.createMany).mock.calls as unknown as Array<
      [{ data: Array<{ userId: string; type: string; message: string }> }]
    >;
    const resultCall = calls.find((call) => call[0].data.some((row) => row.type === "DOCUMENT_APPROVED"));
    expect(resultCall).toBeDefined();
    const row = resultCall![0].data[0];
    expect(row.userId).toBe(APPROVE_DOCUMENT_ROW.uploadedBy.id);
    expect(row.message).toBe(`Your document "${APPROVE_DOCUMENT_ROW.title}" was approved.`);
  });

  test("replaces any prior moderation-result notification (approved or rejected) before creating the fresh approved one", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await approveDocument("doc_1", "admin_1");

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: APPROVE_DOCUMENT_ROW.uploadedBy.id,
        documentId: "doc_1",
        type: { in: ["DOCUMENT_APPROVED", "DOCUMENT_REJECTED"] },
      },
    });
  });

  test("null uploader (deleted account) → no Teacher result notification, approve still succeeds", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ...APPROVE_DOCUMENT_ROW, uploadedBy: null } as never);

    const result = await approveDocument("doc_1", "admin_1");

    expect(result.outcome).toBe("success");
    const calls = vi.mocked(prisma.notification.createMany).mock.calls as unknown as Array<
      [{ data: Array<{ type: string }> }]
    >;
    expect(calls.every((call) => call[0].data.every((row) => row.type !== "DOCUMENT_APPROVED"))).toBe(true);
  });

  test("self-review edge case: reviewer === uploader → no self-notification (e.g. an ADMIN's own PENDING document)", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await approveDocument("doc_1", APPROVE_DOCUMENT_ROW.uploadedBy.id);

    const calls = vi.mocked(prisma.notification.createMany).mock.calls as unknown as Array<
      [{ data: Array<{ type: string }> }]
    >;
    expect(calls.every((call) => call[0].data.every((row) => row.type !== "DOCUMENT_APPROVED"))).toBe(true);
  });

  test("notification failure rolls back the entire approval — document remains PENDING", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
    vi.mocked(prisma.notification.createMany).mockRejectedValue(new Error("connection refused"));

    await expect(approveDocument("doc_1", "admin_1")).rejects.toThrow();
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

  test("never generates a follower NEW_DOCUMENT notification — rejection is not a publication event (FEAT-10D)", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    await rejectDocument("doc_1", "admin_1", { reason: "Wrong grade level" });

    const calls = vi.mocked(prisma.notification.createMany).mock.calls as unknown as Array<
      [{ data: Array<{ type: string }> }]
    >;
    expect(calls.every((call) => call[0].data.every((row) => row.type !== "NEW_DOCUMENT"))).toBe(true);
  });

  test("never generates a DOCUMENT_PENDING_REVIEW notification — rejection does not re-queue for review", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    await rejectDocument("doc_1", "admin_1", { reason: "Wrong grade level" });

    const calls = vi.mocked(prisma.notification.createMany).mock.calls as unknown as Array<
      [{ data: Array<{ type: string }> }]
    >;
    expect(calls.every((call) => call[0].data.every((row) => row.type !== "DOCUMENT_PENDING_REVIEW"))).toBe(true);
  });
});

describe("rejectDocument — Teacher result notification (FEAT-10F)", () => {
  beforeEach(() => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
  });

  test("notifies the uploader with DOCUMENT_REJECTED, reason not embedded", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await rejectDocument("doc_1", "admin_1", { reason: "Wrong grade level — please fix and resubmit" });

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as {
      data: Array<{ userId: string; type: string; message: string }>;
    };
    expect(call.data).toEqual([
      {
        userId: APPROVE_DOCUMENT_ROW.uploadedBy.id,
        documentId: "doc_1",
        type: "DOCUMENT_REJECTED",
        title: "Document rejected",
        message: `Your document "${APPROVE_DOCUMENT_ROW.title}" was rejected. View the reason and make changes before resubmitting.`,
      },
    ]);
    expect(call.data[0].message).not.toContain("Wrong grade level");
  });

  test("replaces any prior moderation-result notification (approved or rejected) before creating the fresh rejected one", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await rejectDocument("doc_1", "admin_1", { reason: "test" });

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: APPROVE_DOCUMENT_ROW.uploadedBy.id,
        documentId: "doc_1",
        type: { in: ["DOCUMENT_APPROVED", "DOCUMENT_REJECTED"] },
      },
    });
  });

  test("null uploader (deleted account) → no Teacher result notification, reject still succeeds", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ...APPROVE_DOCUMENT_ROW, uploadedBy: null } as never);

    const result = await rejectDocument("doc_1", "admin_1", { reason: "test" });

    expect(result.outcome).toBe("success");
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  test("self-review edge case: reviewer === uploader → no self-notification", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);

    await rejectDocument("doc_1", APPROVE_DOCUMENT_ROW.uploadedBy.id, { reason: "test" });

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  test("notification failure rolls back the entire rejection — document remains PENDING", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(APPROVE_DOCUMENT_ROW as never);
    vi.mocked(prisma.notification.createMany).mockRejectedValue(new Error("connection refused"));

    await expect(rejectDocument("doc_1", "admin_1", { reason: "test" })).rejects.toThrow();
  });
});
