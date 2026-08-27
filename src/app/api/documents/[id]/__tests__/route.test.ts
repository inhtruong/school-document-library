import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
