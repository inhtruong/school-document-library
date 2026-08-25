import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveSearchTaxonomyFilters } from "@/lib/documents/search-filters";

const now = new Date("2025-01-01T00:00:00.000Z");
const GRADE_12 = { id: "grade_12", name: "Grade 12", code: "G12", sortOrder: 12, createdAt: now, updatedAt: now };
const GRADE_11 = { id: "grade_11", name: "Grade 11", code: "G11", sortOrder: 11, createdAt: now, updatedAt: now };
const MATH_12 = {
  id: "subject_math12",
  name: "Mathematics",
  code: "MATH",
  gradeId: GRADE_12.id,
  createdAt: now,
  updatedAt: now,
};
const MATH_11 = {
  id: "subject_math11",
  name: "Mathematics",
  code: "MATH",
  gradeId: GRADE_11.id,
  createdAt: now,
  updatedAt: now,
};
const DERIVATIVES = {
  id: "lesson_derivatives",
  name: "Derivatives",
  code: "DERIVATIVES",
  subjectId: MATH_12.id,
  createdAt: now,
  updatedAt: now,
};
const ALGEBRA_11 = {
  id: "lesson_algebra11",
  name: "Algebra",
  code: "ALGEBRA",
  subjectId: MATH_11.id,
  createdAt: now,
  updatedAt: now,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function mockRecords(grade: unknown, subject: unknown, lesson: unknown) {
  vi.mocked(prisma.grade.findUnique).mockResolvedValue(grade as never);
  vi.mocked(prisma.subject.findUnique).mockResolvedValue(subject as never);
  vi.mocked(prisma.lesson.findUnique).mockResolvedValue(lesson as never);
}

describe("resolveSearchTaxonomyFilters", () => {
  test("returns nothing when no IDs are given, without touching the DB", async () => {
    const result = await resolveSearchTaxonomyFilters({});

    expect(result).toEqual({});
    expect(prisma.grade.findUnique).not.toHaveBeenCalled();
    expect(prisma.subject.findUnique).not.toHaveBeenCalled();
    expect(prisma.lesson.findUnique).not.toHaveBeenCalled();
  });

  test("resolves a correctly-nested Grade/Subject/Lesson combination", async () => {
    mockRecords(GRADE_12, MATH_12, DERIVATIVES);

    const result = await resolveSearchTaxonomyFilters({
      gradeId: GRADE_12.id,
      subjectId: MATH_12.id,
      lessonId: DERIVATIVES.id,
    });

    expect(result).toEqual({
      gradeId: GRADE_12.id,
      gradeName: GRADE_12.name,
      subjectId: MATH_12.id,
      subjectName: MATH_12.name,
      lessonId: DERIVATIVES.id,
      lessonName: DERIVATIVES.name,
    });
  });

  test("drops a Subject that belongs to a different Grade instead of erroring", async () => {
    mockRecords(GRADE_12, MATH_11, null);

    const result = await resolveSearchTaxonomyFilters({ gradeId: GRADE_12.id, subjectId: MATH_11.id });

    expect(result).toEqual({ gradeId: GRADE_12.id, gradeName: GRADE_12.name });
  });

  test("drops a Lesson that belongs to a different Subject instead of erroring", async () => {
    mockRecords(GRADE_12, MATH_12, ALGEBRA_11);

    const result = await resolveSearchTaxonomyFilters({
      gradeId: GRADE_12.id,
      subjectId: MATH_12.id,
      lessonId: ALGEBRA_11.id,
    });

    expect(result).toEqual({
      gradeId: GRADE_12.id,
      gradeName: GRADE_12.name,
      subjectId: MATH_12.id,
      subjectName: MATH_12.name,
    });
  });

  test("drops a nonexistent gradeId", async () => {
    mockRecords(null, MATH_12, DERIVATIVES);

    const result = await resolveSearchTaxonomyFilters({ gradeId: "does-not-exist" });

    expect(result).toEqual({});
  });

  test("drops a nonexistent subjectId", async () => {
    mockRecords(null, null, null);

    const result = await resolveSearchTaxonomyFilters({ subjectId: "does-not-exist" });

    expect(result).toEqual({});
  });

  test("drops a nonexistent lessonId", async () => {
    mockRecords(null, MATH_12, null);

    const result = await resolveSearchTaxonomyFilters({ subjectId: MATH_12.id, lessonId: "does-not-exist" });

    expect(result).toEqual({ subjectId: MATH_12.id, subjectName: MATH_12.name });
  });

  test("allows subjectId alone (no gradeId given) when the subject exists", async () => {
    mockRecords(null, MATH_12, null);

    const result = await resolveSearchTaxonomyFilters({ subjectId: MATH_12.id });

    expect(result).toEqual({ subjectId: MATH_12.id, subjectName: MATH_12.name });
  });

  test("drops lessonId when no subjectId is given (a lesson filter only applies alongside its subject)", async () => {
    mockRecords(null, null, DERIVATIVES);

    const result = await resolveSearchTaxonomyFilters({ lessonId: DERIVATIVES.id });

    expect(result).toEqual({});
  });
});
