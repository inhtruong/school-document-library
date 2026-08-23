import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { PATCH } from "@/app/api/notifications/[id]/read/route";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "n1" }) };

function sessionFor(userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role: "STUDENT" },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestFor() {
  return new NextRequest("http://localhost/api/notifications/n1/read", { method: "PATCH" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.notification.findUnique).mockResolvedValue({ id: "n1", userId: "user_1", readAt: null } as never);
  vi.mocked(prisma.notification.update).mockResolvedValue({} as never);
});

describe("PATCH /api/notifications/:id/read", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await PATCH(requestFor(), context);

    expect(response.status).toBe(401);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  test("the owner can mark their own notification as read", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));

    const response = await PATCH(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: "n1", read: true });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { readAt: expect.any(Date) },
    });
  });

  test("a repeated mark-read on an already-read notification is safe and idempotent", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "n1",
      userId: "user_1",
      readAt: new Date("2026-01-01T00:00:00.000Z"),
    } as never);

    const response = await PATCH(requestFor(), context);

    expect(response.status).toBe(200);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  test("cannot mark another user's notification as read — returns 404", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_2"));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({ id: "n1", userId: "user_1", readAt: null } as never);

    const response = await PATCH(requestFor(), context);

    expect(response.status).toBe(404);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  test("a missing notification returns 404", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

    const response = await PATCH(requestFor(), context);

    expect(response.status).toBe(404);
  });
});

describe("mark-read route — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor());
    vi.mocked(prisma.notification.findUnique).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await PATCH(requestFor(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
