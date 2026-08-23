import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { count: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { GET } from "@/app/api/notifications/unread-count/route";
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
  vi.mocked(prisma.notification.count).mockResolvedValue(0);
});

describe("GET /api/notifications/unread-count", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.notification.count).not.toHaveBeenCalled();
  });

  test("returns the caller's own unread count", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));
    vi.mocked(prisma.notification.count).mockResolvedValue(7);

    const response = await GET();
    const body = await response.json();

    expect(body.data).toEqual({ unreadCount: 7 });
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "user_1", readAt: null } });
  });

  test("never exposes another user's count — always scoped to the session's own userId", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_2"));

    await GET();

    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "user_2", readAt: null } });
  });
});
