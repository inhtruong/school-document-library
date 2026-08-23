import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { validateTaxonomySelection } from "@/lib/documents/taxonomy";

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

describe("validateTaxonomySelection", () => {
  test("accepts a correctly-nested Grade/Subject/Lesson combination", async () => {
    mockRecords(GRADE_12, MATH_12, DERIVATIVES);

    const result = await validateTaxonomySelection({
      gradeId: GRADE_12.id,
      subjectId: MATH_12.id,
      lessonId: DERIVATIVES.id,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.grade).toEqual(GRADE_12);
    expect(result.subject).toEqual(MATH_12);
    expect(result.lesson).toEqual(DERIVATIVES);
  });

  test("rejects — Grade 12 selected but the Subject actually belongs to Grade 11 (Mathematics is duplicated per grade)", async () => {
    // Mirrors the task's own example: Grade 12 + "Grade 11 Mathematics" + "Grade 10 Algebra".
    mockRecords(GRADE_12, MATH_11, ALGEBRA_11);

    const result = await validateTaxonomySelection({
      gradeId: GRADE_12.id,
      subjectId: MATH_11.id,
      lessonId: ALGEBRA_11.id,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/subject.*grade/i);
  });

  test("rejects a Lesson that belongs to a different Subject than the one selected", async () => {
    // ALGEBRA_11 belongs to MATH_11, not MATH_12.
    mockRecords(GRADE_12, MATH_12, ALGEBRA_11);

    const result = await validateTaxonomySelection({
      gradeId: GRADE_12.id,
      subjectId: MATH_12.id,
      lessonId: ALGEBRA_11.id,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/lesson.*subject/i);
  });

  test("rejects a nonexistent grade", async () => {
    mockRecords(null, MATH_12, DERIVATIVES);

    const result = await validateTaxonomySelection({
      gradeId: "does-not-exist",
      subjectId: MATH_12.id,
      lessonId: DERIVATIVES.id,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/grade/i);
  });

  test("rejects a nonexistent subject", async () => {
    mockRecords(GRADE_12, null, DERIVATIVES);

    const result = await validateTaxonomySelection({
      gradeId: GRADE_12.id,
      subjectId: "does-not-exist",
      lessonId: DERIVATIVES.id,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/subject/i);
  });

  test("rejects a nonexistent lesson", async () => {
    mockRecords(GRADE_12, MATH_12, null);

    const result = await validateTaxonomySelection({
      gradeId: GRADE_12.id,
      subjectId: MATH_12.id,
      lessonId: "does-not-exist",
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/lesson/i);
  });
});
