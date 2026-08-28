import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  fileName: null,
  fileSize: null,
  mimeType: null,
  fileCategory: null,
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
      omit: { fileKey: true, reviewedById: true, rejectionReason: true },
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
    expect(call.omit).toEqual({ fileKey: true, reviewedById: true, rejectionReason: true });
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
