import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    grade: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    document: { count: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";
import { createGrade, deleteGrade, updateGrade } from "@/lib/documents/grades";

const ACTOR = { id: "admin_1", email: "admin@example.com", role: "ADMIN" as const };
const now = new Date("2026-01-01T00:00:00.000Z");
const GRADE = { id: "grade_1", name: "Grade 10", code: "G10", sortOrder: 10, createdAt: now, updatedAt: now };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createGrade", () => {
  test("creates a grade and writes an audit log entry", async () => {
    vi.mocked(prisma.grade.create).mockResolvedValue(GRADE as never);

    const result = await createGrade({ name: "Grade 10", code: "G10", sortOrder: 10 }, ACTOR);

    expect(result).toEqual({ outcome: "created", grade: GRADE });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "GRADE_CREATED", entityType: "GRADE", entityId: GRADE.id }),
      })
    );
  });

  test("returns duplicate on a unique constraint violation instead of throwing", async () => {
    vi.mocked(prisma.grade.create).mockRejectedValue({ code: "P2002" });

    const result = await createGrade({ name: "Grade 10", code: "G10" }, ACTOR);

    expect(result).toEqual({ outcome: "duplicate" });
  });
});

describe("updateGrade", () => {
  test("updates an existing grade", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE as never);
    const updated = { ...GRADE, name: "Grade Ten" };
    vi.mocked(prisma.grade.update).mockResolvedValue(updated as never);

    const result = await updateGrade(GRADE.id, { name: "Grade Ten" }, ACTOR);

    expect(result).toEqual({ outcome: "success", grade: updated });
  });

  test("returns not-found for a nonexistent grade", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(null as never);

    const result = await updateGrade("missing", { name: "X" }, ACTOR);

    expect(result).toEqual({ outcome: "not-found" });
    expect(prisma.grade.update).not.toHaveBeenCalled();
  });

  test("returns duplicate when the new code collides with another grade", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE as never);
    vi.mocked(prisma.grade.update).mockRejectedValue({ code: "P2002" });

    const result = await updateGrade(GRADE.id, { code: "G11" }, ACTOR);

    expect(result).toEqual({ outcome: "duplicate" });
  });
});

describe("deleteGrade", () => {
  test("deletes a grade with zero documents", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE as never);
    vi.mocked(prisma.document.count).mockResolvedValue(0);

    const result = await deleteGrade(GRADE.id, ACTOR);

    expect(result).toEqual({ outcome: "success" });
    expect(prisma.grade.delete).toHaveBeenCalledWith({ where: { id: GRADE.id } });
  });

  test("blocks deletion when documents are assigned to this grade", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(GRADE as never);
    vi.mocked(prisma.document.count).mockResolvedValue(3);

    const result = await deleteGrade(GRADE.id, ACTOR);

    expect(result).toEqual({ outcome: "in-use" });
    expect(prisma.grade.delete).not.toHaveBeenCalled();
  });

  test("returns not-found for a nonexistent grade", async () => {
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(null as never);

    const result = await deleteGrade("missing", ACTOR);

    expect(result).toEqual({ outcome: "not-found" });
    expect(prisma.document.count).not.toHaveBeenCalled();
  });
});
