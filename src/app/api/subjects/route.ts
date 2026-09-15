import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { listSubjectSummaries } from "@/lib/documents/subject-summary";
import { createSubject } from "@/lib/documents/subjects";
import { prisma } from "@/lib/prisma";
import { createSubjectSchema } from "@/lib/validation/taxonomy-admin";

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

    const subjects = await listSubjectSummaries();
    return apiSuccess(subjects);
  } catch (error) {
    console.error("GET /api/subjects failed", error);
    return apiErrorCode("FAILED_LOAD_SUBJECTS", 500);
  }
}

/** ADMIN only (FEAT-15B). */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  const parsed = createSubjectSchema.safeParse(body);
  if (!parsed.success) return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);

  try {
    const result = await createSubject(parsed.data, actorFromSessionUser(session.user));

    if (result.outcome === "grade-not-found") return apiErrorCode("GRADE_NOT_FOUND", 404);
    if (result.outcome === "duplicate") return apiErrorCode("SUBJECT_CODE_ALREADY_EXISTS", 409);

    return apiSuccess(result.subject, { status: 201 });
  } catch (error) {
    console.error("POST /api/subjects failed", error);
    return apiErrorCode("FAILED_CREATE_SUBJECT", 500);
  }
}
