import "server-only";
import { prisma } from "@/lib/prisma";
import type { GradeSummary } from "@/types/document";

/**
 * Grades are seed/static data, not user-editable in this step. Shared by
 * `GET /api/grades` (the client-side taxonomy selects) and any Server
 * Component that needs the initial Grade list without a self-fetch
 * (`/search`, `/upload`).
 */
export async function listGrades(): Promise<GradeSummary[]> {
  return prisma.grade.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, code: true, sortOrder: true },
  });
}
