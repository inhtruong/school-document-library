import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/documents/route";

const TEACHER_SESSION: Session = {
  user: { id: "teacher_1", role: "TEACHER", name: "Ms. Teacher", email: "teacher@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
};
const STUDENT_SESSION: Session = {
  user: { id: "student_1", role: "STUDENT", name: "A Student", email: "student@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
};

// `auth` is polymorphic (plain call vs. middleware signature); pin the overload we use.
const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

const createdAt = new Date("2025-01-01T00:00:00.000Z");
const updatedAt = new Date("2025-01-02T00:00:00.000Z");

// Prisma returns Date instances; the API serializes them to ISO strings over JSON.
const mockDocument = {
  id: "doc_1",
  title: "Database Final Exam 2025",
  description: "Covers normalization and transactions.",
  subject: "Database",
  documentType: "EXAM" as const,
  academicYear: "2024-2025",
  gradeId: null,
  subjectId: null,
  lessonId: null,
  fileKey: null,
  fileName: null,
  fileSize: null,
  mimeType: null,
  fileCategory: null,
  uploadedById: null,
  moderationStatus: "APPROVED" as const,
  reviewedAt: null,
  reviewedById: null,
  rejectionReason: null,
  createdAt,
  updatedAt,
};

const serializedMockDocument = {
  ...mockDocument,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
};

const GRADE_12 = { id: "grade_12", name: "Grade 12", code: "G12", sortOrder: 12, createdAt, updatedAt };
const MATH_12 = { id: "subject_math12", name: "Mathematics", code: "MATH", gradeId: GRADE_12.id, createdAt, updatedAt };
const MATH_11 = { id: "subject_math11", name: "Mathematics", code: "MATH", gradeId: "grade_11", createdAt, updatedAt };
const DERIVATIVES = {
  id: "lesson_derivatives",
  name: "Derivatives",
  code: "DERIVATIVES",
  subjectId: MATH_12.id,
  createdAt,
  updatedAt,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.document.findMany).mockResolvedValue([]);
  vi.mocked(prisma.document.count).mockResolvedValue(0);
  vi.mocked(prisma.grade.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.lesson.findUnique).mockResolvedValue(null);
  mockAuth.mockResolvedValue(TEACHER_SESSION);
});

function lastFindManyArgs() {
  return vi.mocked(prisma.document.findMany).mock.calls[0][0];
}

describe("GET /api/documents", () => {
  test("returns documents wrapped in a success envelope with pagination meta", async () => {
    // Arrange
    vi.mocked(prisma.document.findMany).mockResolvedValue([mockDocument]);
    vi.mocked(prisma.document.count).mockResolvedValue(1);
    const request = new NextRequest("http://localhost/api/documents");

    // Act
    const response = await GET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([serializedMockDocument]);
    expect(body.meta.total).toBe(1);
  });

  test("builds a case-insensitive OR filter across title, description, legacy subject, structured subject and lesson when searching", async () => {
    const request = new NextRequest("http://localhost/api/documents?search=database");

    await GET(request);

    expect(lastFindManyArgs()?.where?.OR).toEqual([
      { title: { contains: "database", mode: "insensitive" } },
      { description: { contains: "database", mode: "insensitive" } },
      { subject: { contains: "database", mode: "insensitive" } },
      { subjectRef: { name: { contains: "database", mode: "insensitive" } } },
      { lesson: { name: { contains: "database", mode: "insensitive" } } },
    ]);
  });

  test("returns a 500 error envelope when the database call fails", async () => {
    vi.mocked(prisma.document.findMany).mockRejectedValue(new Error("connection refused"));
    const request = new NextRequest("http://localhost/api/documents");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });

  describe("structured taxonomy filters", () => {
    test("filters by gradeId when the grade exists", async () => {
      vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE_12);
      const request = new NextRequest(`http://localhost/api/documents?gradeId=${GRADE_12.id}`);

      await GET(request);

      expect(lastFindManyArgs()?.where).toMatchObject({ gradeId: GRADE_12.id });
    });

    test("filters by subjectId when the subject exists", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_12);
      const request = new NextRequest(`http://localhost/api/documents?subjectId=${MATH_12.id}`);

      await GET(request);

      expect(lastFindManyArgs()?.where).toMatchObject({ subjectId: MATH_12.id });
    });

    test("filters by lessonId when the lesson exists and its subject is given", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_12);
      vi.mocked(prisma.lesson.findUnique).mockResolvedValue(DERIVATIVES);
      const request = new NextRequest(
        `http://localhost/api/documents?subjectId=${MATH_12.id}&lessonId=${DERIVATIVES.id}`
      );

      await GET(request);

      expect(lastFindManyArgs()?.where).toMatchObject({ subjectId: MATH_12.id, lessonId: DERIVATIVES.id });
    });

    test("filters by documentType", async () => {
      const request = new NextRequest("http://localhost/api/documents?documentType=EXERCISE");

      await GET(request);

      expect(lastFindManyArgs()?.where).toMatchObject({ documentType: "EXERCISE" });
    });

    test("ignores an invalid documentType instead of filtering by it", async () => {
      const request = new NextRequest("http://localhost/api/documents?documentType=NOT_REAL");

      await GET(request);

      expect(lastFindManyArgs()?.where).not.toHaveProperty("documentType");
    });

    test("combines Grade + Subject + Lesson + DocumentType + keyword with AND logic", async () => {
      vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE_12);
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_12);
      vi.mocked(prisma.lesson.findUnique).mockResolvedValue(DERIVATIVES);
      const request = new NextRequest(
        `http://localhost/api/documents?q=derivative&gradeId=${GRADE_12.id}&subjectId=${MATH_12.id}&lessonId=${DERIVATIVES.id}&documentType=EXERCISE`
      );

      await GET(request);

      const where = lastFindManyArgs()?.where;
      expect(where).toMatchObject({
        gradeId: GRADE_12.id,
        subjectId: MATH_12.id,
        lessonId: DERIVATIVES.id,
        documentType: "EXERCISE",
      });
      expect(where?.OR).toBeDefined();
    });

    test("drops a Subject that belongs to a different Grade instead of erroring", async () => {
      vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE_12);
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_11);
      const request = new NextRequest(
        `http://localhost/api/documents?gradeId=${GRADE_12.id}&subjectId=${MATH_11.id}`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const where = lastFindManyArgs()?.where;
      expect(where).toMatchObject({ gradeId: GRADE_12.id });
      expect(where).not.toHaveProperty("subjectId");
    });

    test("drops a Lesson that belongs to a different Subject instead of erroring", async () => {
      const wrongSubjectLesson = { ...DERIVATIVES, subjectId: MATH_11.id };
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(MATH_12);
      vi.mocked(prisma.lesson.findUnique).mockResolvedValue(wrongSubjectLesson);
      const request = new NextRequest(
        `http://localhost/api/documents?subjectId=${MATH_12.id}&lessonId=${wrongSubjectLesson.id}`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const where = lastFindManyArgs()?.where;
      expect(where).toMatchObject({ subjectId: MATH_12.id });
      expect(where).not.toHaveProperty("lessonId");
    });

    test("leaves gradeId/subjectId/lessonId out of the where clause when no taxonomy filter is given, so legacy documents still match", async () => {
      const request = new NextRequest("http://localhost/api/documents");

      await GET(request);

      const where = lastFindManyArgs()?.where;
      expect(where).not.toHaveProperty("gradeId");
      expect(where).not.toHaveProperty("subjectId");
      expect(where).not.toHaveProperty("lessonId");
    });
  });

  describe("sorting", () => {
    test.each([
      ["newest", { createdAt: "desc" }],
      ["oldest", { createdAt: "asc" }],
      ["title_asc", { title: "asc" }],
      ["title_desc", { title: "desc" }],
    ] as const)("sort=%s maps to the expected Prisma orderBy", async (sort, expectedOrderBy) => {
      const request = new NextRequest(`http://localhost/api/documents?sort=${sort}`);

      await GET(request);

      expect(lastFindManyArgs()?.orderBy).toEqual(expectedOrderBy);
    });

    test("defaults to newest for an invalid sort value", async () => {
      const request = new NextRequest("http://localhost/api/documents?sort=most_popular");

      await GET(request);

      expect(lastFindManyArgs()?.orderBy).toEqual({ createdAt: "desc" });
    });
  });

  describe("pagination", () => {
    test("computes skip/take from the page number using the centralized page size", async () => {
      const request = new NextRequest("http://localhost/api/documents?page=3");

      await GET(request);

      expect(lastFindManyArgs()?.take).toBe(12);
      expect(lastFindManyArgs()?.skip).toBe(24);
    });

    test("normalizes an invalid page to 1 (skip=0)", async () => {
      const request = new NextRequest("http://localhost/api/documents?page=-5");

      await GET(request);

      expect(lastFindManyArgs()?.skip).toBe(0);
    });

    test("returns page/pageSize/total/totalPages in meta", async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(25);
      const request = new NextRequest("http://localhost/api/documents?page=2");

      const response = await GET(request);
      const body = await response.json();

      expect(body.meta).toEqual({ total: 25, take: 12, skip: 12, page: 2, pageSize: 12, totalPages: 3 });
    });

    test("still returns at least 1 total page when there are zero results", async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(0);
      const request = new NextRequest("http://localhost/api/documents");

      const response = await GET(request);
      const body = await response.json();

      expect(body.meta.totalPages).toBe(1);
    });
  });

  describe("legacy compatibility", () => {
    test("?take= keeps the original offset-pagination contract (used by the homepage)", async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(4);
      const request = new NextRequest("http://localhost/api/documents?take=4");

      const response = await GET(request);
      const body = await response.json();

      expect(lastFindManyArgs()?.take).toBe(4);
      expect(lastFindManyArgs()?.skip).toBe(0);
      expect(body.meta).toEqual({ total: 4, take: 4, skip: 0 });
    });

    test("?subject= (legacy free-text) still filters, combined with new filters via AND", async () => {
      vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE_12);
      const request = new NextRequest(
        `http://localhost/api/documents?subject=Database&gradeId=${GRADE_12.id}`
      );

      await GET(request);

      expect(lastFindManyArgs()?.where).toMatchObject({
        subject: { equals: "Database", mode: "insensitive" },
        gradeId: GRADE_12.id,
      });
    });
  });
});

describe("POST /api/documents", () => {
  test("creates a document and returns 201 with the created record", async () => {
    vi.mocked(prisma.document.create).mockResolvedValue(mockDocument);
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Database Final Exam 2025",
        subject: "Database",
        documentType: "EXAM",
        academicYear: "2024-2025",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(serializedMockDocument);
  });

  test("rejects an invalid payload with 400 and never touches the database", async () => {
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON with 400", async () => {
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: "{not valid json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  test("rejects an unauthenticated caller with 401 and never touches the database", async () => {
    mockAuth.mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Database Final Exam 2025",
        subject: "Database",
        documentType: "EXAM",
        academicYear: "2024-2025",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  test("rejects a STUDENT caller with 403 and never touches the database", async () => {
    mockAuth.mockResolvedValue(STUDENT_SESSION);
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Database Final Exam 2025",
        subject: "Database",
        documentType: "EXAM",
        academicYear: "2024-2025",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  test("a TEACHER caller creates the document as PENDING", async () => {
    mockAuth.mockResolvedValue(TEACHER_SESSION);
    vi.mocked(prisma.document.create).mockResolvedValue(mockDocument);
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Database Final Exam 2025",
        subject: "Database",
        documentType: "EXAM",
        academicYear: "2024-2025",
      }),
    });

    await POST(request);

    const createCall = vi.mocked(prisma.document.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.moderationStatus).toBe("PENDING");
  });

  test("an ADMIN caller creates the document as APPROVED", async () => {
    const ADMIN_SESSION: Session = {
      user: { id: "admin_1", role: "ADMIN", name: "Admin", email: "admin@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    };
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    vi.mocked(prisma.document.create).mockResolvedValue(mockDocument);
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Database Final Exam 2025",
        subject: "Database",
        documentType: "EXAM",
        academicYear: "2024-2025",
      }),
    });

    await POST(request);

    const createCall = vi.mocked(prisma.document.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.moderationStatus).toBe("APPROVED");
  });

  test("a client-supplied moderationStatus in the body is ignored (stripped by zod, never reaches Prisma)", async () => {
    mockAuth.mockResolvedValue(TEACHER_SESSION);
    vi.mocked(prisma.document.create).mockResolvedValue(mockDocument);
    const request = new NextRequest("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Database Final Exam 2025",
        subject: "Database",
        documentType: "EXAM",
        academicYear: "2024-2025",
        moderationStatus: "APPROVED",
      }),
    });

    await POST(request);

    const createCall = vi.mocked(prisma.document.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.moderationStatus).toBe("PENDING");
  });
});
