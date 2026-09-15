import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { grade: { findMany: vi.fn() } },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/documents/grades", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/documents/grades")>();
  return { ...actual, createGrade: vi.fn() };
});

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createGrade } from "@/lib/documents/grades";
import { GET, POST } from "@/app/api/grades/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockCreateGrade = vi.mocked(createGrade);

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "user_1", name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/grades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/grades", () => {
  test("returns grades ordered by sortOrder", async () => {
    const grades = [
      { id: "g10", name: "Grade 10", code: "G10", sortOrder: 10 },
      { id: "g11", name: "Grade 11", code: "G11", sortOrder: 11 },
      { id: "g12", name: "Grade 12", code: "G12", sortOrder: 12 },
    ];
    vi.mocked(prisma.grade.findMany).mockResolvedValue(grades as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(grades);
    expect(vi.mocked(prisma.grade.findMany).mock.calls[0][0]).toMatchObject({
      orderBy: { sortOrder: "asc" },
    });
  });

  test("returns a generic 500 without leaking details on a database failure", async () => {
    vi.mocked(prisma.grade.findMany).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("POST /api/grades", () => {
  test("a guest gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(postRequest({ name: "Grade 10", code: "G10" }));

    expect(response.status).toBe(401);
    expect(mockCreateGrade).not.toHaveBeenCalled();
  });

  test("a non-ADMIN gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));

    const response = await POST(postRequest({ name: "Grade 10", code: "G10" }));

    expect(response.status).toBe(403);
    expect(mockCreateGrade).not.toHaveBeenCalled();
  });

  test("an ADMIN creates a grade", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const grade = { id: "grade_1", name: "Grade 10", code: "G10", sortOrder: 0 };
    mockCreateGrade.mockResolvedValue({ outcome: "created", grade } as never);

    const response = await POST(postRequest({ name: "Grade 10", code: "G10" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toEqual(grade);
  });

  test("returns 400 with the validation error code for invalid input", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));

    const response = await POST(postRequest({ name: "", code: "G10" }));

    expect(response.status).toBe(400);
    expect(mockCreateGrade).not.toHaveBeenCalled();
  });

  test("returns 409 when the grade code already exists", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockCreateGrade.mockResolvedValue({ outcome: "duplicate" } as never);

    const response = await POST(postRequest({ name: "Grade 10", code: "G10" }));

    expect(response.status).toBe(409);
  });

  test("returns 400 for a malformed JSON body", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const request = new NextRequest("http://localhost/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
