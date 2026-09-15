import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/documents/subjects", () => ({
  updateSubject: vi.fn(),
  deleteSubject: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { deleteSubject, updateSubject } from "@/lib/documents/subjects";
import { DELETE, PATCH } from "@/app/api/subjects/[subjectId]/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockUpdateSubject = vi.mocked(updateSubject);
const mockDeleteSubject = vi.mocked(deleteSubject);
const context = { params: Promise.resolve({ subjectId: "subject_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "admin_1", name: "Admin", email: "admin@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/subjects/subject_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/subjects/subject_1", { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/subjects/:subjectId", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    expect(response.status).toBe(401);
    expect(mockUpdateSubject).not.toHaveBeenCalled();
  });

  test("updates successfully", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const subject = { id: "subject_1", name: "New Name", code: "MATH", gradeId: "grade_1" };
    mockUpdateSubject.mockResolvedValue({ outcome: "success", subject } as never);

    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(subject);
  });

  test("returns 404 when the subject does not exist", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateSubject.mockResolvedValue({ outcome: "not-found" } as never);

    const response = await PATCH(patchRequest({ name: "X" }), context);
    expect(response.status).toBe(404);
  });

  test("returns 409 on duplicate code", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateSubject.mockResolvedValue({ outcome: "duplicate" } as never);

    const response = await PATCH(patchRequest({ code: "PHYS" }), context);
    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/subjects/:subjectId", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(401);
    expect(mockDeleteSubject).not.toHaveBeenCalled();
  });

  test("deletes successfully", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDeleteSubject.mockResolvedValue({ outcome: "success" } as never);

    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(200);
  });

  test("returns 409 when the subject is in use", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDeleteSubject.mockResolvedValue({ outcome: "in-use" } as never);

    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(409);
  });
});
