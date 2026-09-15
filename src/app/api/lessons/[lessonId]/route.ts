import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { deleteLesson, updateLesson } from "@/lib/documents/lessons";
import { updateLessonSchema } from "@/lib/validation/taxonomy-admin";

type RouteContext = { params: Promise<{ lessonId: string }> };

/** ADMIN only (FEAT-15B). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { lessonId } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  const parsed = updateLessonSchema.safeParse(body);
  if (!parsed.success) return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);

  try {
    const result = await updateLesson(lessonId, parsed.data, actorFromSessionUser(session.user));

    if (result.outcome === "not-found") return apiErrorCode("LESSON_NOT_FOUND", 404);
    if (result.outcome === "duplicate") return apiErrorCode("LESSON_CODE_ALREADY_EXISTS", 409);

    return apiSuccess(result.lesson);
  } catch (error) {
    console.error(`PATCH /api/lessons/${lessonId} failed`, error);
    return apiErrorCode("FAILED_UPDATE_LESSON", 500);
  }
}

/** ADMIN only (FEAT-15B). Blocked (409) while any Document still references this Lesson — see deleteGrade()'s doc comment. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { lessonId } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  try {
    const result = await deleteLesson(lessonId, actorFromSessionUser(session.user));

    if (result.outcome === "not-found") return apiErrorCode("LESSON_NOT_FOUND", 404);
    if (result.outcome === "in-use") return apiErrorCode("LESSON_IN_USE", 409);

    return apiSuccess({ id: lessonId });
  } catch (error) {
    console.error(`DELETE /api/lessons/${lessonId} failed`, error);
    return apiErrorCode("FAILED_DELETE_LESSON", 500);
  }
}
