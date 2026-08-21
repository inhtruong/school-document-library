import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/documents/upload", () => ({ uploadDocument: vi.fn() }));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { uploadDocument } from "@/lib/documents/upload";
import { POST } from "@/app/api/documents/upload/route";

// `auth` is polymorphic (plain call vs. middleware signature); pin the overload we use.
const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", id = "user_1"): Session {
  return {
    user: { id, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestWith(formData: FormData) {
  return new NextRequest("http://localhost/api/documents/upload", { method: "POST", body: formData });
}

const mockDocument = { id: "doc_1", title: "Midterm Exam" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/documents/upload", () => {
  test("returns 401 for a guest (no session) and never calls the upload service", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(requestWith(new FormData()));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  test("returns 403 for a STUDENT session and never calls the upload service", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await POST(requestWith(new FormData()));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  test("allows a TEACHER session and passes session.user.id as the uploaderId", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));
    vi.mocked(uploadDocument).mockResolvedValue({ success: true, document: mockDocument as never });

    const response = await POST(requestWith(new FormData()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockDocument);
    expect(vi.mocked(uploadDocument).mock.calls[0][0].uploaderId).toBe("teacher_1");
  });

  test("allows an ADMIN session", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN", "admin_1"));
    vi.mocked(uploadDocument).mockResolvedValue({ success: true, document: mockDocument as never });

    const response = await POST(requestWith(new FormData()));

    expect(response.status).toBe(201);
    expect(vi.mocked(uploadDocument).mock.calls[0][0].uploaderId).toBe("admin_1");
  });

  test("ignores a client-supplied uploader field and always uses the session's user id", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));
    vi.mocked(uploadDocument).mockResolvedValue({ success: true, document: mockDocument as never });

    const formData = new FormData();
    formData.set("uploadedById", "someone-else");

    await POST(requestWith(formData));

    expect(vi.mocked(uploadDocument).mock.calls[0][0].uploaderId).toBe("teacher_1");
  });

  test("returns the service's error status and message on failure", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));
    vi.mocked(uploadDocument).mockResolvedValue({ success: false, error: "Only PDF files are allowed", status: 400 });

    const response = await POST(requestWith(new FormData()));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Only PDF files are allowed");
  });
});
