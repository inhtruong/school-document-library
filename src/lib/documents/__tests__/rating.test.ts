import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentRating: {
      aggregate: vi.fn(),
      findUnique: vi.fn(),
    },
    // Array-form `$transaction` just awaits the already-invoked query
    // promises together — same effect as `Promise.all` for these mocks.
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import { prisma } from "@/lib/prisma";
import { getRatingSummary } from "@/lib/documents/rating";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockAggregate(avg: number | null, count: number) {
  vi.mocked(prisma.documentRating.aggregate).mockResolvedValue({
    _avg: { value: avg },
    _count: { value: count },
  } as never);
}

describe("getRatingSummary", () => {
  test("returns averageRating=null and ratingCount=0 for a document with no ratings", async () => {
    mockAggregate(null, 0);
    vi.mocked(prisma.documentRating.findUnique).mockResolvedValue(null);

    const result = await getRatingSummary("doc_1", null);

    expect(result).toEqual({ averageRating: null, ratingCount: 0, currentUserRating: null });
  });

  test("rounds the average to 1 decimal place — 5, 4, 3 -> 4.0", async () => {
    mockAggregate(4, 3);
    vi.mocked(prisma.documentRating.findUnique).mockResolvedValue(null);

    const result = await getRatingSummary("doc_1", null);

    expect(result.averageRating).toBe(4);
    expect(result.ratingCount).toBe(3);
  });

  test("rounds the average to 1 decimal place — 5, 4, 5 -> 4.7", async () => {
    mockAggregate(14 / 3, 3);
    vi.mocked(prisma.documentRating.findUnique).mockResolvedValue(null);

    const result = await getRatingSummary("doc_1", null);

    expect(result.averageRating).toBe(4.7);
  });

  test("does not query for a current rating when userId is null (guest)", async () => {
    mockAggregate(4.5, 2);

    await getRatingSummary("doc_1", null);

    expect(prisma.documentRating.findUnique).not.toHaveBeenCalled();
  });

  test("returns the caller's own rating when they've rated this document", async () => {
    mockAggregate(4.5, 2);
    vi.mocked(prisma.documentRating.findUnique).mockResolvedValue({ value: 4 } as never);

    const result = await getRatingSummary("doc_1", "user_1");

    expect(result.currentUserRating).toBe(4);
    expect(prisma.documentRating.findUnique).toHaveBeenCalledWith({
      where: { documentId_userId: { documentId: "doc_1", userId: "user_1" } },
      select: { value: true },
    });
  });

  test("returns currentUserRating=null when the caller hasn't rated this document", async () => {
    mockAggregate(4.5, 2);
    vi.mocked(prisma.documentRating.findUnique).mockResolvedValue(null);

    const result = await getRatingSummary("doc_1", "user_1");

    expect(result.currentUserRating).toBeNull();
  });
});
