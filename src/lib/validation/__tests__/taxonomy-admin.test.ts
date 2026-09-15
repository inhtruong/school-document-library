import { describe, expect, test } from "vitest";
import {
  createGradeSchema,
  createLessonSchema,
  createSubjectSchema,
  updateGradeSchema,
  updateLessonSchema,
  updateSubjectSchema,
} from "@/lib/validation/taxonomy-admin";

describe("createGradeSchema", () => {
  test("accepts a valid Grade and normalizes the code to uppercase", () => {
    const result = createGradeSchema.safeParse({ name: "Grade 10", code: "g10", sortOrder: 10 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ name: "Grade 10", code: "G10", sortOrder: 10 });
  });

  test("sortOrder is optional", () => {
    const result = createGradeSchema.safeParse({ name: "Grade 10", code: "G10" });
    expect(result.success).toBe(true);
  });

  test("rejects an empty name", () => {
    const result = createGradeSchema.safeParse({ name: "  ", code: "G10" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_GRADE_NAME_REQUIRED");
  });

  test("rejects a name over 100 characters", () => {
    const result = createGradeSchema.safeParse({ name: "a".repeat(101), code: "G10" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_GRADE_NAME_TOO_LONG");
  });

  test("rejects an empty code", () => {
    const result = createGradeSchema.safeParse({ name: "Grade 10", code: "  " });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_GRADE_CODE_REQUIRED");
  });

  test("rejects a code containing characters outside [A-Z0-9_]", () => {
    const result = createGradeSchema.safeParse({ name: "Grade 10", code: "G-10!" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_GRADE_CODE_INVALID_FORMAT");
  });
});

describe("updateGradeSchema", () => {
  test("allows a partial update with only sortOrder", () => {
    const result = updateGradeSchema.safeParse({ sortOrder: 5 });
    expect(result.success).toBe(true);
  });
});

describe("createSubjectSchema", () => {
  test("accepts a valid Subject", () => {
    const result = createSubjectSchema.safeParse({ name: "Mathematics", code: "math", gradeId: "grade_1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ name: "Mathematics", code: "MATH", gradeId: "grade_1" });
  });

  test("rejects a missing gradeId", () => {
    const result = createSubjectSchema.safeParse({ name: "Mathematics", code: "MATH", gradeId: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_SUBJECT_GRADE_ID_REQUIRED");
  });
});

describe("updateSubjectSchema", () => {
  test("allows a partial update with only name", () => {
    const result = updateSubjectSchema.safeParse({ name: "Advanced Mathematics" });
    expect(result.success).toBe(true);
  });
});

describe("createLessonSchema", () => {
  test("accepts a valid Lesson", () => {
    const result = createLessonSchema.safeParse({ name: "Motion", code: "motion", subjectId: "subject_1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ name: "Motion", code: "MOTION", subjectId: "subject_1" });
  });

  test("rejects a missing subjectId", () => {
    const result = createLessonSchema.safeParse({ name: "Motion", code: "MOTION", subjectId: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_LESSON_SUBJECT_ID_REQUIRED");
  });
});

describe("updateLessonSchema", () => {
  test("allows a partial update with only code", () => {
    const result = updateLessonSchema.safeParse({ code: "kinematics" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ code: "KINEMATICS" });
  });
});
