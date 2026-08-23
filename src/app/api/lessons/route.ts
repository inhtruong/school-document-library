import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

/** Public read API — powers the Lesson/Topic dropdown on /upload once a Subject is picked. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId")?.trim();

  if (!subjectId) {
    return apiError("subjectId query parameter is required", 400);
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
    return apiError("Failed to load lessons", 500);
  }
}
