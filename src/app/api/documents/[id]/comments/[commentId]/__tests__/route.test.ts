import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentComment: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, PUT } from "@/app/api/documents/[id]/comments/[commentId]/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1", commentId: "comment_1" }) };
const now = new Date("2025-01-01T00:00:00.000Z");
const AUTHOR = { id: "user_1", name: "Sam Student", role: "STUDENT" };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId: string): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/documents/doc_1/comments/comment_1", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/documents/doc_1/comments/comment_1", { method: "DELETE" });
}

const OWNED_COMMENT = { id: "comment_1", documentId: "doc_1", userId: "user_1", content: "hi", createdAt: now, updatedAt: now };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.documentComment.findUnique).mockResolvedValue(OWNED_COMMENT as never);
  vi.mocked(prisma.documentComment.update).mockResolvedValue(
    { id: "comment_1", content: "edited", createdAt: now, updatedAt: now, user: AUTHOR } as never
  );
});

describe("PUT /api/documents/:id/comments/:commentId — ownership", () => {
  test("a guest (no session) gets 401", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await PUT(putRequest({ content: "edited" }), context);

    expect(response.status).toBe(401);
    expect(prisma.documentComment.update).not.toHaveBeenCalled();
  });

  test("the owner can edit their own comment", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    const response = await PUT(putRequest({ content: "edited" }), context);

    expect(response.status).toBe(200);
    expect(prisma.documentComment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "comment_1" }, data: { content: "edited" } })
    );
  });

  test("a different user cannot edit someone else's comment (403)", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_2"));

    const response = await PUT(putRequest({ content: "edited" }), context);

    expect(response.status).toBe(403);
    expect(prisma.documentComment.update).not.toHaveBeenCalled();
  });

  test("ADMIN cannot edit another user's comment either — moderation only deletes, never impersonates", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));

    const response = await PUT(putRequest({ content: "edited by admin" }), context);

    expect(response.status).toBe(403);
    expect(prisma.documentComment.update).not.toHaveBeenCalled();
  });

  test("rejects invalid content with 400 and never touches the database", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    const response = await PUT(putRequest({ content: "" }), context);

    expect(response.status).toBe(400);
    expect(prisma.documentComment.update).not.toHaveBeenCalled();
  });

  test("a comment belonging to a different Document cannot be edited through this Document's route", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
    vi.mocked(prisma.documentComment.findUnique).mockResolvedValue({
      ...OWNED_COMMENT,
      documentId: "doc_OTHER",
    } as never);

    const response = await PUT(putRequest({ content: "edited" }), context);

    expect(response.status).toBe(404);
    expect(prisma.documentComment.update).not.toHaveBeenCalled();
  });

  test("editing a nonexistent comment returns 404", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
    vi.mocked(prisma.documentComment.findUnique).mockResolvedValue(null);

    const response = await PUT(putRequest({ content: "edited" }), context);

    expect(response.status).toBe(404);
  });

  test("stores and returns XSS-like content as plain text, never treated as HTML", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
    const payload = "<script>alert(1)</script>";
    vi.mocked(prisma.documentComment.update).mockResolvedValue(
      { id: "comment_1", content: payload, createdAt: now, updatedAt: now, user: AUTHOR } as never
    );

    const response = await PUT(putRequest({ content: payload }), context);
    const body = await response.json();

    expect(prisma.documentComment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { content: payload } })
    );
    expect(body.data.content).toBe(payload);
  });
});

describe("DELETE /api/documents/:id/comments/:commentId — permissions", () => {
  test("a guest (no session) gets 401", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(401);
    expect(prisma.documentComment.delete).not.toHaveBeenCalled();
  });

  test("the owner (STUDENT) can delete their own comment", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(200);
    expect(prisma.documentComment.delete).toHaveBeenCalledWith({ where: { id: "comment_1" } });
  });

  test("the owner (TEACHER) can delete their own comment", async () => {
    vi.mocked(prisma.documentComment.findUnique).mockResolvedValue({
      ...OWNED_COMMENT,
      userId: "teacher_1",
    } as never);
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(200);
  });

  test("a STUDENT cannot delete another user's comment (403)", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_2"));

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(403);
    expect(prisma.documentComment.delete).not.toHaveBeenCalled();
  });

  test("a TEACHER cannot delete another user's comment (403)", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_2"));

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(403);
    expect(prisma.documentComment.delete).not.toHaveBeenCalled();
  });

  test("ADMIN can delete any user's comment", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(200);
    expect(prisma.documentComment.delete).toHaveBeenCalledWith({ where: { id: "comment_1" } });
  });

  test("ADMIN can delete their own comment too", async () => {
    vi.mocked(prisma.documentComment.findUnique).mockResolvedValue({
      ...OWNED_COMMENT,
      userId: "admin_1",
    } as never);
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(200);
  });

  test("a comment belonging to a different Document cannot be deleted through this Document's route", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));
    vi.mocked(prisma.documentComment.findUnique).mockResolvedValue({
      ...OWNED_COMMENT,
      documentId: "doc_OTHER",
    } as never);

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(404);
    expect(prisma.documentComment.delete).not.toHaveBeenCalled();
  });

  test("deleting a nonexistent comment returns 404", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
    vi.mocked(prisma.documentComment.findUnique).mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(404);
  });

  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));
    vi.mocked(prisma.documentComment.delete).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await DELETE(deleteRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
