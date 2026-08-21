import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/documents/route";

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
  fileKey: null,
  fileName: null,
  fileSize: null,
  mimeType: null,
  fileCategory: null,
  uploadedById: null,
  createdAt,
  updatedAt,
};

const serializedMockDocument = {
  ...mockDocument,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/documents", () => {
  test("returns documents wrapped in a success envelope with pagination meta", async () => {
    // Arrange
    vi.mocked(prisma.document.findMany).mockResolvedValue([mockDocument]);
    vi.mocked(prisma.document.count).mockResolvedValue(1);
    const request = new NextRequest("http://localhost/api/documents");

    // Act
    const response = await GET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([serializedMockDocument]);
    expect(body.meta.total).toBe(1);
  });

  test("builds a case-insensitive OR filter across title, description and subject when searching", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.count).mockResolvedValue(0);
    const request = new NextRequest("http://localhost/api/documents?search=database");

    await GET(request);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.where?.OR).toEqual([
      { title: { contains: "database", mode: "insensitive" } },
      { description: { contains: "database", mode: "insensitive" } },
      { subject: { contains: "database", mode: "insensitive" } },
    ]);
  });

  test("returns a 500 error envelope when the database call fails", async () => {
    vi.mocked(prisma.document.findMany).mockRejectedValue(new Error("connection refused"));
    vi.mocked(prisma.document.count).mockResolvedValue(0);
    const request = new NextRequest("http://localhost/api/documents");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });
});

describe("POST /api/documents", () => {
  test("creates a document and returns 201 with the created record", async () => {
    vi.mocked(prisma.document.create).mockResolvedValue(mockDocument);
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Database Final Exam 2025",
        subject: "Database",
        documentType: "Exam",
        academicYear: "2024-2025",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(serializedMockDocument);
  });

  test("rejects an invalid payload with 400 and never touches the database", async () => {
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON with 400", async () => {
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: "{not valid json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
