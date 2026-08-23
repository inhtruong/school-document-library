import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { updateMany: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { POST } from "@/app/api/notifications/read-all/route";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role: "STUDENT" },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 } as never);
});

describe("POST /api/notifications/read-all", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  test("marks all of the caller's own unread notifications as read and returns the updated count", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 } as never);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ updatedCount: 3 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  test("does not affect another user's notifications", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_2"));

    await POST();

    const call = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as { where: { userId: string } };
    expect(call.where.userId).toBe("user_2");
  });
});

describe("read-all route — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor());
    vi.mocked(prisma.notification.updateMany).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
