import { NextRequest } from "next/server";
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

import { prisma } from "@/lib/prisma";
import { DELETE, GET, PUT } from "@/app/api/documents/[id]/route";

const createdAt = new Date("2025-01-01T00:00:00.000Z");
const updatedAt = new Date("2025-01-02T00:00:00.000Z");

// Prisma returns Date instances; the API serializes them to ISO strings over JSON.
const mockDocument = {
  id: "doc_1",
  title: "Database Final Exam 2025",
  description: "Covers normalization and transactions.",
  subject: "Database",
  documentType: "Exam",
  academicYear: "2024-2025",
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
});

describe("GET /api/documents/:id", () => {
  test("returns the document when it exists", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);

    const response = await GET(new NextRequest("http://localhost/api/documents/doc_1"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(serializedMockDocument);
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
});
