import type { NextRequest } from "next/server";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

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
