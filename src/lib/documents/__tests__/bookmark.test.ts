import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentBookmark: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { SAVED_PAGE_SIZE } from "@/lib/documents/bookmark-config";
import { addBookmark, isBookmarked, listUserBookmarks, removeBookmark } from "@/lib/documents/bookmark";

const now = new Date("2025-01-01T00:00:00.000Z");
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
  fileName: null,
  fileSize: null,
  mimeType: null,
  fileCategory: null,
  uploadedById: null,
  createdAt: now,
  updatedAt: now,
  grade: null,
  subjectRef: null,
  lesson: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isBookmarked", () => {
  test("returns false without querying the database when userId is null (guest)", async () => {
    const result = await isBookmarked("doc_1", null);

    expect(result).toBe(false);
    expect(prisma.documentBookmark.findUnique).not.toHaveBeenCalled();
  });

  test("returns true when a bookmark exists for this user/document", async () => {
    vi.mocked(prisma.documentBookmark.findUnique).mockResolvedValue({ id: "bookmark_1" } as never);

    const result = await isBookmarked("doc_1", "user_1");

    expect(result).toBe(true);
    expect(prisma.documentBookmark.findUnique).toHaveBeenCalledWith({
      where: { documentId_userId: { documentId: "doc_1", userId: "user_1" } },
      select: { id: true },
    });
  });

  test("returns false when no bookmark exists", async () => {
    vi.mocked(prisma.documentBookmark.findUnique).mockResolvedValue(null);

    const result = await isBookmarked("doc_1", "user_1");

    expect(result).toBe(false);
  });
});

describe("addBookmark", () => {
  test("upserts on the compound (documentId, userId) key — idempotent, never a duplicate row", async () => {
    vi.mocked(prisma.documentBookmark.upsert).mockResolvedValue({} as never);

    await addBookmark("doc_1", "user_1");

    expect(prisma.documentBookmark.upsert).toHaveBeenCalledWith({
      where: { documentId_userId: { documentId: "doc_1", userId: "user_1" } },
      create: { documentId: "doc_1", userId: "user_1" },
      update: {},
    });
  });

  test("a repeat call for the same document/user makes the same idempotent upsert call again", async () => {
    vi.mocked(prisma.documentBookmark.upsert).mockResolvedValue({} as never);

    await addBookmark("doc_1", "user_1");
    await addBookmark("doc_1", "user_1");

    expect(prisma.documentBookmark.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("removeBookmark", () => {
  test("deletes by (documentId, userId) using deleteMany, which never throws on zero matches", async () => {
    vi.mocked(prisma.documentBookmark.deleteMany).mockResolvedValue({ count: 1 } as never);

    await removeBookmark("doc_1", "user_1");

    expect(prisma.documentBookmark.deleteMany).toHaveBeenCalledWith({
      where: { documentId: "doc_1", userId: "user_1" },
    });
  });

  test("removing a bookmark that doesn't exist resolves without throwing", async () => {
    vi.mocked(prisma.documentBookmark.deleteMany).mockResolvedValue({ count: 0 } as never);

    await expect(removeBookmark("doc_1", "user_1")).resolves.toBeUndefined();
  });
});

describe("listUserBookmarks", () => {
  test("orders newest saved first, caps take at SAVED_PAGE_SIZE, and computes skip from the page", async () => {
    vi.mocked(prisma.documentBookmark.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentBookmark.count).mockResolvedValue(0);

    await listUserBookmarks("user_1", 2);

    expect(prisma.documentBookmark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", document: { moderationStatus: "APPROVED" } },
        orderBy: { createdAt: "desc" },
        skip: SAVED_PAGE_SIZE,
        take: SAVED_PAGE_SIZE,
      })
    );
  });

  test("is scoped to exactly one user's bookmarks", async () => {
    vi.mocked(prisma.documentBookmark.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentBookmark.count).mockResolvedValue(0);

    await listUserBookmarks("user_1", 1);

    expect(prisma.documentBookmark.count).toHaveBeenCalledWith({
      where: { userId: "user_1", document: { moderationStatus: "APPROVED" } },
    });
  });

  test("only includes APPROVED documents — a bookmarked PENDING/REJECTED document does not leak through /saved", async () => {
    vi.mocked(prisma.documentBookmark.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentBookmark.count).mockResolvedValue(0);

    await listUserBookmarks("user_1", 1);

    const findManyArgs = vi.mocked(prisma.documentBookmark.findMany).mock.calls[0][0];
    expect(findManyArgs?.where).toEqual({ userId: "user_1", document: { moderationStatus: "APPROVED" } });
  });

  test("maps bookmark rows to serialized Document records (ISO date strings)", async () => {
    vi.mocked(prisma.documentBookmark.findMany).mockResolvedValue([
      { document: mockDocument },
    ] as never);
    vi.mocked(prisma.documentBookmark.count).mockResolvedValue(1);

    const result = await listUserBookmarks("user_1", 1);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].id).toBe("doc_1");
    expect(result.documents[0].createdAt).toBe(now.toISOString());
  });

  test("returns an empty list with total 0 when the user has no bookmarks", async () => {
    vi.mocked(prisma.documentBookmark.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentBookmark.count).mockResolvedValue(0);

    const result = await listUserBookmarks("user_1", 1);

    expect(result).toEqual({ documents: [], total: 0, page: 1, totalPages: 1 });
  });

  test("computes totalPages from the total count", async () => {
    vi.mocked(prisma.documentBookmark.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentBookmark.count).mockResolvedValue(25);

    const result = await listUserBookmarks("user_1", 1);

    expect(result.totalPages).toBe(Math.ceil(25 / SAVED_PAGE_SIZE));
  });
});
