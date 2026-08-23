import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lesson: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/lessons/route";

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
