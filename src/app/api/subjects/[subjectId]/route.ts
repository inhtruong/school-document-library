import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { deleteSubject, updateSubject } from "@/lib/documents/subjects";
import { updateSubjectSchema } from "@/lib/validation/taxonomy-admin";

type RouteContext = { params: Promise<{ subjectId: string }> };

/** ADMIN only (FEAT-15B). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { subjectId } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  const parsed = updateSubjectSchema.safeParse(body);
  if (!parsed.success) return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);

  try {
    const result = await updateSubject(subjectId, parsed.data, actorFromSessionUser(session.user));

    if (result.outcome === "not-found") return apiErrorCode("SUBJECT_NOT_FOUND", 404);
    if (result.outcome === "duplicate") return apiErrorCode("SUBJECT_CODE_ALREADY_EXISTS", 409);

    return apiSuccess(result.subject);
  } catch (error) {
    console.error(`PATCH /api/subjects/${subjectId} failed`, error);
    return apiErrorCode("FAILED_UPDATE_SUBJECT", 500);
  }
}

/** ADMIN only (FEAT-15B). Blocked (409) while any Document still references this Subject — see deleteGrade()'s doc comment. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { subjectId } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  try {
    const result = await deleteSubject(subjectId, actorFromSessionUser(session.user));

    if (result.outcome === "not-found") return apiErrorCode("SUBJECT_NOT_FOUND", 404);
    if (result.outcome === "in-use") return apiErrorCode("SUBJECT_IN_USE", 409);

    return apiSuccess({ id: subjectId });
  } catch (error) {
    console.error(`DELETE /api/subjects/${subjectId} failed`, error);
    return apiErrorCode("FAILED_DELETE_SUBJECT", 500);
  }
}
