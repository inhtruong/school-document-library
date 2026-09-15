import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    grade: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    document: { count: vi.fn(), groupBy: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";
import { createSubject, deleteSubject, listSubjectsForGrade, updateSubject } from "@/lib/documents/subjects";

const ACTOR = { id: "admin_1", email: "admin@example.com", role: "ADMIN" as const };
const now = new Date("2026-01-01T00:00:00.000Z");
const GRADE = { id: "grade_1", name: "Grade 10", code: "G10", sortOrder: 10, createdAt: now, updatedAt: now };
const SUBJECT = { id: "subject_1", name: "Mathematics", code: "MATH", gradeId: GRADE.id, createdAt: now, updatedAt: now };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSubject", () => {
  test("creates a subject under an existing grade and writes an audit log entry", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE as never);
    vi.mocked(prisma.subject.create).mockResolvedValue(SUBJECT as never);

    const result = await createSubject({ name: "Mathematics", code: "MATH", gradeId: GRADE.id }, ACTOR);

    expect(result).toEqual({ outcome: "created", subject: SUBJECT });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "SUBJECT_CREATED", entityType: "SUBJECT", entityId: SUBJECT.id }),
      })
    );
  });

  test("returns grade-not-found without touching the database when the grade does not exist", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(null as never);

    const result = await createSubject({ name: "Mathematics", code: "MATH", gradeId: "missing" }, ACTOR);

    expect(result).toEqual({ outcome: "grade-not-found" });
    expect(prisma.subject.create).not.toHaveBeenCalled();
  });

  test("returns duplicate on a unique constraint violation", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE as never);
    vi.mocked(prisma.subject.create).mockRejectedValue({ code: "P2002" });

    const result = await createSubject({ name: "Mathematics", code: "MATH", gradeId: GRADE.id }, ACTOR);

    expect(result).toEqual({ outcome: "duplicate" });
  });
});

describe("updateSubject", () => {
  test("updates an existing subject", async () => {
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(SUBJECT as never);
    const updated = { ...SUBJECT, name: "Advanced Mathematics" };
    vi.mocked(prisma.subject.update).mockResolvedValue(updated as never);

    const result = await updateSubject(SUBJECT.id, { name: "Advanced Mathematics" }, ACTOR);

    expect(result).toEqual({ outcome: "success", subject: updated });
  });

  test("returns not-found for a nonexistent subject", async () => {
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(null as never);

    const result = await updateSubject("missing", { name: "X" }, ACTOR);

    expect(result).toEqual({ outcome: "not-found" });
  });
});

describe("deleteSubject", () => {
  test("deletes a subject with zero documents", async () => {
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(SUBJECT as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    const result = await deleteSubject(SUBJECT.id, ACTOR);

    expect(result).toEqual({ outcome: "success" });
    expect(prisma.subject.delete).toHaveBeenCalledWith({ where: { id: SUBJECT.id } });
  });

  test("blocks deletion when documents are assigned to this subject", async () => {
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(SUBJECT as never);
    vi.mocked(prisma.document.count).mockResolvedValue(2);

    const result = await deleteSubject(SUBJECT.id, ACTOR);

    expect(result).toEqual({ outcome: "in-use" });
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });
});

describe("listSubjectsForGrade", () => {
  test("returns subjects with their document count, zero for subjects with none", async () => {
    vi.mocked(prisma.subject.findMany).mockResolvedValue([
      { id: "s1", name: "Mathematics", code: "MATH", gradeId: GRADE.id },
      { id: "s2", name: "Physics", code: "PHYSICS", gradeId: GRADE.id },
    ] as never);
    vi.mocked(prisma.document.groupBy).mockResolvedValue([
      { subjectId: "s1", _count: { _all: 3 } },
    ] as never);

    const result = await listSubjectsForGrade(GRADE.id);

    expect(result).toEqual([
      { id: "s1", name: "Mathematics", code: "MATH", gradeId: GRADE.id, documentCount: 3 },
      { id: "s2", name: "Physics", code: "PHYSICS", gradeId: GRADE.id, documentCount: 0 },
    ]);
  });
});
