import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/documents/lessons", () => ({
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { deleteLesson, updateLesson } from "@/lib/documents/lessons";
import { DELETE, PATCH } from "@/app/api/lessons/[lessonId]/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockUpdateLesson = vi.mocked(updateLesson);
const mockDeleteLesson = vi.mocked(deleteLesson);
const context = { params: Promise.resolve({ lessonId: "lesson_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "admin_1", name: "Admin", email: "admin@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/lessons/lesson_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/lessons/lesson_1", { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/lessons/:lessonId", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    expect(response.status).toBe(401);
    expect(mockUpdateLesson).not.toHaveBeenCalled();
  });

  test("updates successfully", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const lesson = { id: "lesson_1", name: "New Name", code: "MOTION", subjectId: "subject_1" };
    mockUpdateLesson.mockResolvedValue({ outcome: "success", lesson } as never);

    const response = await PATCH(patchRequest({ name: "New Name" }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(lesson);
  });

  test("returns 404 when the lesson does not exist", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateLesson.mockResolvedValue({ outcome: "not-found" } as never);

    const response = await PATCH(patchRequest({ name: "X" }), context);
    expect(response.status).toBe(404);
  });

  test("returns 409 on duplicate code", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockUpdateLesson.mockResolvedValue({ outcome: "duplicate" } as never);

    const response = await PATCH(patchRequest({ code: "KINEMATICS" }), context);
    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/lessons/:lessonId", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(401);
    expect(mockDeleteLesson).not.toHaveBeenCalled();
  });

  test("deletes successfully", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDeleteLesson.mockResolvedValue({ outcome: "success" } as never);

    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(200);
  });

  test("returns 409 when the lesson is in use", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDeleteLesson.mockResolvedValue({ outcome: "in-use" } as never);

    const response = await DELETE(deleteRequest(), context);
    expect(response.status).toBe(409);
  });
});
