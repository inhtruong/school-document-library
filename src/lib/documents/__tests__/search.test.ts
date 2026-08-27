import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findMany: vi.fn(), count: vi.fn() },
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { searchDocuments } from "@/lib/documents/search";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.document.findMany).mockResolvedValue([]);
  vi.mocked(prisma.document.count).mockResolvedValue(0);
  vi.mocked(prisma.grade.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.lesson.findUnique).mockResolvedValue(null);
});

/**
 * searchDocuments() is the single shared query backing /search, the
 * homepage's "latest documents", and the public GET /api/documents API —
 * so this one test file's coverage protects all three surfaces at once
 * (FEAT-10A).
 */
describe("searchDocuments — moderation visibility (FEAT-10A)", () => {
  test("every call includes moderationStatus: APPROVED in the where clause, regardless of other filters", async () => {
    await searchDocuments({ sort: "newest", page: 1 });

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.where).toMatchObject({ moderationStatus: "APPROVED" });
  });

  test("the count query (used for pagination totals) also filters to APPROVED only", async () => {
    await searchDocuments({ sort: "newest", page: 1 });

    const call = vi.mocked(prisma.document.count).mock.calls[0][0];
    expect(call?.where).toMatchObject({ moderationStatus: "APPROVED" });
  });

  test("the homepage's legacy take/skip pagination mode also filters to APPROVED only", async () => {
    await searchDocuments({ sort: "newest", take: 6, skip: 0 });

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.where).toMatchObject({ moderationStatus: "APPROVED" });
  });

  test("a keyword/taxonomy/documentType search still combines with the APPROVED filter, not replaces it", async () => {
    await searchDocuments({ sort: "newest", page: 1, search: "database", documentType: "EXAM" });

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.where).toMatchObject({ moderationStatus: "APPROVED", documentType: "EXAM" });
    expect(call?.where?.OR).toBeDefined();
  });

  test("omits reviewedById/rejectionReason from the query result", async () => {
    await searchDocuments({ sort: "newest", page: 1 });

    const call = vi.mocked(prisma.document.findMany).mock.calls[0][0];
    expect(call?.omit).toMatchObject({ reviewedById: true, rejectionReason: true });
  });
});
