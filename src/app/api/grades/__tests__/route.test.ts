import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { grade: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/grades/route";

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
