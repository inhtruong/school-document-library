import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    teacherFollow: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, GET, POST } from "@/app/api/teachers/[teacherId]/follow/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ teacherId: "teacher_1" }) };
const TEACHER = { id: "teacher_1", role: "TEACHER" as const };

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestFor(method: "GET" | "POST" | "DELETE") {
  return new NextRequest("http://localhost/api/teachers/teacher_1/follow", { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(TEACHER as never);
  vi.mocked(prisma.teacherFollow.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.teacherFollow.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.teacherFollow.deleteMany).mockResolvedValue({ count: 1 } as never);
});

describe("GET /api/teachers/:teacherId/follow", () => {
  test("a guest (no session) gets 401", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(requestFor("GET"), context);

    expect(response.status).toBe(401);
  });

  test("returns following=false when not following", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.teacherFollow.findUnique).mockResolvedValue(null);

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(body.data).toEqual({ following: false });
  });

  test("returns following=true when following", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.teacherFollow.findUnique).mockResolvedValue({ id: "follow_1" } as never);

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(body.data).toEqual({ following: true });
  });

  test("one user's follow state does not affect another user's", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_2"));

    await GET(requestFor("GET"), context);

    expect(prisma.teacherFollow.findUnique).toHaveBeenCalledWith({
      where: { followerId_teacherId: { followerId: "user_2", teacherId: "teacher_1" } },
      select: { id: true },
    });
  });
});

describe("POST /api/teachers/:teacherId/follow — authentication", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(401);
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });

  test("STUDENT can follow a Teacher", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(200);
  });

  test("TEACHER can follow another Teacher", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_2"));

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(200);
  });

  test("ADMIN can follow a Teacher", async () => {
    mockAuth.mockResolvedValue(sessionFor("ADMIN"));

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(200);
  });
});

describe("POST /api/teachers/:teacherId/follow — target validation", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));
  });

  test("a STUDENT target is rejected with 404", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "teacher_1", role: "STUDENT" } as never);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(404);
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });

  test("an ADMIN target is rejected with 404", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "teacher_1", role: "ADMIN" } as never);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(404);
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });

  test("a missing user is rejected with 404", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const response = await POST(requestFor("POST"), context);

    expect(response.status).toBe(404);
  });
});

describe("POST /api/teachers/:teacherId/follow — self-follow", () => {
  test("a teacher cannot follow themselves — rejected with a friendly 400", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));

    const response = await POST(requestFor("POST"), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/yourself/i);
    expect(prisma.teacherFollow.upsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/teachers/:teacherId/follow — idempotency and ownership", () => {
  test("the first POST creates the follow via an idempotent upsert scoped to the session's userId", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    await POST(requestFor("POST"), context);

    expect(prisma.teacherFollow.upsert).toHaveBeenCalledWith({
      where: { followerId_teacherId: { followerId: "user_1", teacherId: "teacher_1" } },
      create: { followerId: "user_1", teacherId: "teacher_1" },
      update: {},
    });
  });

  test("a duplicate POST is idempotent — same upsert call, no error", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    const first = await POST(requestFor("POST"), context);
    const second = await POST(requestFor("POST"), context);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(prisma.teacherFollow.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("DELETE /api/teachers/:teacherId/follow", () => {
  test("a guest (no session) gets 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(requestFor("DELETE"), context);

    expect(response.status).toBe(401);
    expect(prisma.teacherFollow.deleteMany).not.toHaveBeenCalled();
  });

  test("removes scoped to the session's own userId", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "user_1"));

    const response = await DELETE(requestFor("DELETE"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ following: false });
    expect(prisma.teacherFollow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: "user_1", teacherId: "teacher_1" },
    });
  });

  test("removing a missing follow is handled safely, not as an error", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.teacherFollow.deleteMany).mockResolvedValue({ count: 0 } as never);

    const response = await DELETE(requestFor("DELETE"), context);

    expect(response.status).toBe(200);
  });
});

describe("teacher follow route — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.teacherFollow.findUnique).mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));

    const response = await GET(requestFor("GET"), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
