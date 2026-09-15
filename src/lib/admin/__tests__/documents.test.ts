import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getAdminDocumentById, listAdminDocuments } from "@/lib/admin/documents";

const now = new Date("2026-01-01T00:00:00.000Z");

const LIST_ROW = {
  id: "doc_1",
  title: "Database Final Exam",
  moderationStatus: "PENDING" as const,
  sourceType: "FILE" as const,
  documentType: "EXAM" as const,
  fileCategory: "PDF" as const,
  createdAt: now,
  academicYear: "2025-2026",
  uploadedBy: { id: "teacher_1", name: "Ms. Teacher" },
  grade: { name: "Grade 12" },
  subjectRef: { name: "Database" },
  lesson: { name: "Normalization" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAdminDocuments", () => {
  test("returns a page of documents, newest first, no visibility filter applied", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([LIST_ROW] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(1);

    const result = await listAdminDocuments({}, 1);

    expect(result).toEqual({ documents: [LIST_ROW], total: 1, page: 1, totalPages: 1 });
    const call = vi.mocked(prisma.document.findMany).mock.calls[0]![0]!;
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(call.where).not.toHaveProperty("moderationStatus");
  });

  test("paginates using skip/take", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(45);

    const result = await listAdminDocuments({}, 3);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0]![0]!;
    expect(call.skip).toBe(40);
    expect(call.take).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  test("filters by moderation status", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listAdminDocuments({ status: "PENDING" }, 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0]![0]!;
    expect(call.where).toMatchObject({ moderationStatus: "PENDING" });
  });

  test("filters by source type", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listAdminDocuments({ sourceType: "YOUTUBE" }, 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0]![0]!;
    expect(call.where).toMatchObject({ sourceType: "YOUTUBE" });
  });

  test("filters by document type", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listAdminDocuments({ documentType: "EXAM" }, 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0]![0]!;
    expect(call.where).toMatchObject({ documentType: "EXAM" });
  });

  test("searches title/description/subject case-insensitively", async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listAdminDocuments({ search: "exam" }, 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0]![0]!;
    expect(call.where!.OR).toEqual([
      { title: { contains: "exam", mode: "insensitive" } },
      { description: { contains: "exam", mode: "insensitive" } },
      { subject: { contains: "exam", mode: "insensitive" } },
    ]);
  });

  test("filters by a resolved Grade taxonomy id", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue({ id: "grade_12" } as never);
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    await listAdminDocuments({ gradeId: "grade_12" }, 1);

    const call = vi.mocked(prisma.document.findMany).mock.calls[0]![0]!;
    expect(call.where).toMatchObject({ gradeId: "grade_12" });
  });
});

describe("getAdminDocumentById", () => {
  test("returns document detail with safe counts and no fileKey/previewFileKey", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...LIST_ROW,
      description: null,
      fileName: "exam.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      externalVideoId: null,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      grade: { id: "grade_12", name: "Grade 12" },
      subjectRef: { id: "subject_db", name: "Database" },
      lesson: { id: "lesson_norm", name: "Normalization" },
      uploadedBy: { id: "teacher_1", name: "Ms. Teacher", role: "TEACHER" },
      _count: { ratings: 2, comments: 1, reports: 0 },
    } as never);

    const result = await getAdminDocumentById("doc_1");

    expect(result).toMatchObject({ id: "doc_1", counts: { ratings: 2, comments: 1, reports: 0 } });
    const call = vi.mocked(prisma.document.findUnique).mock.calls[0]![0]!;
    expect(call.select).not.toHaveProperty("fileKey");
    expect(call.select).not.toHaveProperty("previewFileKey");
  });

  test("returns null for a nonexistent document", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null as never);

    const result = await getAdminDocumentById("missing");

    expect(result).toBeNull();
  });
});
