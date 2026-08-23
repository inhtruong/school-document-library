import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentReport: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/documents/[id]/reports/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/documents/doc_1/reports", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: "doc_1" } as never);
  vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.documentReport.create).mockResolvedValue(
    { id: "report_1", reason: "BROKEN_FILE", status: "OPEN" } as never
  );
});

describe("POST /api/documents/:id/reports — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(postRequest({ reason: "BROKEN_FILE" }), context);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(prisma.documentReport.create).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can submit a report", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const response = await POST(postRequest({ reason: "BROKEN_FILE" }), context);

    expect(response.status).toBe(201);
  });
});

describe("POST /api/documents/:id/reports — ownership", () => {
  test("userId always comes from the session, never the request body", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await POST(postRequest({ reason: "BROKEN_FILE", userId: "attacker-controlled-id" }), context);

    expect(prisma.documentReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user_1" }) })
    );
  });

  test("documentId always comes from the route, never the request body", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await POST(postRequest({ reason: "BROKEN_FILE", documentId: "attacker-controlled-doc" }), context);

    expect(prisma.documentReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ documentId: "doc_1" }) })
    );
  });

  test("status is always OPEN on create, regardless of what the client sends", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await POST(postRequest({ reason: "BROKEN_FILE", status: "RESOLVED" }), context);

    expect(prisma.documentReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "OPEN" }) })
    );
  });
});

describe("POST /api/documents/:id/reports — validation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
  });

  test("accepts a valid reason", async () => {
    const response = await POST(postRequest({ reason: "COPYRIGHT" }), context);
    expect(response.status).toBe(201);
  });

  test("rejects an invalid reason", async () => {
    const response = await POST(postRequest({ reason: "NOT_A_REAL_REASON" }), context);
    expect(response.status).toBe(400);
    expect(prisma.documentReport.create).not.toHaveBeenCalled();
  });

  test("rejects OTHER without a description", async () => {
    const response = await POST(postRequest({ reason: "OTHER" }), context);
    expect(response.status).toBe(400);
  });

  test("accepts OTHER with a description", async () => {
    vi.mocked(prisma.documentReport.create).mockResolvedValue(
      { id: "report_2", reason: "OTHER", status: "OPEN" } as never
    );
    const response = await POST(postRequest({ reason: "OTHER", description: "Something specific" }), context);
    expect(response.status).toBe(201);
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await POST(postRequest("{not valid json"), context);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/documents/:id/reports — missing document", () => {
  test("reporting a nonexistent document returns 404", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await POST(postRequest({ reason: "BROKEN_FILE" }), context);

    expect(response.status).toBe(404);
    expect(prisma.documentReport.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/documents/:id/reports — duplicate prevention", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
  });

  test("the first OPEN report for a reason is accepted", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);

    const response = await POST(postRequest({ reason: "BROKEN_FILE" }), context);

    expect(response.status).toBe(201);
  });

  test("a second OPEN report for the same document/reason is rejected with 409 and a friendly message", async () => {
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue({ id: "existing" } as never);

    const response = await POST(postRequest({ reason: "BROKEN_FILE" }), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("You have already reported this issue.");
    expect(prisma.documentReport.create).not.toHaveBeenCalled();
  });

  test("a different reason for the same document is accepted even with an existing OPEN report for another reason", async () => {
    // findFirst is scoped by reason internally — simulate "no match for this specific reason".
    vi.mocked(prisma.documentReport.findFirst).mockResolvedValue(null);

    const response = await POST(postRequest({ reason: "WRONG_CONTENT" }), context);

    expect(response.status).toBe(201);
  });
});

describe("POST /api/documents/:id/reports — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.documentReport.findFirst).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await POST(postRequest({ reason: "BROKEN_FILE" }), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
