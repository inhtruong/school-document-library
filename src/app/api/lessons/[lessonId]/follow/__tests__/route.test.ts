import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lesson: { findUnique: vi.fn() },
    lessonFollow: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, GET, POST } from "@/app/api/lessons/[lessonId]/follow/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ lessonId: "lesson_1" }) };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestFor(method: "GET" | "POST" | "DELETE") {
  return new NextRequest("http://localhost/api/lessons/lesson_1/follow", { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.lesson.findUnique).mockResolvedValue({ id: "lesson_1" } as never);
  vi.mocked(prisma.lessonFollow.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.lessonFollow.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.lessonFollow.deleteMany).mockResolvedValue({ count: 1 } as never);
});

describe("GET /api/lessons/:lessonId/follow", () => {
  test("a guest (no session) gets 401", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(requestFor("GET"), context);

    expect(response.status).toBe(401);
  });

  test("returns following=false when not following", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(body.data).toEqual({ following: false });
  });

  test("returns following=true when following", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.lessonFollow.findUnique).mockResolvedValue({ id: "follow_1" } as never);

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(body.data).toEqual({ following: true });
  });

  test("one user's follow state is isolated from another user's", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_2"));

    await GET(requestFor("GET"), context);

    expect(prisma.lessonFollow.findUnique).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: "user_2", lessonId: "lesson_1" } },
      select: { id: true },
    });
  });
});

describe("POST /api/lessons/:lessonId/follow — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(401);
    expect(prisma.lessonFollow.upsert).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s can follow a Lesson", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(200);
  });
});

describe("POST /api/lessons/:lessonId/follow — validation", () => {
  test("a valid Lesson is accepted", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(200);
  });

  test("a missing Lesson is rejected with 404", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(null);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(404);
    expect(prisma.lessonFollow.upsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/lessons/:lessonId/follow — idempotency and ownership", () => {
  test("upserts scoped to the session's own userId, never the body", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await POST(requestFor("POST"), context);

    expect(prisma.lessonFollow.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: "user_1", lessonId: "lesson_1" } },
      create: { userId: "user_1", lessonId: "lesson_1" },
      update: {},
    });
  });

  test("a duplicate POST is idempotent — no error, same call", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    const first = await POST(requestFor("POST"), context);
    const second = await POST(requestFor("POST"), context);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(prisma.lessonFollow.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("DELETE /api/lessons/:lessonId/follow", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(requestFor("DELETE"), context);

    expect(response.status).toBe(401);
    expect(prisma.lessonFollow.deleteMany).not.toHaveBeenCalled();
  });

  test("removes scoped to the session's own userId", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    const response = await DELETE(requestFor("DELETE"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ following: false });
    expect(prisma.lessonFollow.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", lessonId: "lesson_1" },
    });
  });

  test("removing a missing follow is handled safely, not as an error", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.lessonFollow.deleteMany).mockResolvedValue({ count: 0 } as never);

    const response = await DELETE(requestFor("DELETE"), context);

    expect(response.status).toBe(200);
  });
});

describe("lesson follow route — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.lessonFollow.findUnique).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
