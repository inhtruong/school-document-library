import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/moderation/moderation", () => ({
  approveDocument: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { approveDocument } from "@/lib/moderation/moderation";
import { POST } from "@/app/api/moderation/documents/[id]/approve/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockApprove = vi.mocked(approveDocument);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestFor() {
  return new NextRequest("http://localhost/api/moderation/documents/doc_1/approve", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApprove.mockResolvedValue({ outcome: "success" });
});

describe("POST /api/moderation/documents/:id/approve — authorization", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(401);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  test("a STUDENT gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(403);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  test("a TEACHER gets 403, even if they uploaded the document", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(403);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  test("ADMIN succeeds", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));

    const response = await POST(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.moderationStatus).toBe("APPROVED");
  });
});

describe("POST /api/moderation/documents/:id/approve — reviewer identity", () => {
  test("the reviewer id always comes from the session, never the request body/URL", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));

    await POST(requestFor(), context);

    expect(mockApprove).toHaveBeenCalledWith("doc_1", "admin_1");
  });
});

describe("POST /api/moderation/documents/:id/approve — state transitions", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
  });

  test("a document that is no longer PENDING returns 409", async () => {
    mockApprove.mockResolvedValue({ outcome: "not-pending" });

    const response = await POST(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
  });

  test("a missing document returns 404", async () => {
    mockApprove.mockResolvedValue({ outcome: "not-found" });

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(404);
  });
});

describe("POST /api/moderation/documents/:id/approve — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockApprove.mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await POST(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
