import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lesson: { findMany: vi.fn() } },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/documents/lessons", () => ({ createLesson: vi.fn() }));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createLesson } from "@/lib/documents/lessons";
import { GET, POST } from "@/app/api/lessons/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockCreateLesson = vi.mocked(createLesson);

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "admin_1", name: "Admin", email: "admin@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/lessons", () => {
  test("returns lessons filtered by subjectId", async () => {
    const lessons = [
      { id: "l1", name: "Derivatives", code: "DERIVATIVES", subjectId: "subject_math12" },
      { id: "l2", name: "Integrals", code: "INTEGRALS", subjectId: "subject_math12" },
    ];
    vi.mocked(prisma.lesson.findMany).mockResolvedValue(lessons as never);

    const response = await GET(new NextRequest("http://localhost/api/lessons?subjectId=subject_math12"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(lessons);
    expect(vi.mocked(prisma.lesson.findMany).mock.calls[0][0]).toMatchObject({
      where: { subjectId: "subject_math12" },
    });
  });

  test("returns 400 when subjectId is missing, without querying the database", async () => {
    const response = await GET(new NextRequest("http://localhost/api/lessons"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(prisma.lesson.findMany).not.toHaveBeenCalled();
  });

  test("a subjectId with no matching lessons returns an empty array, not an error", async () => {
    vi.mocked(prisma.lesson.findMany).mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost/api/lessons?subjectId=does-not-exist"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test("returns a generic 500 without leaking details on a database failure", async () => {
    vi.mocked(prisma.lesson.findMany).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(new NextRequest("http://localhost/api/lessons?subjectId=subject_math12"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("POST /api/lessons", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await POST(postRequest({ name: "Motion", code: "MOTION", subjectId: "subject_1" }));
    expect(response.status).toBe(401);
    expect(mockCreateLesson).not.toHaveBeenCalled();
  });

  test("a non-ADMIN gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));
    const response = await POST(postRequest({ name: "Motion", code: "MOTION", subjectId: "subject_1" }));
    expect(response.status).toBe(403);
  });

  test("an ADMIN creates a lesson", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const lesson = { id: "lesson_1", name: "Motion", code: "MOTION", subjectId: "subject_1" };
    mockCreateLesson.mockResolvedValue({ outcome: "created", lesson } as never);

    const response = await POST(postRequest({ name: "Motion", code: "MOTION", subjectId: "subject_1" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toEqual(lesson);
  });

  test("returns 404 when the subject does not exist", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockCreateLesson.mockResolvedValue({ outcome: "subject-not-found" } as never);

    const response = await POST(postRequest({ name: "Motion", code: "MOTION", subjectId: "missing" }));
    expect(response.status).toBe(404);
  });

  test("returns 409 on duplicate code", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockCreateLesson.mockResolvedValue({ outcome: "duplicate" } as never);

    const response = await POST(postRequest({ name: "Motion", code: "MOTION", subjectId: "subject_1" }));
    expect(response.status).toBe(409);
  });

  test("returns 400 for invalid input", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const response = await POST(postRequest({ name: "", code: "MOTION", subjectId: "subject_1" }));
    expect(response.status).toBe(400);
    expect(mockCreateLesson).not.toHaveBeenCalled();
  });
});
