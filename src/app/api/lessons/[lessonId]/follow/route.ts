import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { followLesson, isFollowingLesson, unfollowLesson } from "@/lib/follow/lesson-follow";

type RouteContext = { params: Promise<{ lessonId: string }> };

/** Requires any signed-in user. Returns only the caller's own follow state. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { lessonId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const following = await isFollowingLesson(session.user.id, lessonId);
    return apiSuccess({ following });
  } catch (error) {
    console.error(`GET /api/lessons/${lessonId}/follow failed`, error);
    return apiError("Failed to load follow state", 500);
  }
}

/** Idempotent — no body is read; `lessonId` comes from the route, `userId` from the session. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { lessonId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const result = await followLesson(session.user.id, lessonId);
    if (result.outcome === "not-found") return apiError("Lesson not found", 404);

    return apiSuccess({ following: true });
  } catch (error) {
    console.error(`POST /api/lessons/${lessonId}/follow failed`, error);
    return apiError("Failed to follow lesson", 500);
  }
}

/** Safe to call even with no existing follow — never crashes on a missing row. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { lessonId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    await unfollowLesson(session.user.id, lessonId);
    return apiSuccess({ following: false });
  } catch (error) {
    console.error(`DELETE /api/lessons/${lessonId}/follow failed`, error);
    return apiError("Failed to unfollow lesson", 500);
  }
}
