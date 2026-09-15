import { describe, expect, test } from "vitest";
import { createDocumentSchema, updateDocumentSchema } from "@/lib/validation/document";

describe("createDocumentSchema", () => {
  test("accepts a valid document payload", () => {
    // Arrange
    const payload = {
      title: "Database Final Exam 2025",
      description: "Covers normalization and transactions.",
      subject: "Database",
      documentType: "EXAM",
      academicYear: "2024-2025",
    };

    // Act
    const result = createDocumentSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(true);
  });

  test("rejects an empty title", () => {
    const result = createDocumentSchema.safeParse({
      title: "",
      subject: "Database",
      documentType: "EXAM",
      academicYear: "2024-2025",
    });

    expect(result.success).toBe(false);
  });

  test("rejects a documentType value outside the controlled enum", () => {
    const result = createDocumentSchema.safeParse({
      title: "Database Final Exam 2025",
      subject: "Database",
      documentType: "Exam", // legacy free-text value, no longer accepted
      academicYear: "2024-2025",
    });

    expect(result.success).toBe(false);
  });

  test("rejects a payload missing the subject field", () => {
    const result = createDocumentSchema.safeParse({
      title: "Database Final Exam 2025",
      documentType: "EXAM",
      academicYear: "2024-2025",
    });

    expect(result.success).toBe(false);
  });

  test("allows description to be omitted", () => {
    const result = createDocumentSchema.safeParse({
      title: "Database Final Exam 2025",
      subject: "Database",
      documentType: "EXAM",
      academicYear: "2024-2025",
    });

    expect(result.success).toBe(true);
  });

  test("trims surrounding whitespace from string fields", () => {
    const result = createDocumentSchema.safeParse({
      title: "  Database Final Exam 2025  ",
      subject: " Database ",
      documentType: "EXAM",
      academicYear: " 2024-2025 ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Database Final Exam 2025");
      expect(result.data.subject).toBe("Database");
    }
  });
});

describe("updateDocumentSchema", () => {
  test("accepts a partial payload containing a single field", () => {
    const result = updateDocumentSchema.safeParse({ title: "Updated title" });
    expect(result.success).toBe(true);
  });

  test("accepts an empty payload", () => {
    const result = updateDocumentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("still rejects an invalid value for a provided field", () => {
    const result = updateDocumentSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  test("accepts a full Grade/Subject/Lesson triplet", () => {
    const result = updateDocumentSchema.safeParse({
      gradeId: "grade_1",
      subjectId: "subject_1",
      lessonId: "lesson_1",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a partial triplet — subjectId without gradeId", () => {
    const result = updateDocumentSchema.safeParse({ subjectId: "subject_1", lessonId: "lesson_1" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_GRADE_REQUIRED");
  });

  test("rejects a partial triplet — lessonId without subjectId", () => {
    const result = updateDocumentSchema.safeParse({ gradeId: "grade_1", lessonId: "lesson_1" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_SUBJECT_REQUIRED");
  });

  test("rejects a partial triplet — gradeId only (missing subjectId reported first)", () => {
    const result = updateDocumentSchema.safeParse({ gradeId: "grade_1" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_SUBJECT_REQUIRED");
  });

  test("allows omitting taxonomy entirely alongside other fields", () => {
    const result = updateDocumentSchema.safeParse({ title: "Updated title" });
    expect(result.success).toBe(true);
  });
});
