import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentComment: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    // Array-form `$transaction` just awaits the already-invoked query
    // promises together — same effect as `Promise.all` for these mocks.
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from "@/lib/prisma";
import { COMMENTS_PAGE_SIZE } from "@/lib/documents/comment-config";
import { createComment, listComments, toCommentPayload } from "@/lib/documents/comment";

const now = new Date("2025-01-01T00:00:00.000Z");
const AUTHOR = { id: "user_1", name: "Sam Student", role: "STUDENT" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listComments", () => {
  test("orders newest first, caps take at COMMENTS_PAGE_SIZE, and computes skip from the page", async () => {
    vi.mocked(prisma.documentComment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentComment.count).mockResolvedValue(0);

    await listComments("doc_1", 2);

    expect(prisma.documentComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: "doc_1" },
        orderBy: { createdAt: "desc" },
        skip: COMMENTS_PAGE_SIZE,
        take: COMMENTS_PAGE_SIZE,
      })
    );
  });

  test("only ever selects safe author fields (id, name, role) — never email or passwordHash", async () => {
    vi.mocked(prisma.documentComment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentComment.count).mockResolvedValue(0);

    await listComments("doc_1", 1);

    const call = vi.mocked(prisma.documentComment.findMany).mock.calls[0][0];
    expect(call?.select?.user).toEqual({ select: { id: true, name: true, role: true } });
  });

  test("returns the DB count as total, not the length of the current page", async () => {
    const row = { id: "c1", content: "hi", createdAt: now, updatedAt: now, user: AUTHOR };
    vi.mocked(prisma.documentComment.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.documentComment.count).mockResolvedValue(45);

    const result = await listComments("doc_1", 1);

    expect(result.comments).toHaveLength(1);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(Math.ceil(45 / COMMENTS_PAGE_SIZE));
  });

  test("empty document returns an empty list with total 0", async () => {
    vi.mocked(prisma.documentComment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.documentComment.count).mockResolvedValue(0);

    const result = await listComments("doc_1", 1);

    expect(result).toEqual({ comments: [], total: 0, page: 1, totalPages: 1 });
  });
});

describe("createComment", () => {
  test("creates with the given documentId/userId/content and returns the shaped payload", async () => {
    const row = { id: "c1", content: "hello", createdAt: now, updatedAt: now, user: AUTHOR };
    vi.mocked(prisma.documentComment.create).mockResolvedValue(row as never);

    const result = await createComment("doc_1", "user_1", "hello");

    expect(prisma.documentComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { documentId: "doc_1", userId: "user_1", content: "hello" } })
    );
    expect(result.author).toEqual(AUTHOR);
  });
});

describe("toCommentPayload", () => {
  test("renames the Prisma `user` relation to `author` and drops nothing else", () => {
    const row = { id: "c1", content: "hi", createdAt: now, updatedAt: now, user: AUTHOR };

    const payload = toCommentPayload(row);

    expect(payload).toEqual({ id: "c1", content: "hi", createdAt: now, updatedAt: now, author: AUTHOR });
    expect(payload).not.toHaveProperty("user");
  });
});
