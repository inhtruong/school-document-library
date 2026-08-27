import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mocked (not omitted) purely to avoid pulling in next-auth's real
// next/server import in this test environment — route.ts still only
// *calls* auth() when a document isn't APPROVED, which every fixture
// below is, so the assertions below prove it's genuinely never invoked
// for the public/common path, same invariant as before.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { document: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/storage/local-storage", () => ({
  statLocalFile: vi.fn(),
  createLocalFileReadStream: vi.fn(),
  DOCX_MIME_TYPE: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}));

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createLocalFileReadStream, statLocalFile } from "@/lib/storage/local-storage";
import { GET } from "@/app/api/documents/[id]/preview/route";

const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
const context = { params: Promise.resolve({ id: "doc_1" }) };
const FAKE_CONTENT = Buffer.from("fake file bytes for testing purposes only");

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/documents/doc_1/preview", { headers });
}

function fakeStream() {
  return Readable.from(FAKE_CONTENT);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/documents/:id/preview — moderation visibility (FEAT-10A)", () => {
  test("a guest cannot preview a PENDING document (404, no file ever streamed)", async () => {
    mockAuth.mockResolvedValue(null);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { fileKey: "pdf/a.pdf", fileCategory: "PDF", mimeType: "application/pdf", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(404);
    expect(statLocalFile).not.toHaveBeenCalled();
  });

  test("an unrelated authenticated user cannot preview a REJECTED document (404)", async () => {
    mockAuth.mockResolvedValue(sessionFor("STUDENT", "unrelated_user"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { fileKey: "pdf/a.pdf", fileCategory: "PDF", mimeType: "application/pdf", moderationStatus: "REJECTED", uploadedById: "teacher_1" } as never
    );

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(404);
  });

  test("the uploader CAN preview their own PENDING document", async () => {
    mockAuth.mockResolvedValue(sessionFor("TEACHER", "teacher_1"));
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      { fileKey: "pdf/a.pdf", fileCategory: "PDF", mimeType: "application/pdf", moderationStatus: "PENDING", uploadedById: "teacher_1" } as never
    );
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

// @/auth is mocked only to satisfy module resolution (see top of file) —
// asserting it's never *called* below is what actually proves the
// endpoint doesn't gate an APPROVED document on a session.
describe("GET /api/documents/:id/preview — public access", () => {
  test("serves a supported file with no session/auth involved", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: "pdf/a.pdf",
      fileCategory: "PDF",
      mimeType: "application/pdf",
    } as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/pdf/a.pdf",
      size: FAKE_CONTENT.length,
    });
    vi.mocked(createLocalFileReadStream).mockReturnValue(fakeStream() as never);

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(200);
    expect(auth).not.toHaveBeenCalled();
  });
});

describe("GET /api/documents/:id/preview — response headers", () => {
  test.each([
    ["PDF", "application/pdf"],
    ["IMAGE", "image/png"],
    ["VIDEO", "video/mp4"],
  ] as const)("returns the document's mimeType and no attachment disposition for %s", async (category, mimeType) => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: `key/${category}`,
      fileCategory: category,
      mimeType,
    } as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/path",
      size: FAKE_CONTENT.length,
    });
    vi.mocked(createLocalFileReadStream).mockReturnValue(fakeStream() as never);

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(mimeType);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });
});

describe("GET /api/documents/:id/preview — range requests", () => {
  test("a valid Range request returns 206 with the correct headers", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: "videos/a.mp4",
      fileCategory: "VIDEO",
      mimeType: "video/mp4",
    } as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/videos/a.mp4",
      size: 1000,
    });
    vi.mocked(createLocalFileReadStream).mockReturnValue(fakeStream() as never);

    const response = await GET(requestWith({ range: "bytes=100-199" }), context);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 100-199/1000");
    expect(response.headers.get("content-length")).toBe("100");
    expect(createLocalFileReadStream).toHaveBeenCalledWith("/fake/videos/a.mp4", { start: 100, end: 199 });
  });

  test("an out-of-range Range request returns 416 instead of crashing", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: "videos/a.mp4",
      fileCategory: "VIDEO",
      mimeType: "video/mp4",
    } as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/videos/a.mp4",
      size: 1000,
    });

    const response = await GET(requestWith({ range: "bytes=5000-6000" }), context);

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */1000");
    expect(createLocalFileReadStream).not.toHaveBeenCalled();
  });
});

describe("GET /api/documents/:id/preview — unsupported and missing files", () => {
  test("Excel spreadsheets are rejected with 415 instead of being streamed", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: "excel/a.xlsx",
      fileCategory: "EXCEL",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as never);

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(415);
    expect(statLocalFile).not.toHaveBeenCalled();
  });

  test("modern .docx (WORD category + the docx mimeType) is streamed with the correct content type", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: "word/a.docx",
      fileCategory: "WORD",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    } as never);
    vi.mocked(statLocalFile).mockResolvedValue({
      exists: true,
      absolutePath: "/fake/word/a.docx",
      size: FAKE_CONTENT.length,
    });
    vi.mocked(createLocalFileReadStream).mockReturnValue(fakeStream() as never);

    const response = await GET(requestWith(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  test("legacy .doc (WORD category + the msword mimeType) is still rejected with 415", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: "word/a.doc",
      fileCategory: "WORD",
      mimeType: "application/msword",
    } as never);

    const response = await GET(requestWith(), context);
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.success).toBe(false);
    expect(statLocalFile).not.toHaveBeenCalled();
  });

  test("a document with no uploaded file returns 404", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: null,
      fileCategory: null,
      mimeType: null,
    } as never);

    const response = await GET(requestWith(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  test("a fileKey pointing at a missing physical file returns 404 instead of crashing", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      moderationStatus: "APPROVED",
      fileKey: "pdf/gone.pdf",
      fileCategory: "PDF",
      mimeType: "application/pdf",
    } as never);
    vi.mocked(statLocalFile).mockResolvedValue({ exists: false });

    const response = await GET(requestWith(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(createLocalFileReadStream).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/storage_local|\/Users\//);
  });

  test("returns 404 when the document itself does not exist", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const response = await GET(requestWith(), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/documents/:id/preview — server errors", () => {
  test("a database failure returns a generic 500 without leaking details", async () => {
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
