import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/admin/reports", () => ({
  resolveReport: vi.fn(),
  dismissReport: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { dismissReport, resolveReport } from "@/lib/admin/reports";
import { PATCH } from "@/app/api/admin/reports/[reportId]/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const mockResolveReport = vi.mocked(resolveReport);
const mockDismissReport = vi.mocked(dismissReport);
const context = { params: Promise.resolve({ reportId: "report_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "admin_1", name: "Admin", email: "admin@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/reports/report_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/reports/:reportId — authorization", () => {
  test("a guest gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ status: "RESOLVED" }), context);

    expect(response.status).toBe(401);
    expect(mockResolveReport).not.toHaveBeenCalled();
  });

  test("a STUDENT gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await PATCH(patchRequest({ status: "RESOLVED" }), context);

    expect(response.status).toBe(403);
  });

  test("a TEACHER gets 403", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER"));

    const response = await PATCH(patchRequest({ status: "RESOLVED" }), context);

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/admin/reports/:reportId — outcomes", () => {
  test("an ADMIN resolves a report", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockResolveReport.mockResolvedValue({ outcome: "success" });

    const response = await PATCH(patchRequest({ status: "RESOLVED" }), context);

    expect(response.status).toBe(200);
    expect(mockResolveReport).toHaveBeenCalledWith("report_1", expect.objectContaining({ id: "admin_1" }));
    expect(mockDismissReport).not.toHaveBeenCalled();
  });

  test("an ADMIN dismisses a report", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockDismissReport.mockResolvedValue({ outcome: "success" });

    const response = await PATCH(patchRequest({ status: "DISMISSED" }), context);

    expect(response.status).toBe(200);
    expect(mockDismissReport).toHaveBeenCalledWith("report_1", expect.objectContaining({ id: "admin_1" }));
    expect(mockResolveReport).not.toHaveBeenCalled();
  });

  test("returns 404 when the report does not exist", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockResolveReport.mockResolvedValue({ outcome: "not-found" });

    const response = await PATCH(patchRequest({ status: "RESOLVED" }), context);

    expect(response.status).toBe(404);
  });

  test("returns 409 when the report was already handled", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    mockResolveReport.mockResolvedValue({ outcome: "already-handled" });

    const response = await PATCH(patchRequest({ status: "RESOLVED" }), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("REPORT_ALREADY_HANDLED");
  });

  test("returns 400 for an invalid status", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));

    const response = await PATCH(patchRequest({ status: "OPEN" }), context);

    expect(response.status).toBe(400);
    expect(mockResolveReport).not.toHaveBeenCalled();
  });

  test("returns 400 for a malformed JSON body", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));
    const request = new NextRequest("http://localhost/api/admin/reports/report_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    const response = await PATCH(request, context);

    expect(response.status).toBe(400);
  });
});
