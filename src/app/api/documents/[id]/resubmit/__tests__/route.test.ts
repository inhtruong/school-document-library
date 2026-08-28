import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/documents/teacher-uploads", () => ({
  resubmitDocument: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { resubmitDocument } from "@/lib/documents/teacher-uploads";
import { POST } from "@/app/api/documents/[id]/resubmit/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockResubmit = vi.mocked(resubmitDocument);
const context = { params: Promise.resolve({ id: "doc_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "teacher_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestFor() {
  return new NextRequest("http://localhost/api/documents/doc_1/resubmit", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResubmit.mockResolvedValue({ outcome: "success" });
});

describe("POST /api/documents/:id/resubmit — authorization", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(401);
    expect(mockResubmit).not.toHaveBeenCalled();
  });

  test("the owning TEACHER succeeds", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));

    const response = await POST(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.moderationStatus).toBe("PENDING");
  });

  test("a STUDENT session is rejected by ownership, never a document match", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "student_1"));
    mockResubmit.mockResolvedValue({ outcome: "forbidden" });

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(403);
    expect(mockResubmit).toHaveBeenCalledWith("student_1", "doc_1");
  });

  test("an unrelated Teacher (not the uploader) gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "other_teacher"));
    mockResubmit.mockResolvedValue({ outcome: "forbidden" });

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(403);
  });
});

describe("POST /api/documents/:id/resubmit — uploader identity", () => {
  test("the uploader id always comes from the session, never the request body/URL", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));

    await POST(requestFor(), context);

    expect(mockResubmit).toHaveBeenCalledWith("teacher_1", "doc_1");
  });
});

describe("POST /api/documents/:id/resubmit — state transitions", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));
  });

  test("a document that is not REJECTED returns 409", async () => {
    mockResubmit.mockResolvedValue({ outcome: "not-rejected" });

    const response = await POST(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
  });

  test("a missing document returns 404", async () => {
    mockResubmit.mockResolvedValue({ outcome: "not-found" });

    const response = await POST(requestFor(), context);

    expect(response.status).toBe(404);
  });
});

describe("POST /api/documents/:id/resubmit — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));
    mockResubmit.mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await POST(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
