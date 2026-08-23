import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentComment: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { COMMENTS_PAGE_SIZE } from "@/lib/documents/comment-config";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/documents/[id]/comments/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };
const now = new Date("2025-01-01T00:00:00.000Z");
const AUTHOR = { id: "user_1", name: "Sam Student", role: "STUDENT" };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function getRequest(query = "") {
  return new NextRequest(`http://localhost/api/documents/doc_1/comments${query}`);
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/documents/doc_1/comments", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: "doc_1" } as never);
  vi.mocked(prisma.documentComment.findMany).mockResolvedValue([]);
  vi.mocked(prisma.documentComment.count).mockResolvedValue(0);
});

describe("GET /api/documents/:id/comments — public read", () => {
  test("a guest can read comments without authentication", async () => {
    const response = await GET(getRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  test("an empty document returns an empty list, not an error", async () => {
    const response = await GET(getRequest(), context);
    const body = await response.json();

    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  test("each comment only exposes safe author fields (id, name, role)", async () => {
    vi.mocked(prisma.documentComment.findMany).mockResolvedValue([
      { id: "c1", content: "hi", createdAt: now, updatedAt: now, user: AUTHOR },
    ] as never);
    vi.mocked(prisma.documentComment.count).mockResolvedValue(1);

    const response = await GET(getRequest(), context);
    const body = await response.json();

    expect(body.data[0].author).toEqual(AUTHOR);
    expect(JSON.stringify(body.data[0])).not.toContain("email");
    expect(JSON.stringify(body.data[0])).not.toContain("passwordHash");
  });

  test("orders newest first and caps the page size", async () => {
    await GET(getRequest(), context);

    expect(prisma.documentComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: COMMENTS_PAGE_SIZE })
    );
  });

  test("a nonexistent document returns 404 and never queries comments", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await GET(getRequest(), context);

    expect(response.status).toBe(404);
    expect(prisma.documentComment.findMany).not.toHaveBeenCalled();
  });

  test("a database failure returns a generic 500 without leaking details", async () => {
    vi.mocked(prisma.document.findUnique).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(getRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("POST /api/documents/:id/comments — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(postRequest({ content: "hello" }), context);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(prisma.documentComment.create).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can create a comment", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));
    vi.mocked(prisma.documentComment.create).mockResolvedValue(
      { id: "c1", content: "hello", createdAt: now, updatedAt: now, user: AUTHOR } as never
    );

    const response = await POST(postRequest({ content: "hello" }), context);

    expect(response.status).toBe(201);
  });
});

describe("POST /api/documents/:id/comments — ownership", () => {
  test("userId always comes from the session, never the request body", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
    vi.mocked(prisma.documentComment.create).mockResolvedValue(
      { id: "c1", content: "hello", createdAt: now, updatedAt: now, user: AUTHOR } as never
    );

    await POST(postRequest({ content: "hello", userId: "attacker-controlled-id" }), context);

    expect(prisma.documentComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { documentId: "doc_1", userId: "user_1", content: "hello" } })
    );
  });
});

describe("POST /api/documents/:id/comments — validation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
  });

  test("rejects an empty comment", async () => {
    const response = await POST(postRequest({ content: "" }), context);
    expect(response.status).toBe(400);
    expect(prisma.documentComment.create).not.toHaveBeenCalled();
  });

  test("rejects a whitespace-only comment", async () => {
    const response = await POST(postRequest({ content: "    " }), context);
    expect(response.status).toBe(400);
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await POST(postRequest("{not valid json"), context);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/documents/:id/comments — missing document", () => {
  test("commenting on a nonexistent document returns 404", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await POST(postRequest({ content: "hello" }), context);

    expect(response.status).toBe(404);
    expect(prisma.documentComment.create).not.toHaveBeenCalled();
  });
});
