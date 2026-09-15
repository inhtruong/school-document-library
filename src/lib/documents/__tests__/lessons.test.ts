import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    subject: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    document: { count: vi.fn(), groupBy: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";
import { createLesson, deleteLesson, listLessonsForSubject, updateLesson } from "@/lib/documents/lessons";

const ACTOR = { id: "admin_1", email: "admin@example.com", role: "ADMIN" as const };
const now = new Date("2026-01-01T00:00:00.000Z");
const SUBJECT = { id: "subject_1", name: "Physics", code: "PHYSICS", gradeId: "grade_1", createdAt: now, updatedAt: now };
const LESSON = { id: "lesson_1", name: "Motion", code: "MOTION", subjectId: SUBJECT.id, createdAt: now, updatedAt: now };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createLesson", () => {
  test("creates a lesson under an existing subject and writes an audit log entry", async () => {
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(SUBJECT as never);
    vi.mocked(prisma.lesson.create).mockResolvedValue(LESSON as never);

    const result = await createLesson({ name: "Motion", code: "MOTION", subjectId: SUBJECT.id }, ACTOR);

    expect(result).toEqual({ outcome: "created", lesson: LESSON });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "LESSON_CREATED", entityType: "LESSON", entityId: LESSON.id }),
      })
    );
  });

  test("returns subject-not-found without touching the database when the subject does not exist", async () => {
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(null as never);

    const result = await createLesson({ name: "Motion", code: "MOTION", subjectId: "missing" }, ACTOR);

    expect(result).toEqual({ outcome: "subject-not-found" });
    expect(prisma.lesson.create).not.toHaveBeenCalled();
  });

  test("returns duplicate on a unique constraint violation", async () => {
    vi.mocked(prisma.subject.findUnique).mockResolvedValue(SUBJECT as never);
    vi.mocked(prisma.lesson.create).mockRejectedValue({ code: "P2002" });

    const result = await createLesson({ name: "Motion", code: "MOTION", subjectId: SUBJECT.id }, ACTOR);

    expect(result).toEqual({ outcome: "duplicate" });
  });
});

describe("updateLesson", () => {
  test("updates an existing lesson", async () => {
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(LESSON as never);
    const updated = { ...LESSON, name: "Kinematics" };
    vi.mocked(prisma.lesson.update).mockResolvedValue(updated as never);

    const result = await updateLesson(LESSON.id, { name: "Kinematics" }, ACTOR);

    expect(result).toEqual({ outcome: "success", lesson: updated });
  });

  test("returns not-found for a nonexistent lesson", async () => {
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(null as never);

    const result = await updateLesson("missing", { name: "X" }, ACTOR);

    expect(result).toEqual({ outcome: "not-found" });
  });
});

describe("deleteLesson", () => {
  test("deletes a lesson with zero documents", async () => {
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(LESSON as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    const result = await deleteLesson(LESSON.id, ACTOR);

    expect(result).toEqual({ outcome: "success" });
    expect(prisma.lesson.delete).toHaveBeenCalledWith({ where: { id: LESSON.id } });
  });

  test("blocks deletion when documents are assigned to this lesson", async () => {
    vi.mocked(prisma.lesson.findUnique).mockResolvedValue(LESSON as never);
    vi.mocked(prisma.document.count).mockResolvedValue(1);

    const result = await deleteLesson(LESSON.id, ACTOR);

    expect(result).toEqual({ outcome: "in-use" });
    expect(prisma.lesson.delete).not.toHaveBeenCalled();
  });
});

describe("listLessonsForSubject", () => {
  test("returns lessons with their document count, zero for lessons with none", async () => {
    vi.mocked(prisma.lesson.findMany).mockResolvedValue([
      { id: "l1", name: "Motion", code: "MOTION", subjectId: SUBJECT.id },
      { id: "l2", name: "Energy", code: "ENERGY", subjectId: SUBJECT.id },
    ] as never);
    vi.mocked(prisma.document.groupBy).mockResolvedValue([{ lessonId: "l1", _count: { _all: 2 } }] as never);

    const result = await listLessonsForSubject(SUBJECT.id);

    expect(result).toEqual([
      { id: "l1", name: "Motion", code: "MOTION", subjectId: SUBJECT.id, documentCount: 2 },
      { id: "l2", name: "Energy", code: "ENERGY", subjectId: SUBJECT.id, documentCount: 0 },
    ]);
  });
});
