import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/moderation/moderation", () => ({
  rejectDocument: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { rejectDocument } from "@/lib/moderation/moderation";
import { POST } from "@/app/api/moderation/documents/[id]/reject/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockReject = vi.mocked(rejectDocument);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestWith(body: unknown) {
  return new NextRequest("http://localhost/api/moderation/documents/doc_1/reject", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReject.mockResolvedValue({ outcome: "success" });
});

describe("POST /api/moderation/documents/:id/reject — authorization", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(requestWith({ reason: "test" }), context);

    expect(response.status).toBe(401);
    expect(mockReject).not.toHaveBeenCalled();
  });

  test("a STUDENT gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await POST(requestWith({ reason: "test" }), context);

    expect(response.status).toBe(403);
    expect(mockReject).not.toHaveBeenCalled();
  });

  test("a TEACHER gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));

    const response = await POST(requestWith({ reason: "test" }), context);

    expect(response.status).toBe(403);
    expect(mockReject).not.toHaveBeenCalled();
  });

  test("ADMIN succeeds", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));

    const response = await POST(requestWith({ reason: "Wrong grade level" }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.moderationStatus).toBe("REJECTED");
  });
});

describe("POST /api/moderation/documents/:id/reject — reviewer identity", () => {
  test("the reviewer id always comes from the session, never the request body", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));

    await POST(requestWith({ reason: "test", reviewedById: "attacker-controlled-id" }), context);

    expect(mockReject).toHaveBeenCalledWith("doc_1", "admin_1", { reason: "test", reviewedById: "attacker-controlled-id" });
  });
});

describe("POST /api/moderation/documents/:id/reject — validation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await POST(requestWith("{not valid json"), context);

    expect(response.status).toBe(400);
    expect(mockReject).not.toHaveBeenCalled();
  });

  test("propagates an invalid-reason outcome from the service layer as 400", async () => {
    mockReject.mockResolvedValue({ outcome: "invalid", error: "A rejection reason is required" });

    const response = await POST(requestWith({ reason: "" }), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("A rejection reason is required");
  });
});

describe("POST /api/moderation/documents/:id/reject — state transitions", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
  });

  test("a document that is no longer PENDING returns 409", async () => {
    mockReject.mockResolvedValue({ outcome: "not-pending" });

    const response = await POST(requestWith({ reason: "test" }), context);

    expect(response.status).toBe(409);
  });

  test("a missing document returns 404", async () => {
    mockReject.mockResolvedValue({ outcome: "not-found" });

    const response = await POST(requestWith({ reason: "test" }), context);

    expect(response.status).toBe(404);
  });
});

describe("POST /api/moderation/documents/:id/reject — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockReject.mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await POST(requestWith({ reason: "test" }), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
