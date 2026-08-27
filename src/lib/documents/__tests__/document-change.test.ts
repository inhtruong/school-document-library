import { describe, expect, test } from "vitest";
import { getDocumentChangeClassification, type DocumentChangeSource } from "@/lib/documents/document-change";

const CURRENT: DocumentChangeSource = {
  title: "Derivative Exercises",
  description: "Practice problems on differentiation.",
  subject: "Mathematics",
  documentType: "EXERCISE",
  academicYear: "2025-2026",
};

describe("getDocumentChangeClassification — minor fields", () => {
  test("a title change is classified as minor (not material)", () => {
    const result = getDocumentChangeClassification(CURRENT, { title: "Updated Derivative Exercises" });
    expect(result.changedFields).toEqual(["title"]);
    expect(result.hasMaterialChange).toBe(false);
  });

  test("a description change is classified as minor (not material)", () => {
    const result = getDocumentChangeClassification(CURRENT, { description: "Updated practice problems." });
    expect(result.changedFields).toEqual(["description"]);
    expect(result.hasMaterialChange).toBe(false);
  });

  test("an academicYear change is classified as minor (not material)", () => {
    const result = getDocumentChangeClassification(CURRENT, { academicYear: "2026-2027" });
    expect(result.changedFields).toEqual(["academicYear"]);
    expect(result.hasMaterialChange).toBe(false);
  });

  test("clearing description (string -> null) is a real minor change", () => {
    const result = getDocumentChangeClassification(CURRENT, { description: null });
    expect(result.changedFields).toEqual(["description"]);
    expect(result.hasMaterialChange).toBe(false);
  });
});

describe("getDocumentChangeClassification — material fields", () => {
  test("a documentType change is classified as material", () => {
    const result = getDocumentChangeClassification(CURRENT, { documentType: "REFERENCE" });
    expect(result.changedFields).toEqual(["documentType"]);
    expect(result.hasMaterialChange).toBe(true);
  });

  test("a legacy `subject` change is classified as material (same categorization role as subjectId)", () => {
    const result = getDocumentChangeClassification(CURRENT, { subject: "Physics" });
    expect(result.changedFields).toEqual(["subject"]);
    expect(result.hasMaterialChange).toBe(true);
  });
});

describe("getDocumentChangeClassification — no-op / unchanged values", () => {
  test("a field submitted with its current value is not counted as changed", () => {
    const result = getDocumentChangeClassification(CURRENT, { title: CURRENT.title });
    expect(result.changedFields).toEqual([]);
    expect(result.hasMaterialChange).toBe(false);
  });

  test("resubmitting the same documentType is not a material change", () => {
    const result = getDocumentChangeClassification(CURRENT, { documentType: "EXERCISE" });
    expect(result.changedFields).toEqual([]);
    expect(result.hasMaterialChange).toBe(false);
  });

  test("an empty updates object produces no changed fields", () => {
    const result = getDocumentChangeClassification(CURRENT, {});
    expect(result.changedFields).toEqual([]);
    expect(result.hasMaterialChange).toBe(false);
  });
});

describe("getDocumentChangeClassification — mixed edits", () => {
  test("a request changing both a minor and a material field is classified as material overall", () => {
    const result = getDocumentChangeClassification(CURRENT, {
      title: "Updated title",
      documentType: "REFERENCE",
    });
    expect(result.changedFields.sort()).toEqual(["documentType", "title"]);
    expect(result.hasMaterialChange).toBe(true);
  });

  test("multiple minor fields changing together stay non-material", () => {
    const result = getDocumentChangeClassification(CURRENT, {
      title: "Updated title",
      academicYear: "2026-2027",
    });
    expect(result.hasMaterialChange).toBe(false);
  });
});
