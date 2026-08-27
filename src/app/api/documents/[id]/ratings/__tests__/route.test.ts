import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentRating: { aggregate: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/documents/[id]/ratings/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role: "STUDENT" },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function mockAggregate(avg: number | null, count: number) {
  vi.mocked(prisma.documentRating.aggregate).mockResolvedValue({
    _avg: { value: avg },
    _count: { value: count },
  } as never);
}

function requestFor() {
  return new NextRequest("http://localhost/api/documents/doc_1/ratings");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.document.findUnique).mockResolvedValue(
    { id: "doc_1", moderationStatus: "APPROVED", uploadedById: "user_1" } as never
  );
});

describe("GET /api/documents/:id/ratings — moderation visibility (FEAT-10A)", () => {
  test("a guest cannot read a PENDING document's rating summary (404)", async () => {
    mockAuth.mockResolvedValue(null);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { id: "doc_1", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );

    const response = await GET(requestFor(), context);

    expect(response.status).toBe(404);
    expect(prisma.documentRating.aggregate).not.toHaveBeenCalled();
  });

  test("an unrelated authenticated user cannot read a REJECTED document's rating summary (404)", async () => {
    mockAuth.mockResolvedValue(sessionFor("unrelated_user"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { id: "doc_1", moderationStatus: "REJECTED", uploadedById: "teacher_1" } as never
    );

    const response = await GET(requestFor(), context);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/documents/:id/ratings", () => {
  test("a guest can read the rating summary without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    mockAggregate(4.5, 2);

    const response = await GET(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.currentUserRating).toBeNull();
  });

  test("a document with zero ratings returns averageRating=null and ratingCount=0", async () => {
    mockAuth.mockResolvedValue(null);
    mockAggregate(null, 0);

    const response = await GET(requestFor(), context);
    const body = await response.json();

    expect(body.data).toEqual({ averageRating: null, ratingCount: 0, currentUserRating: null });
  });

  test("returns correct average and count for a rated document", async () => {
    mockAuth.mockResolvedValue(null);
    mockAggregate(4, 3);

    const response = await GET(requestFor(), context);
    const body = await response.json();

    expect(body.data.averageRating).toBe(4);
    expect(body.data.ratingCount).toBe(3);
  });

  test("includes the caller's own rating when authenticated", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    mockAggregate(4.5, 2);
    vi.mocked(prisma.documentRating.findUnique).mockResolvedValue({ value: 5 } as never);

    const response = await GET(requestFor(), context);
    const body = await response.json();

    expect(body.data.currentUserRating).toBe(5);
  });

  test("a nonexistent document returns 404 and never queries ratings", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);
    mockAuth.mockResolvedValue(null);

    const response = await GET(requestFor(), context);

    expect(response.status).toBe(404);
    expect(prisma.documentRating.aggregate).not.toHaveBeenCalled();
  });

  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(null);
    vi.mocked(prisma.document.findUnique).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
