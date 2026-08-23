import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { followTeacher, isFollowingTeacher, unfollowTeacher } from "@/lib/follow/teacher-follow";

type RouteContext = { params: Promise<{ teacherId: string }> };

/** Requires any signed-in user. Returns only the caller's own follow state — never a follower list. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { teacherId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const following = await isFollowingTeacher(session.user.id, teacherId);
    return apiSuccess({ following });
  } catch (error) {
    console.error(`GET /api/teachers/${teacherId}/follow failed`, error);
    return apiError("Failed to load follow state", 500);
  }
}

/**
 * Idempotent — no body is read; `teacherId` comes from the route,
 * `followerId` from the session. Rejects following a non-TEACHER user (or
 * a nonexistent one, indistinguishably) and self-follow.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { teacherId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const result = await followTeacher(session.user.id, teacherId);
    if (result.outcome === "self-follow") return apiError("You cannot follow yourself", 400);
    if (result.outcome === "not-found") return apiError("Teacher not found", 404);

    return apiSuccess({ following: true });
  } catch (error) {
    console.error(`POST /api/teachers/${teacherId}/follow failed`, error);
    return apiError("Failed to follow teacher", 500);
  }
}

/** Safe to call even with no existing follow — never crashes on a missing row. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { teacherId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    await unfollowTeacher(session.user.id, teacherId);
    return apiSuccess({ following: false });
  } catch (error) {
    console.error(`DELETE /api/teachers/${teacherId}/follow failed`, error);
    return apiError("Failed to unfollow teacher", 500);
  }
}
