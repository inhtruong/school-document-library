import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { document: { create: vi.fn() } },
}));

// Keep the real (pure) format/key logic — only mock the actual filesystem I/O.
vi.mock("@/lib/storage/local-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage/local-storage")>();
  return {
    ...actual,
    writeLocalFile: vi.fn(),
    deleteLocalFile: vi.fn(),
  };
});

import { prisma } from "@/lib/prisma";
import { deleteLocalFile, writeLocalFile } from "@/lib/storage/local-storage";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/documents/upload-config";
import { uploadDocument } from "@/lib/documents/upload";

function makeFile(name: string, type: string, body: string | number[]) {
  const content = typeof body === "string" ? body : new Uint8Array(body);
  return new File([content], name, { type });
}

const SAMPLES = {
  pdf: () => makeFile("report.pdf", "application/pdf", "%PDF-1.4\nfake pdf content"),
  doc: () => makeFile("notes.doc", "application/msword", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]),
  docx: () =>
    makeFile(
      "notes.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      [0x50, 0x4b, 0x03, 0x04, 0, 0]
    ),
  xls: () => makeFile("sheet.xls", "application/vnd.ms-excel", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]),
  xlsx: () =>
    makeFile(
      "sheet.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      [0x50, 0x4b, 0x03, 0x04, 0, 0]
    ),
  jpg: () => makeFile("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0, 0, 0]),
  png: () => makeFile("photo.png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
  webp: () => makeFile("photo.webp", "image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
  mp4: () => makeFile("clip.mp4", "video/mp4", [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0, 0]),
  webm: () => makeFile("clip.webm", "video/webm", [0x1a, 0x45, 0xdf, 0xa3, 0, 0]),
};

function buildFormData(
  overrides: Partial<{
    title: string;
    subject: string;
    documentType: string;
    academicYear: string;
    description: string;
    file: File | null;
    extra: Record<string, string>;
  }> = {}
) {
  const formData = new FormData();
  formData.set("title", overrides.title ?? "Midterm Exam");
  formData.set("subject", overrides.subject ?? "Database");
  formData.set("documentType", overrides.documentType ?? "Exam");
  formData.set("academicYear", overrides.academicYear ?? "2024-2025");
  if (overrides.description !== undefined) formData.set("description", overrides.description);

  if (overrides.file !== null) {
    formData.set("file", overrides.file ?? SAMPLES.pdf());
  }

  for (const [key, value] of Object.entries(overrides.extra ?? {})) {
    formData.set(key, value);
  }

  return formData;
}

const mockCreatedDocument = {
  id: "doc_1",
  title: "Midterm Exam",
  description: null,
  subject: "Database",
  documentType: "Exam",
  academicYear: "2024-2025",
  fileKey: "pdf/generated.pdf",
  fileName: "report.pdf",
  fileSize: 24,
  mimeType: "application/pdf",
  fileCategory: "PDF",
  uploadedById: "user_1",
  uploadedBy: { id: "user_1", name: "Tara Teacher" },
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(writeLocalFile).mockResolvedValue({ success: true });
  vi.mocked(prisma.document.create).mockResolvedValue(mockCreatedDocument as never);
});

describe("uploadDocument — accepted formats", () => {
  test.each([
    ["pdf", "PDF"],
    ["doc", "WORD"],
    ["docx", "WORD"],
    ["xls", "EXCEL"],
    ["xlsx", "EXCEL"],
    ["jpg", "IMAGE"],
    ["png", "IMAGE"],
    ["webp", "IMAGE"],
    ["mp4", "VIDEO"],
    ["webm", "VIDEO"],
  ] as const)("accepts a valid %s and stores it under the %s category", async (sample, category) => {
    const file = SAMPLES[sample]();
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData({ file }) });

    expect(result.success).toBe(true);
    expect(writeLocalFile).toHaveBeenCalledTimes(1);

    const [key] = vi.mocked(writeLocalFile).mock.calls[0];
    const folder = { PDF: "pdf", WORD: "word", EXCEL: "excel", IMAGE: "images", VIDEO: "videos" }[category];
    expect(key.startsWith(`${folder}/`)).toBe(true);

    const createCall = vi.mocked(prisma.document.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.fileCategory).toBe(category);
    expect(createCall.data.fileName).toBe(file.name);
    expect(createCall.data.mimeType).toBe(file.type);
    expect(createCall.data.uploadedById).toBe("user_1");
  });
});

describe("uploadDocument — rejections", () => {
  test("rejects when no file is provided", async () => {
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData({ file: null }) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects an unsupported file type", async () => {
    const file = makeFile("archive.zip", "application/zip", "PKfake zip");
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData({ file }) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects an extension/MIME mismatch", async () => {
    const file = makeFile("photo.png", "application/pdf", "%PDF-1.4 disguised as a png");
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData({ file }) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects a file whose bytes don't match its declared type's signature", async () => {
    const file = makeFile("report.pdf", "application/pdf", "this is not really a pdf");
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData({ file }) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects a file larger than the configured max upload size", async () => {
    const oversized = makeFile("report.pdf", "application/pdf", [
      ...Buffer.from("%PDF-"),
      ...new Array(MAX_UPLOAD_SIZE_BYTES).fill(0),
    ]);
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData({ file: oversized }) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects invalid metadata (missing title) without touching storage", async () => {
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData({ title: "" }) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
  });
});

describe("uploadDocument — ownership and failure handling", () => {
  test("always uses the authenticated uploaderId, ignoring any uploader field the client sends", async () => {
    const formData = buildFormData({ extra: { uploadedById: "someone-else" } });

    await uploadDocument({ uploaderId: "user_1", formData });

    const createCall = vi.mocked(prisma.document.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.uploadedById).toBe("user_1");
  });

  test("does not create a Document when the local file write fails", async () => {
    vi.mocked(writeLocalFile).mockResolvedValue({ success: false, error: "disk full" });

    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData() });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(500);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  test("attempts to delete the local file when Document creation fails after a successful write", async () => {
    vi.mocked(prisma.document.create).mockRejectedValue(new Error("db unavailable"));

    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData() });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(500);

    const [writtenKey] = vi.mocked(writeLocalFile).mock.calls[0];
    expect(deleteLocalFile).toHaveBeenCalledWith(writtenKey);
  });
});
