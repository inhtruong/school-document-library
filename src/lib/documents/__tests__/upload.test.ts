import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { create: vi.fn() },
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
    teacherFollow: { findMany: vi.fn() },
    lessonFollow: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
  },
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

// A consistent, valid Grade→Subject→Lesson combo, plus a second one nested
// under a *different* Grade/Subject — used to build forged cross-hierarchy
// payloads without ever needing a real database.
const now = new Date("2025-01-01T00:00:00.000Z");
const GRADE_A = { id: "grade_a", name: "Grade 12", code: "G12", sortOrder: 12, createdAt: now, updatedAt: now };
const SUBJECT_A = {
  id: "subject_a",
  name: "Mathematics",
  code: "MATH",
  gradeId: "grade_a",
  createdAt: now,
  updatedAt: now,
};
const LESSON_A = {
  id: "lesson_a",
  name: "Derivatives",
  code: "DERIVATIVES",
  subjectId: "subject_a",
  createdAt: now,
  updatedAt: now,
};

const GRADE_B = { id: "grade_b", name: "Grade 11", code: "G11", sortOrder: 11, createdAt: now, updatedAt: now };
const SUBJECT_B = {
  id: "subject_b",
  name: "Physics",
  code: "PHYSICS",
  gradeId: "grade_b", // belongs to GRADE_B, not GRADE_A
  createdAt: now,
  updatedAt: now,
};
const LESSON_B = {
  id: "lesson_b",
  name: "Electric Field",
  code: "ELECTRIC_FIELD",
  subjectId: "subject_b", // belongs to SUBJECT_B, not SUBJECT_A
  createdAt: now,
  updatedAt: now,
};

const GRADES: Record<string, typeof GRADE_A> = { [GRADE_A.id]: GRADE_A, [GRADE_B.id]: GRADE_B };
const SUBJECTS: Record<string, typeof SUBJECT_A> = { [SUBJECT_A.id]: SUBJECT_A, [SUBJECT_B.id]: SUBJECT_B };
const LESSONS: Record<string, typeof LESSON_A> = { [LESSON_A.id]: LESSON_A, [LESSON_B.id]: LESSON_B };

function buildFormData(
  overrides: Partial<{
    title: string;
    gradeId: string;
    subjectId: string;
    lessonId: string;
    documentType: string;
    academicYear: string;
    description: string;
    file: File | null;
    extra: Record<string, string>;
  }> = {}
) {
  const formData = new FormData();
  formData.set("title", overrides.title ?? "Midterm Exam");
  formData.set("gradeId", overrides.gradeId ?? GRADE_A.id);
  formData.set("subjectId", overrides.subjectId ?? SUBJECT_A.id);
  formData.set("lessonId", overrides.lessonId ?? LESSON_A.id);
  formData.set("documentType", overrides.documentType ?? "EXAM");
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
  subject: "Mathematics",
  documentType: "EXAM",
  academicYear: "2024-2025",
  gradeId: GRADE_A.id,
  subjectId: SUBJECT_A.id,
  lessonId: LESSON_A.id,
  fileKey: "pdf/generated.pdf",
  fileName: "report.pdf",
  fileSize: 24,
  mimeType: "application/pdf",
  fileCategory: "PDF",
  uploadedById: "user_1",
  uploadedBy: { id: "user_1", name: "Tara Teacher", role: "TEACHER" },
  grade: GRADE_A,
  subjectRef: SUBJECT_A,
  lesson: LESSON_A,
  createdAt: now,
  updatedAt: now,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(writeLocalFile).mockResolvedValue({ success: true });
  vi.mocked(prisma.document.create).mockResolvedValue(mockCreatedDocument as never);
  vi.mocked(prisma.grade.findUnique).mockImplementation(
    ({ where }) => Promise.resolve(GRADES[where.id as string] ?? null) as never
  );
  vi.mocked(prisma.subject.findUnique).mockImplementation(
    ({ where }) => Promise.resolve(SUBJECTS[where.id as string] ?? null) as never
  );
  vi.mocked(prisma.lesson.findUnique).mockImplementation(
    ({ where }) => Promise.resolve(LESSONS[where.id as string] ?? null) as never
  );
  vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as never);
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

describe("uploadDocument — taxonomy", () => {
  test("accepts a valid, correctly-nested Grade/Subject/Lesson combination", async () => {
    const result = await uploadDocument({ uploaderId: "user_1", formData: buildFormData() });

    expect(result.success).toBe(true);
    const createCall = vi.mocked(prisma.document.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.gradeId).toBe(GRADE_A.id);
    expect(createCall.data.subjectId).toBe(SUBJECT_A.id);
    expect(createCall.data.lessonId).toBe(LESSON_A.id);
    // Legacy subject text is auto-derived from the taxonomy Subject's name.
    expect(createCall.data.subject).toBe(SUBJECT_A.name);
  });

  test("rejects a Subject that belongs to a different Grade than the one selected", async () => {
    // SUBJECT_B actually belongs to GRADE_B, not GRADE_A — a forged/inconsistent combo.
    const formData = buildFormData({ gradeId: GRADE_A.id, subjectId: SUBJECT_B.id, lessonId: LESSON_B.id });

    const result = await uploadDocument({ uploaderId: "user_1", formData });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects a Lesson that belongs to a different Subject than the one selected", async () => {
    // LESSON_B actually belongs to SUBJECT_B, not SUBJECT_A.
    const formData = buildFormData({ gradeId: GRADE_A.id, subjectId: SUBJECT_A.id, lessonId: LESSON_B.id });

    const result = await uploadDocument({ uploaderId: "user_1", formData });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects a gradeId/subjectId/lessonId that don't exist at all", async () => {
    const formData = buildFormData({ gradeId: "does-not-exist" });

    const result = await uploadDocument({ uploaderId: "user_1", formData });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
  });

  test("rejects a documentType outside the controlled enum", async () => {
    const formData = buildFormData({ documentType: "Exam" }); // legacy free-text, not a valid enum value

    const result = await uploadDocument({ uploaderId: "user_1", formData });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.status).toBe(400);
    expect(writeLocalFile).not.toHaveBeenCalled();
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
    const file = makeFile("archive.zip", "application/zip", "PKfake zip");
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
