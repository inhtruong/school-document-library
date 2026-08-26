import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { POST } from "@/app/api/auth/register/route";

const mockUser = {
  id: "user_1",
  name: "New Student",
  email: "newstudent@example.com",
  role: "STUDENT",
};

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
});

describe("POST /api/auth/register", () => {
  test("registers a student and returns 201 without a passwordHash", async () => {
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as never);

    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "New Student",
        email: "newstudent@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("STUDENT");
    expect(body.data.passwordHash).toBeUndefined();
  });

  test("ignores a client-supplied role field and still creates a STUDENT", async () => {
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as never);

    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Sneaky",
        email: "sneaky@example.com",
        password: "password123",
        role: "ADMIN",
      }),
    });

    await POST(request);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "STUDENT" }) })
    );
  });

  test("rejects a duplicate email with 409", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "existing",
      name: "Existing",
      email: "existing@example.com",
      passwordHash: "hash",
      role: "STUDENT",
      sessionVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Dup", email: "existing@example.com", password: "password123" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
  });

  test("rejects invalid input with 400 and never touches the database", async () => {
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "", email: "not-an-email", password: "short" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON with 400", async () => {
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: "{not valid json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
