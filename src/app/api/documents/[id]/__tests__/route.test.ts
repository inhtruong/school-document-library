import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    // Test double for prisma.$transaction — same pattern as
    // moderation.test.ts: the callback runs against this SAME mocked
    // client, so `tx.document.*`/`tx.auditLog.create` inside PUT/DELETE's
    // transactions hit these exact mocks.
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/storage/local-storage", () => ({
  deleteLocalFile: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteLocalFile } from "@/lib/storage/local-storage";
import { DELETE, GET, PUT } from "@/app/api/documents/[id]/route";

const OWNER_SESSION: Session = {
  user: { id: "teacher_1", role: "TEACHER", name: "Ms. Teacher", email: "teacher@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
};
const OTHER_TEACHER_SESSION: Session = {
  user: { id: "teacher_2", role: "TEACHER", name: "Mr. Other", email: "other@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
};
const ADMIN_SESSION: Session = {
  user: { id: "admin_1", role: "ADMIN", name: "Admin", email: "admin@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
};

// `auth` is polymorphic (plain call vs. middleware signature); pin the overload we use.
const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

const createdAt = new Date("2025-01-01T00:00:00.000Z");
const updatedAt = new Date("2025-01-02T00:00:00.000Z");

// Prisma returns Date instances; the API serializes them to ISO strings over JSON.
const mockDocument = {
  id: "doc_1",
  title: "Database Final Exam 2025",
  description: "Covers normalization and transactions.",
  subject: "Database",
  documentType: "EXAM" as const,
  academicYear: "2024-2025",
  gradeId: null,
  subjectId: null,
  lessonId: null,
  fileKey: null,
  previewFileKey: null,
  fileName: null,
  fileSize: null,
  mimeType: null,
  fileCategory: null,
  sourceType: "FILE" as const,
  externalVideoId: null,
  uploadedById: "teacher_1",
  moderationStatus: "APPROVED" as const,
  reviewedAt: null,
  reviewedById: null,
  rejectionReason: null,
  createdAt,
  updatedAt,
};

const serializedMockDocument = {
  ...mockDocument,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
};

const context = { params: Promise.resolve({ id: "doc_1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(OWNER_SESSION);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  vi.mocked(deleteLocalFile).mockResolvedValue(undefined);
});

describe("GET /api/documents/:id", () => {
  test("returns the document when it exists", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);

    const response = await GET(new NextRequest("http://localhost/api/documents/doc_1"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(serializedMockDocument);
  });

  test("returns 404 for a PENDING document requested by an unrelated user (FEAT-10A)", async () => {
    mockAuth.mockResolvedValue(OTHER_TEACHER_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...mockDocument,
      moderationStatus: "PENDING",
    });

    const response = await GET(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(404);
  });

  test("returns 404 for a PENDING document requested by a guest (FEAT-10A)", async () => {
    mockAuth.mockResolvedValue(null);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...mockDocument,
      moderationStatus: "PENDING",
    });

    const response = await GET(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(404);
  });

  test("the uploader CAN view their own PENDING document (FEAT-10A)", async () => {
    mockAuth.mockResolvedValue(OWNER_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...mockDocument,
      moderationStatus: "PENDING",
    });

    const response = await GET(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(200);
  });

  test("returns 404 when the document does not exist", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/documents/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });
});

describe("PUT /api/documents/:id", () => {
  test("updates an existing document", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, title: "Updated title" });

    const request = new NextRequest("http://localhost/api/documents/doc_1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated title" }),
    });

    const response = await PUT(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.title).toBe("Updated title");
  });

  test("returns 404 instead of updating when the document does not exist", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/documents/missing", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated title" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  test("rejects an invalid field value with 400", async () => {
    const request = new NextRequest("http://localhost/api/documents/doc_1", {
      method: "PUT",
      body: JSON.stringify({ title: "" }),
    });

    const response = await PUT(request, context);

    expect(response.status).toBe(400);
    expect(prisma.document.findUnique).not.toHaveBeenCalled();
  });

  test("rejects an unauthenticated caller with 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/documents/doc_1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated title" }),
    });

    const response = await PUT(request, context);

    expect(response.status).toBe(401);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  test("rejects a caller who does not own the document with 403 (IDOR regression)", async () => {
    mockAuth.mockResolvedValue(OTHER_TEACHER_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    const request = new NextRequest("http://localhost/api/documents/doc_1", {
      method: "PUT",
      body: JSON.stringify({ title: "Hijacked title" }),
    });

    const response = await PUT(request, context);

    expect(response.status).toBe(403);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  test("allows ADMIN to update a document owned by someone else", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, title: "Updated by admin" });
    const request = new NextRequest("http://localhost/api/documents/doc_1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated by admin" }),
    });

    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    expect(prisma.document.update).toHaveBeenCalled();
  });

  test("rejects updating a legacy document with no owner unless the caller is ADMIN", async () => {
    const ownerlessDocument = { ...mockDocument, uploadedById: null };
    vi.mocked(prisma.document.findUnique).mockResolvedValue(ownerlessDocument);
    const request = new NextRequest("http://localhost/api/documents/doc_1", {
      method: "PUT",
      body: JSON.stringify({ title: "Claimed title" }),
    });

    const response = await PUT(request, context);

    expect(response.status).toBe(403);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/documents/:id — FEAT-10E edit/re-review rules", () => {
  function putRequest(body: unknown) {
    return new NextRequest("http://localhost/api/documents/doc_1", { method: "PUT", body: JSON.stringify(body) });
  }

  test("Teacher owner: a minor-only edit (title) on an APPROVED document stays APPROVED via a plain update, review metadata preserved", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...mockDocument,
      reviewedAt: new Date("2026-01-01T00:00:00.000Z"),
      reviewedById: "admin_1",
    });
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument);

    const response = await PUT(putRequest({ title: "Corrected title" }), context);

    expect(response.status).toBe(200);
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc_1" },
      data: { title: "Corrected title" },
      omit: { fileKey: true, previewFileKey: true, reviewedById: true, rejectionReason: true },
    });
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  test("Teacher owner: a material edit (documentType) on an APPROVED document transitions to PENDING, clearing review metadata, in one atomic write", async () => {
    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(mockDocument) // the initial "existing" read
      .mockResolvedValueOnce({ ...mockDocument, documentType: "REFERENCE", moderationStatus: "PENDING" }); // post-write refetch
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    const response = await PUT(putRequest({ documentType: "REFERENCE" }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.moderationStatus).toBe("PENDING");
    expect(prisma.document.update).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.document.updateMany).mock.calls[0][0];
    expect(call.where).toEqual({ id: "doc_1", moderationStatus: "APPROVED" });
    expect(call.data).toEqual({
      documentType: "REFERENCE",
      moderationStatus: "PENDING",
      reviewedAt: null,
      reviewedById: null,
      rejectionReason: null,
    });
  });

  test("Teacher owner: a material edit to the legacy `subject` field on an APPROVED document also triggers PENDING", async () => {
    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(mockDocument)
      .mockResolvedValueOnce({ ...mockDocument, subject: "Physics", moderationStatus: "PENDING" });
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    const response = await PUT(putRequest({ subject: "Physics" }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.moderationStatus).toBe("PENDING");
  });

  test("Teacher owner: a mixed minor+material edit is treated as material as a whole", async () => {
    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(mockDocument)
      .mockResolvedValueOnce({ ...mockDocument, title: "New title", documentType: "REFERENCE", moderationStatus: "PENDING" });
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    await PUT(putRequest({ title: "New title", documentType: "REFERENCE" }), context);

    const call = vi.mocked(prisma.document.updateMany).mock.calls[0][0];
    expect(call.data.moderationStatus).toBe("PENDING");
    expect(call.data.title).toBe("New title");
  });

  test("Teacher owner: resubmitting the SAME documentType value on an APPROVED document is a no-op — stays APPROVED, no transition", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument); // documentType is already "EXAM"
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument);

    await PUT(putRequest({ documentType: "EXAM" }), context);

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.document.update).toHaveBeenCalled();
  });

  test("Teacher owner: editing an already-PENDING document never transitions it (stays PENDING via a plain update)", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ...mockDocument, moderationStatus: "PENDING" });
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, moderationStatus: "PENDING" });

    await PUT(putRequest({ documentType: "REFERENCE" }), context);

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.document.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("moderationStatus");
  });

  test("Teacher owner: editing an already-REJECTED document never auto-resubmits — stays REJECTED, rejectionReason preserved", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...mockDocument,
      moderationStatus: "REJECTED",
      rejectionReason: "Wrong grade level",
    });
    vi.mocked(prisma.document.update).mockResolvedValue({
      ...mockDocument,
      moderationStatus: "REJECTED",
      rejectionReason: "Wrong grade level",
    });

    await PUT(putRequest({ documentType: "REFERENCE" }), context);

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.document.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("moderationStatus");
    expect(call.data).not.toHaveProperty("rejectionReason");
  });

  test("ADMIN editing an APPROVED document's documentType never triggers re-review — stays APPROVED via a plain update", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, documentType: "REFERENCE" });

    await PUT(putRequest({ documentType: "REFERENCE" }), context);

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.document.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("moderationStatus");
  });

  test("ADMIN editing a PENDING document never implicitly approves or rejects it", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ...mockDocument, moderationStatus: "PENDING" });
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, moderationStatus: "PENDING" });

    await PUT(putRequest({ title: "Admin-corrected title" }), context);

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.document.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("moderationStatus");
  });

  test("concurrency: if the document is no longer APPROVED by the time the guarded write runs, returns 409 and writes nothing", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument); // snapshot said APPROVED
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 }); // but the guard no longer matches

    const response = await PUT(putRequest({ documentType: "REFERENCE" }), context);

    expect(response.status).toBe(409);
  });

  test("the response never leaks reviewedById/rejectionReason to the caller, even the owner", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument);

    await PUT(putRequest({ title: "Corrected title" }), context);

    const call = vi.mocked(prisma.document.update).mock.calls[0][0] as { omit: Record<string, unknown> };
    expect(call.omit).toEqual({ fileKey: true, previewFileKey: true, reviewedById: true, rejectionReason: true });
  });

  test("the client cannot smuggle moderation fields through the request body — updateDocumentSchema strips them", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument);

    await PUT(
      putRequest({
        title: "Corrected title",
        moderationStatus: "APPROVED",
        reviewedById: "attacker-controlled-id",
        rejectionReason: null,
      }),
      context
    );

    const call = vi.mocked(prisma.document.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toEqual({ title: "Corrected title" });
  });
});

describe("PUT /api/documents/:id — FEAT-15D taxonomy edit", () => {
  function putRequest(body: unknown) {
    return new NextRequest("http://localhost/api/documents/doc_1", { method: "PUT", body: JSON.stringify(body) });
  }

  const now = new Date("2026-01-01T00:00:00.000Z");
  const GRADE_11 = { id: "grade_11", name: "Grade 11", code: "G11", sortOrder: 11, createdAt: now, updatedAt: now };
  const MATH_11 = {
    id: "subject_math11",
    name: "Mathematics",
    code: "MATH",
    gradeId: GRADE_11.id,
    createdAt: now,
    updatedAt: now,
  };
  const DERIVATIVES = {
    id: "lesson_derivatives",
    name: "Derivatives",
    code: "DERIVATIVES",
    subjectId: MATH_11.id,
    createdAt: now,
    updatedAt: now,
  };

  test("ADMIN sets a valid Grade/Subject/Lesson triplet — syncs the legacy subject field, never triggers re-review", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE_11 as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_11 as never);
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(DERIVATIVES as never);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue({
      ...mockDocument,
      gradeId: GRADE_11.id,
      subjectId: MATH_11.id,
      lessonId: DERIVATIVES.id,
      subject: MATH_11.name,
    });

    const response = await PUT(
      putRequest({ gradeId: GRADE_11.id, subjectId: MATH_11.id, lessonId: DERIVATIVES.id }),
      context
    );

    expect(response.status).toBe(200);
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.document.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({
      gradeId: GRADE_11.id,
      subjectId: MATH_11.id,
      lessonId: DERIVATIVES.id,
      subject: MATH_11.name,
    });
    expect(call.data).not.toHaveProperty("moderationStatus");
  });

  test("rejects when the Subject does not belong to the given Grade — no update performed", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const OTHER_GRADE = { ...GRADE_11, id: "grade_10" };
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(OTHER_GRADE as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_11 as never); // belongs to grade_11, not grade_10
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(DERIVATIVES as never);

    const response = await PUT(
      putRequest({ gradeId: OTHER_GRADE.id, subjectId: MATH_11.id, lessonId: DERIVATIVES.id }),
      context
    );

    expect(response.status).toBe(400);
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  test("rejects when the selected Grade does not exist", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_11 as never);
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(DERIVATIVES as never);

    const response = await PUT(
      putRequest({ gradeId: "does-not-exist", subjectId: MATH_11.id, lessonId: DERIVATIVES.id }),
      context
    );

    // Matches upload's existing validateTaxonomySelection() convention — every
    // hierarchy failure (not-found or mismatch) is a uniform 400, not a 404.
    expect(response.status).toBe(400);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  test("audit metadata includes old/new taxonomy ids when taxonomy changes", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE_11 as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_11 as never);
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(DERIVATIVES as never);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument); // gradeId/subjectId/lessonId all null
    vi.mocked(prisma.document.update).mockResolvedValue({
      ...mockDocument,
      gradeId: GRADE_11.id,
      subjectId: MATH_11.id,
      lessonId: DERIVATIVES.id,
    });

    await PUT(putRequest({ gradeId: GRADE_11.id, subjectId: MATH_11.id, lessonId: DERIVATIVES.id }), context);

    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0] as { data: { metadata: Record<string, unknown> } };
    expect(call.data.metadata).toMatchObject({
      oldGradeId: null,
      newGradeId: GRADE_11.id,
      oldSubjectId: null,
      newSubjectId: MATH_11.id,
      oldLessonId: null,
      newLessonId: DERIVATIVES.id,
    });
  });

  test("audit metadata includes old/new documentType only when documentType changes", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument); // documentType: "EXAM"
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, documentType: "REFERENCE" });

    await PUT(putRequest({ documentType: "REFERENCE" }), context);

    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0] as { data: { metadata: Record<string, unknown> } };
    expect(call.data.metadata).toMatchObject({ oldDocumentType: "EXAM", newDocumentType: "REFERENCE" });
  });
});

describe("PUT /api/documents/:id — FEAT-11 audit log", () => {
  function putRequest(body: unknown) {
    return new NextRequest("http://localhost/api/documents/doc_1", { method: "PUT", body: JSON.stringify(body) });
  }

  test("a minor edit writes DOCUMENT_UPDATED with changedFields, no moderationTransition", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, title: "Corrected title" });

    await PUT(putRequest({ title: "Corrected title" }), context);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "teacher_1",
        actorEmail: "teacher@example.com",
        actorRole: "TEACHER",
        action: "DOCUMENT_UPDATED",
        entityType: "DOCUMENT",
        entityId: "doc_1",
        status: "SUCCESS",
        metadata: { documentTitle: "Corrected title", changedFields: ["title"] },
      },
    });
  });

  test("a material edit writes DOCUMENT_UPDATED WITH a moderationTransition APPROVED→PENDING", async () => {
    vi.mocked(prisma.document.findUnique)
      .mockResolvedValueOnce(mockDocument)
      .mockResolvedValueOnce({ ...mockDocument, documentType: "REFERENCE", moderationStatus: "PENDING" });
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });

    await PUT(putRequest({ documentType: "REFERENCE" }), context);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "teacher_1",
        actorEmail: "teacher@example.com",
        actorRole: "TEACHER",
        action: "DOCUMENT_UPDATED",
        entityType: "DOCUMENT",
        entityId: "doc_1",
        status: "SUCCESS",
        metadata: {
          documentTitle: mockDocument.title,
          changedFields: ["documentType"],
          moderationTransition: { from: "APPROVED", to: "PENDING" },
          oldDocumentType: "EXAM",
          newDocumentType: "REFERENCE",
        },
      },
    });
  });

  test("a true no-op edit (resubmitting the identical value) writes NO audit row", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument);

    await PUT(putRequest({ documentType: "EXAM" }), context);

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test("a failing audit write rolls back a minor edit too — the document is left unchanged", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, title: "Corrected title" });
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("audit db unavailable"));

    const response = await PUT(putRequest({ title: "Corrected title" }), context);

    expect(response.status).toBe(500);
  });

  test("a failing audit write rolls back a material edit — the document stays APPROVED", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("audit db unavailable"));

    const response = await PUT(putRequest({ documentType: "REFERENCE" }), context);

    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/documents/:id", () => {
  test("deletes an existing document and returns its id", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.delete).mockResolvedValue(mockDocument);

    const response = await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: "doc_1" });
  });

  test("returns 404 instead of deleting when the document does not exist", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/documents/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });

  test("rejects an unauthenticated caller with 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(401);
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });

  test("rejects a caller who does not own the document with 403 (IDOR regression)", async () => {
    mockAuth.mockResolvedValue(OTHER_TEACHER_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);

    const response = await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(403);
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });

  test("allows ADMIN to delete a document owned by someone else", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.delete).mockResolvedValue(mockDocument);

    const response = await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(200);
    expect(prisma.document.delete).toHaveBeenCalled();
  });
});

describe("DELETE /api/documents/:id — FEAT-11 audit log", () => {
  test("writes DOCUMENT_DELETED with the title/moderationStatus snapshotted BEFORE the row is gone", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.delete).mockResolvedValue(mockDocument);

    await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "teacher_1",
        actorEmail: "teacher@example.com",
        actorRole: "TEACHER",
        action: "DOCUMENT_DELETED",
        entityType: "DOCUMENT",
        entityId: "doc_1",
        status: "SUCCESS",
        metadata: { documentTitle: mockDocument.title, moderationStatus: mockDocument.moderationStatus },
      },
    });
  });

  test("a failing audit write rolls back the deletion too", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);
    vi.mocked(prisma.document.delete).mockResolvedValue(mockDocument);
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("audit db unavailable"));

    const response = await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/documents/:id — FEAT-12A physical file cleanup", () => {
  test("deletes the original file from storage", async () => {
    const doc = { ...mockDocument, fileKey: "pdf/original.pdf", previewFileKey: null };
    vi.mocked(prisma.document.findUnique).mockResolvedValue(doc);
    vi.mocked(prisma.document.delete).mockResolvedValue(doc);

    await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(deleteLocalFile).toHaveBeenCalledWith("pdf/original.pdf");
    expect(deleteLocalFile).toHaveBeenCalledTimes(1);
  });

  test("a PowerPoint document deletes BOTH the original and the generated preview — never affects any other key", async () => {
    const doc = { ...mockDocument, fileCategory: "POWERPOINT", fileKey: "powerpoint/original.pptx", previewFileKey: "previews/generated.pdf" };
    vi.mocked(prisma.document.findUnique).mockResolvedValue(doc as never);
    vi.mocked(prisma.document.delete).mockResolvedValue(doc as never);

    await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(deleteLocalFile).toHaveBeenCalledWith("powerpoint/original.pptx");
    expect(deleteLocalFile).toHaveBeenCalledWith("previews/generated.pdf");
    expect(deleteLocalFile).toHaveBeenCalledTimes(2);
  });

  test("a legacy fileless document (fileKey null) never calls deleteLocalFile", async () => {
    const doc = { ...mockDocument, fileKey: null, previewFileKey: null };
    vi.mocked(prisma.document.findUnique).mockResolvedValue(doc);
    vi.mocked(prisma.document.delete).mockResolvedValue(doc);

    await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(deleteLocalFile).not.toHaveBeenCalled();
  });

  test("FEAT-12B: deleting a YouTube document never calls deleteLocalFile — there was never a physical file to begin with", async () => {
    const doc = {
      ...mockDocument,
      fileKey: null,
      previewFileKey: null,
      sourceType: "YOUTUBE",
      externalVideoId: "dQw4w9WgXcQ",
    };
    vi.mocked(prisma.document.findUnique).mockResolvedValue(doc as never);
    vi.mocked(prisma.document.delete).mockResolvedValue(doc as never);

    const response = await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(200);
    expect(deleteLocalFile).not.toHaveBeenCalled();
  });

  test("physical cleanup only runs after the DB transaction actually commits", async () => {
    const doc = { ...mockDocument, fileKey: "pdf/original.pdf", previewFileKey: null };
    vi.mocked(prisma.document.findUnique).mockResolvedValue(doc);
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("audit db unavailable"));

    const response = await DELETE(new NextRequest("http://localhost/api/documents/doc_1"), context);

    expect(response.status).toBe(500);
    expect(deleteLocalFile).not.toHaveBeenCalled();
  });
});
