import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }] as never);
});

describe("GET /api/health", () => {
  test("returns 200 and status ok when the database is reachable", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", checks: { database: "ok" } });
  });

  test("returns 503 and status error when the database is unreachable", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "error", checks: { database: "error" } });
  });

  test("never leaks connection details in the response on failure", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error("password authentication failed for user \"postgres\" at 10.0.0.5:5432")
    );

    const response = await GET();
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
    expect(JSON.stringify(body)).not.toContain("postgres");
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
