import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/documents/grades", () => ({
  updateGrade: vi.fn(),
  deleteGrade: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { deleteGrade, updateGrade } from "@/lib/documents/grades";
import { DELETE, PATCH } from "@/app/api/grades/[gradeId]/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockUpdateGrade = vi.mocked(updateGrade);
const mockDeleteGrade = vi.mocked(deleteGrade);
const context = { params: Promise.resolve({ gradeId: "grade_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "admin_1", name: "Admin", email: "admin@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/grades/grade_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/grades/grade_1", { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/grades/:gradeId — authorization", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    expect(response.status).toBe(401);
    expect(mockUpdateGrade).not.toHaveBeenCalled();
  });

  test("a non-ADMIN gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));
    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/grades/:gradeId — outcomes", () => {
  test("updates successfully", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const grade = { id: "grade_1", name: "New Name", code: "G10", sortOrder: 0 };
    mockUpdateGrade.mockResolvedValue({ outcome: "success", grade } as never);

    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(grade);
  });

  test("returns 404 when not found", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateGrade.mockResolvedValue({ outcome: "not-found" } as never);

    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    expect(response.status).toBe(404);
  });

  test("returns 409 on duplicate code", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateGrade.mockResolvedValue({ outcome: "duplicate" } as never);

    const response = await PATCH(patchRequest({ code: "G11" }), context);
    expect(response.status).toBe(409);
  });

  test("returns 400 for invalid input", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const response = await PATCH(patchRequest({ name: "" }), context);
    expect(response.status).toBe(400);
    expect(mockUpdateGrade).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/grades/:gradeId", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(401);
    expect(mockDeleteGrade).not.toHaveBeenCalled();
  });

  test("deletes successfully", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDeleteGrade.mockResolvedValue({ outcome: "success" } as never);

    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(200);
  });

  test("returns 404 when not found", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDeleteGrade.mockResolvedValue({ outcome: "not-found" } as never);

    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(404);
  });

  test("returns 409 when the grade is in use", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDeleteGrade.mockResolvedValue({ outcome: "in-use" } as never);

    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(409);
  });
});
