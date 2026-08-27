import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentRating: { upsert: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { PUT } from "@/app/api/documents/[id]/rating/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestWith(body: unknown) {
  return new NextRequest("http://localhost/api/documents/doc_1/rating", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  vi.mocked(prisma.document.findUnique).mockResolvedValue(
    { id: "doc_1", moderationStatus: "APPROVED", uploadedById: "user_1" } as never
  );
  vi.mocked(prisma.documentRating.upsert).mockResolvedValue({ value: 4 } as never);
});

describe("PUT /api/documents/:id/rating — moderation visibility (FEAT-10A)", () => {
  test("an unrelated authenticated user cannot rate a PENDING document (404)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "unrelated_user", name: "Someone Else", email: "x@example.com", role: "STUDENT" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { id: "doc_1", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );

    const response = await PUT(requestWith({ value: 4 }), context);

    expect(response.status).toBe(404);
    expect(prisma.documentRating.upsert).not.toHaveBeenCalled();
  });

  test("the uploader CAN rate their own PENDING document", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "teacher_1", name: "Owner", email: "owner@example.com", role: "TEACHER" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { id: "doc_1", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );

    const response = await PUT(requestWith({ value: 4 }), context);

    expect(response.status).toBe(200);
  });
});

describe("PUT /api/documents/:id/rating — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await PUT(requestWith({ value: 4 }), context);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(prisma.documentRating.upsert).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can submit a rating", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const response = await PUT(requestWith({ value: 4 }), context);

    expect(response.status).toBe(200);
  });
});

describe("PUT /api/documents/:id/rating — validation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
  });

  test.each([1, 5])("accepts %i", async (value) => {
    const response = await PUT(requestWith({ value }), context);
    expect(response.status).toBe(200);
  });

  test.each([
    ["0", { value: 0 }],
    ["6", { value: 6 }],
    ["a decimal", { value: 3.5 }],
    ["a string", { value: "3" }],
    ["a missing value", {}],
  ])("rejects %s with 400 and never touches the database", async (_label, body) => {
    const response = await PUT(requestWith(body), context);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(prisma.documentRating.upsert).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await PUT(requestWith("{not valid json"), context);
    expect(response.status).toBe(400);
  });
});

describe("PUT /api/documents/:id/rating — one rating per user", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
  });

  test("upserts by the compound (documentId, userId) key — userId always comes from the session, not the body", async () => {
    await PUT(requestWith({ value: 4, userId: "someone-else" }), context);

    expect(prisma.documentRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId_userId: { documentId: "doc_1", userId: "user_1" } },
        create: { documentId: "doc_1", userId: "user_1", value: 4 },
        update: { value: 4 },
      })
    );
  });

  test("a client cannot spoof another user's rating via the request body", async () => {
    await PUT(requestWith({ value: 5, userId: "attacker-controlled-id" }), context);

    const call = vi.mocked(prisma.documentRating.upsert).mock.calls[0][0];
    expect(call.create).not.toHaveProperty("userId", "attacker-controlled-id");
    expect(call.where).toEqual({ documentId_userId: { documentId: "doc_1", userId: "user_1" } });
  });
});

describe("PUT /api/documents/:id/rating — missing document", () => {
  test("rating a nonexistent document returns 404 and never upserts", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await PUT(requestWith({ value: 4 }), context);

    expect(response.status).toBe(404);
    expect(prisma.documentRating.upsert).not.toHaveBeenCalled();
  });
});

describe("PUT /api/documents/:id/rating — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.documentRating.upsert).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await PUT(requestWith({ value: 4 }), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
