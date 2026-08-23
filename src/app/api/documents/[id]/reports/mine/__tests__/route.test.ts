import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentReport: { findMany: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/documents/[id]/reports/mine/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role: "STUDENT" },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function request() {
  return new NextRequest("http://localhost/api/documents/doc_1/reports/mine");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.documentReport.findMany).mockResolvedValue([]);
});

describe("GET /api/documents/:id/reports/mine", () => {
  test("a guest gets 401", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(request(), context);

    expect(response.status).toBe(401);
    expect(prisma.documentReport.findMany).not.toHaveBeenCalled();
  });

  test("returns the caller's own OPEN report reasons, scoped by their userId", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([{ reason: "BROKEN_FILE" }] as never);

    const response = await GET(request(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.reportedReasons).toEqual(["BROKEN_FILE"]);
    expect(prisma.documentReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: "doc_1", userId: "user_1", status: "OPEN" } })
    );
  });

  test("returns an empty array when the caller has no open reports", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    vi.mocked(prisma.documentReport.findMany).mockResolvedValue([]);

    const response = await GET(request(), context);
    const body = await response.json();

    expect(body.data.reportedReasons).toEqual([]);
  });

  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    vi.mocked(prisma.documentReport.findMany).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(request(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
