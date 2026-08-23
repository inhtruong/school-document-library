import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { groupBy: vi.fn() },
    subject: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/subjects/route";

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
