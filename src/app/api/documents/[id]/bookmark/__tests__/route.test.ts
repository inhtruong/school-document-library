import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentBookmark: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, GET, POST } from "@/app/api/documents/[id]/bookmark/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestFor(method: "GET" | "POST" | "DELETE") {
  return new NextRequest("http://localhost/api/documents/doc_1/bookmark", { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.document.findUnique).mockResolvedValue(
    { id: "doc_1", moderationStatus: "APPROVED", uploadedById: "user_1" } as never
  );
  vi.mocked(prisma.documentBookmark.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.documentBookmark.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.documentBookmark.deleteMany).mockResolvedValue({ count: 1 } as never);
});

describe("GET/POST /api/documents/:id/bookmark — moderation visibility (FEAT-10A)", () => {
  test("an unrelated authenticated user cannot read bookmark state for a PENDING document (404)", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "unrelated_user"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { id: "doc_1", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );

    const response = await GET(requestFor("GET"), context);

    expect(response.status).toBe(404);
  });

  test("an unrelated authenticated user cannot bookmark a PENDING document (404)", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "unrelated_user"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { id: "doc_1", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(404);
    expect(prisma.documentBookmark.upsert).not.toHaveBeenCalled();
  });

  test("the uploader CAN bookmark their own PENDING document", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { id: "doc_1", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(200);
  });
});

describe("GET /api/documents/:id/bookmark", () => {
  test("a guest (no session) gets 401", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(requestFor("GET"), context);

    expect(response.status).toBe(401);
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can read their own bookmark state", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const response = await GET(requestFor("GET"), context);

    expect(response.status).toBe(200);
  });

  test("returns bookmarked=false when no bookmark exists", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.documentBookmark.findUnique).mockResolvedValue(null);

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(body.data).toEqual({ bookmarked: false });
  });

  test("returns bookmarked=true when a bookmark exists", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.documentBookmark.findUnique).mockResolvedValue({ id: "bookmark_1" } as never);

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(body.data).toEqual({ bookmarked: true });
  });

  test("scopes the lookup to the caller's own userId, never another user's", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await GET(requestFor("GET"), context);

    expect(prisma.documentBookmark.findUnique).toHaveBeenCalledWith({
      where: { documentId_userId: { documentId: "doc_1", userId: "user_1" } },
      select: { id: true },
    });
  });

  test("a nonexistent document returns 404 and never queries a bookmark", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await GET(requestFor("GET"), context);

    expect(response.status).toBe(404);
    expect(prisma.documentBookmark.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/documents/:id/bookmark — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(401);
    expect(prisma.documentBookmark.upsert).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can bookmark a document", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const response = await POST(requestFor("POST"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ bookmarked: true });
  });
});

describe("POST /api/documents/:id/bookmark — idempotency and ownership", () => {
  test("the first add creates the bookmark via an idempotent upsert scoped to the session's userId", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await POST(requestFor("POST"), context);

    expect(prisma.documentBookmark.upsert).toHaveBeenCalledWith({
      where: { documentId_userId: { documentId: "doc_1", userId: "user_1" } },
      create: { documentId: "doc_1", userId: "user_1" },
      update: {},
    });
  });

  test("a duplicate add does not create a duplicate row — the same idempotent upsert runs again", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await POST(requestFor("POST"), context);
    await POST(requestFor("POST"), context);

    expect(prisma.documentBookmark.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.documentBookmark.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { documentId_userId: { documentId: "doc_1", userId: "user_1" } } })
    );
  });
});

describe("POST /api/documents/:id/bookmark — missing document", () => {
  test("bookmarking a nonexistent document returns 404 and never upserts", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(404);
    expect(prisma.documentBookmark.upsert).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/documents/:id/bookmark", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(requestFor("DELETE"), context);

    expect(response.status).toBe(401);
    expect(prisma.documentBookmark.deleteMany).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can remove their bookmark", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const response = await DELETE(requestFor("DELETE"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ bookmarked: false });
  });

  test("removes scoped to the session's own userId, never another user's bookmark", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await DELETE(requestFor("DELETE"), context);

    expect(prisma.documentBookmark.deleteMany).toHaveBeenCalledWith({
      where: { documentId: "doc_1", userId: "user_1" },
    });
  });

  test("removing a bookmark that doesn't exist is handled safely, not as an error", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.documentBookmark.deleteMany).mockResolvedValue({ count: 0 } as never);

    const response = await DELETE(requestFor("DELETE"), context);

    expect(response.status).toBe(200);
  });
});

describe("bookmark route — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.document.findUnique).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
