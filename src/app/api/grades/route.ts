import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { createGrade, listGrades } from "@/lib/documents/grades";
import { createGradeSchema } from "@/lib/validation/taxonomy-admin";

/** Public read API — powers the Grade dropdown on /upload. */
export async function GET() {
  try {
    const grades = await listGrades();
    return apiSuccess(grades);
  } catch (error) {
    console.error("GET /api/grades failed", error);
    return apiErrorCode("FAILED_LOAD_GRADES", 500);
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

  const parsed = createGradeSchema.safeParse(body);
  if (!parsed.success) return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);

  try {
    const result = await createGrade(parsed.data, actorFromSessionUser(session.user));

    if (result.outcome === "duplicate") return apiErrorCode("GRADE_CODE_ALREADY_EXISTS", 409);

    return apiSuccess(result.grade, { status: 201 });
  } catch (error) {
    console.error("POST /api/grades failed", error);
    return apiErrorCode("FAILED_CREATE_GRADE", 500);
  }
}
