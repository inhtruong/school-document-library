import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { groupBy: vi.fn() },
    subject: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/documents/subjects", () => ({ createSubject: vi.fn() }));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createSubject } from "@/lib/documents/subjects";
import { GET, POST } from "@/app/api/subjects/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockCreateSubject = vi.mocked(createSubject);

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "admin_1", name: "Admin", email: "admin@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/subjects — no gradeId (unchanged homepage/search behavior)", () => {
  test("groups documents by the legacy subject text with counts", async () => {
    vi.mocked(prisma.document.groupBy).mockResolvedValue([
      { subject: "Database", _count: { _all: 4 } },
      { subject: "Mathematics", _count: { _all: 2 } },
    ] as never);

    const response = await GET(new NextRequest("http://localhost/api/subjects"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      { subject: "Database", count: 4 },
      { subject: "Mathematics", count: 2 },
    ]);
    expect(prisma.subject.findMany).not.toHaveBeenCalled();
  });

  test("returns a generic 500 without leaking details on a database failure", async () => {
    vi.mocked(prisma.document.groupBy).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(new NextRequest("http://localhost/api/subjects"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("GET /api/subjects?gradeId=... (taxonomy read API)", () => {
  test("returns Subject rows for that Grade instead of the legacy grouping", async () => {
    const subjects = [
      { id: "s1", name: "Mathematics", code: "MATH", gradeId: "grade_12" },
      { id: "s2", name: "Physics", code: "PHYSICS", gradeId: "grade_12" },
    ];
    vi.mocked(prisma.subject.findMany).mockResolvedValue(subjects as never);

    const response = await GET(new NextRequest("http://localhost/api/subjects?gradeId=grade_12"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(subjects);
    expect(vi.mocked(prisma.subject.findMany).mock.calls[0][0]).toMatchObject({
      where: { gradeId: "grade_12" },
    });
    expect(prisma.document.groupBy).not.toHaveBeenCalled();
  });

  test("a gradeId with no subjects returns an empty array, not an error", async () => {
    vi.mocked(prisma.subject.findMany).mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost/api/subjects?gradeId=does-not-exist"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });
});

describe("POST /api/subjects", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await POST(postRequest({ name: "Mathematics", code: "MATH", gradeId: "grade_1" }));
    expect(response.status).toBe(401);
    expect(mockCreateSubject).not.toHaveBeenCalled();
  });

  test("a non-ADMIN gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));
    const response = await POST(postRequest({ name: "Mathematics", code: "MATH", gradeId: "grade_1" }));
    expect(response.status).toBe(403);
  });

  test("an ADMIN creates a subject", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const subject = { id: "subject_1", name: "Mathematics", code: "MATH", gradeId: "grade_1" };
    mockCreateSubject.mockResolvedValue({ outcome: "created", subject } as never);

    const response = await POST(postRequest({ name: "Mathematics", code: "MATH", gradeId: "grade_1" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toEqual(subject);
  });

  test("returns 404 when the grade does not exist", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockCreateSubject.mockResolvedValue({ outcome: "grade-not-found" } as never);

    const response = await POST(postRequest({ name: "Mathematics", code: "MATH", gradeId: "missing" }));
    expect(response.status).toBe(404);
  });

  test("returns 409 on duplicate code", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockCreateSubject.mockResolvedValue({ outcome: "duplicate" } as never);

    const response = await POST(postRequest({ name: "Mathematics", code: "MATH", gradeId: "grade_1" }));
    expect(response.status).toBe(409);
  });

  test("returns 400 for invalid input", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const response = await POST(postRequest({ name: "", code: "MATH", gradeId: "grade_1" }));
    expect(response.status).toBe(400);
    expect(mockCreateSubject).not.toHaveBeenCalled();
  });
});
