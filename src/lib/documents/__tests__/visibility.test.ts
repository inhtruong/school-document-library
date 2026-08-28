import { describe, expect, test } from "vitest";
import type { Session } from "next-auth";
import { APPROVED_DOCUMENT_WHERE, isDocumentVisibleTo } from "@/lib/documents/visibility";

function sessionFor(role: "STUDENT" | "TEACHER" | "ADMIN", userId = "user_1"): Session {
  return {
    user: { id: userId, role },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

describe("APPROVED_DOCUMENT_WHERE", () => {
  test("is exactly a moderationStatus: APPROVED filter", () => {
    expect(APPROVED_DOCUMENT_WHERE).toEqual({ moderationStatus: "APPROVED" });
  });
});

describe("isDocumentVisibleTo", () => {
  test("an APPROVED document is visible to a guest (no session)", () => {
    const doc = { moderationStatus: "APPROVED", uploadedById: "teacher_1" };
    expect(isDocumentVisibleTo(doc, null)).toBe(true);
  });

  test("an APPROVED document is visible to any authenticated role", () => {
    const doc = { moderationStatus: "APPROVED", uploadedById: "teacher_1" };
    expect(isDocumentVisibleTo(doc, sessionFor("STUDENT"))).toBe(true);
  });

  test("a PENDING document is NOT visible to a guest", () => {
    const doc = { moderationStatus: "PENDING", uploadedById: "teacher_1" };
    expect(isDocumentVisibleTo(doc, null)).toBe(false);
  });

  test("a PENDING document is NOT visible to an unrelated authenticated user", () => {
    const doc = { moderationStatus: "PENDING", uploadedById: "teacher_1" };
    expect(isDocumentVisibleTo(doc, sessionFor("STUDENT", "student_1"))).toBe(false);
  });

  test("a PENDING document IS visible to its own uploader", () => {
    const doc = { moderationStatus: "PENDING", uploadedById: "teacher_1" };
    expect(isDocumentVisibleTo(doc, sessionFor("TEACHER", "teacher_1"))).toBe(true);
  });

  test("a PENDING document IS visible to ADMIN, regardless of ownership", () => {
    const doc = { moderationStatus: "PENDING", uploadedById: "teacher_1" };
    expect(isDocumentVisibleTo(doc, sessionFor("ADMIN", "admin_1"))).toBe(true);
  });

  test("a REJECTED document follows the same rule as PENDING", () => {
    const doc = { moderationStatus: "REJECTED", uploadedById: "teacher_1" };
    expect(isDocumentVisibleTo(doc, null)).toBe(false);
    expect(isDocumentVisibleTo(doc, sessionFor("STUDENT", "student_1"))).toBe(false);
    expect(isDocumentVisibleTo(doc, sessionFor("TEACHER", "teacher_1"))).toBe(true);
    expect(isDocumentVisibleTo(doc, sessionFor("ADMIN"))).toBe(true);
  });

  test("a PENDING legacy document with no uploader (uploadedById null) is visible only to ADMIN", () => {
    const doc = { moderationStatus: "PENDING", uploadedById: null };
    expect(isDocumentVisibleTo(doc, sessionFor("TEACHER"))).toBe(false);
    expect(isDocumentVisibleTo(doc, sessionFor("ADMIN"))).toBe(true);
  });
});
