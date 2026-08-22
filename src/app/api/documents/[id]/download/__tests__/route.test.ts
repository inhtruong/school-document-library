import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { document: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/storage/local-storage", () => ({
  statLocalFile: vi.fn(),
  createLocalFileReadStream: vi.fn(),
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createLocalFileReadStream, statLocalFile } from "@/lib/storage/local-storage";
import { GET } from "@/app/api/documents/[id]/download/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };
const FAKE_CONTENT = Buffer.from("fake file bytes for download testing only");

function requestWith() {
  return new NextRequest("http://localhost/api/documents/doc_1/download");
}

function fakeStream() {
  return Readable.from(FAKE_CONTENT);
}

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN"): Session {
  return {
    user: { id: "user_1", name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

const mockDocument = {
  fileKey: "pdf/a.pdf",
  fileName: "Database Final Exam 2026.pdf",
  mimeType: "application/pdf",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/documents/:id/download — authentication", () => {
  test("a guest (no session) gets 401 and the document is never looked up", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(requestWith(), context);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(prisma.document.findUnique).not.toHaveBeenCalled();
  });

  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("%s is allowed to download", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/pdf/a.pdf",
      size: FAKE_CONTENT.length,
    });
    vi.mocked(createLocalFileReadStream).mockReturnValue(fakeStream() as never);

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(200);
  });
});

describe("GET /api/documents/:id/download — file response", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
  });

  test("returns the correct mimeType, attachment disposition, and original filename (not fileKey)", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/pdf/a.pdf",
      size: FAKE_CONTENT.length,
    });
    vi.mocked(createLocalFileReadStream).mockReturnValue(fakeStream() as never);

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe(String(FAKE_CONTENT.length));
    const disposition = response.headers.get("content-disposition")!;
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toContain('filename="Database Final Exam 2026.pdf"');
    expect(disposition).not.toContain("pdf/a.pdf"); // the fileKey must never leak as the filename
    expect(disposition).not.toContain("/fake/pdf/a.pdf");
  });

  test("streams the correct bytes", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/pdf/a.pdf",
      size: FAKE_CONTENT.length,
    });
    vi.mocked(createLocalFileReadStream).mockReturnValue(fakeStream() as never);

    const response = await GET(requestWith(), context);
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(bytes.equals(FAKE_CONTENT)).toBe(true);
  });
});

describe("GET /api/documents/:id/download — missing cases", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
  });

  test("document not found returns 404", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(404);
    expect(statLocalFile).not.toHaveBeenCalled();
  });

  test("document without a file returns 404, not a broken download", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      fileKey: null,
      fileName: null,
      mimeType: null,
    } as never);

    const response = await GET(requestWith(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(statLocalFile).not.toHaveBeenCalled();
  });

  test("a fileKey pointing at a missing physical file returns 404 instead of crashing", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);
    vi.mocked(statLocalFile).mockResolvedValue({ exists: false });

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(404);
    expect(createLocalFileReadStream).not.toHaveBeenCalled();
  });
});

describe("GET /api/documents/:id/download — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT"));
    vi.mocked(prisma.document.findUnique).mockRejectedValue(
      new Error("connection refused at 10.0.0.5:5432")
    );

    const response = await GET(requestWith(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
