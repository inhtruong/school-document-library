import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

/**
 * Dual-purpose, matching its two callers:
 *  - No `gradeId` — unchanged homepage/search "browse by subject" behavior:
 *    distinct legacy `Document.subject` text values with counts. Left as-is
 *    (not switched to the new Subject model) because that legacy field is
 *    kept in sync automatically from the taxonomy Subject's name on new
 *    uploads (see uploadDocument()), so this grouping stays accurate for
 *    both legacy and taxonomy-backed documents without a homepage redesign.
 *  - `?gradeId=...` — new taxonomy read API: Subject rows for one Grade,
 *    powering the cascading upload selector.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gradeId = searchParams.get("gradeId")?.trim();

  try {
    if (gradeId) {
      const subjects = await prisma.subject.findMany({
        where: { gradeId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, gradeId: true },
      });
      return apiSuccess(subjects);
    }

    const grouped = await prisma.document.groupBy({
      by: ["subject"],
      _count: { _all: true },
      orderBy: { subject: "asc" },
    });

    const subjects = grouped.map((group) => ({
      subject: group.subject,
      count: group._count._all,
    }));

    return apiSuccess(subjects);
  } catch (error) {
    console.error("GET /api/subjects failed", error);
    return apiError("Failed to load subjects", 500);
  }
}
