import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { createLesson } from "@/lib/documents/lessons";
import { prisma } from "@/lib/prisma";
import { createLessonSchema } from "@/lib/validation/taxonomy-admin";

/** Public read API — powers the Lesson/Topic dropdown on /upload once a Subject is picked. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId")?.trim();

  if (!subjectId) {
    return apiErrorCode("SUBJECT_ID_QUERY_REQUIRED", 400);
  }

  try {
    const lessons = await prisma.lesson.findMany({
      where: { subjectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, subjectId: true },
    });
    return apiSuccess(lessons);
  } catch (error) {
    console.error("GET /api/lessons failed", error);
    return apiErrorCode("FAILED_LOAD_LESSONS", 500);
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

  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);

  try {
    const result = await createLesson(parsed.data, actorFromSessionUser(session.user));

    if (result.outcome === "subject-not-found") return apiErrorCode("SUBJECT_NOT_FOUND", 404);
    if (result.outcome === "duplicate") return apiErrorCode("LESSON_CODE_ALREADY_EXISTS", 409);

    return apiSuccess(result.lesson, { status: 201 });
  } catch (error) {
    console.error("POST /api/lessons failed", error);
    return apiErrorCode("FAILED_CREATE_LESSON", 500);
  }
}
