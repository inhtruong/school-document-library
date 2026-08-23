import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { GET } from "@/app/api/notifications/route";
import { prisma } from "@/lib/prisma";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/notifications/notification-config";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

function sessionFor(userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role: "STUDENT" },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestFor(url: string) {
  return new NextRequest(url);
}

const NOTIFICATION_1 = {
  id: "n1",
  userId: "user_1",
  documentId: "doc_1",
  type: "NEW_DOCUMENT",
  title: "New document available",
  message: "Teacher Tara uploaded \"Exam\" for Derivatives.",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  readAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.notification.findMany).mockResolvedValue([NOTIFICATION_1] as never);
  vi.mocked(prisma.notification.count).mockResolvedValue(1);
});

describe("GET /api/notifications — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(requestFor("http://localhost/api/notifications"));

    expect(response.status).toBe(401);
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/notifications — scoping and ordering", () => {
  test("only returns the current user's own notifications, ordered newest first", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));

    await GET(requestFor("http://localhost/api/notifications"));

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_1" }, orderBy: { createdAt: "desc" } })
    );
  });

  test("never accepts a userId from the query string — always the session's own id", async () => {
    mockAuth.mockResolvedValue(sessionFor("user_1"));

    await GET(requestFor("http://localhost/api/notifications?userId=someone-else"));

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_1" } })
    );
  });
});

describe("GET /api/notifications — pagination and unreadCount", () => {
  test("defaults to page 1 and returns meta with total/pageSize/totalPages/unreadCount", async () => {
    mockAuth.mockResolvedValue(sessionFor());
    vi.mocked(prisma.notification.count).mockImplementation(
      (args) => Promise.resolve(args?.where?.readAt === null ? 2 : 5) as never
    );

    const response = await GET(requestFor("http://localhost/api/notifications"));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.meta).toEqual(
      expect.objectContaining({ page: 1, pageSize: NOTIFICATIONS_PAGE_SIZE, total: 5, unreadCount: 2 })
    );
  });

  test("honors ?page= and computes skip accordingly", async () => {
    mockAuth.mockResolvedValue(sessionFor());

    await GET(requestFor("http://localhost/api/notifications?page=2"));

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: NOTIFICATIONS_PAGE_SIZE, take: NOTIFICATIONS_PAGE_SIZE })
    );
  });

  test("an invalid ?page= falls back to page 1", async () => {
    mockAuth.mockResolvedValue(sessionFor());

    const response = await GET(requestFor("http://localhost/api/notifications?page=not-a-number"));
    const body = await response.json();

    expect(body.meta.page).toBe(1);
  });
});

describe("notifications route — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor());
    vi.mocked(prisma.notification.findMany).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(requestFor("http://localhost/api/notifications"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
