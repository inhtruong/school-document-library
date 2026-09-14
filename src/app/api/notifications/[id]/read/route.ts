import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { markNotificationRead } from "@/lib/notifications/notification";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Requires authentication. Ownership-enforced: a notification that doesn't
 * belong to the caller (or doesn't exist at all) returns 404 identically,
 * never revealing whether it exists for someone else. Idempotent — marking
 * an already-read notification again is a safe no-op, not an error.
 */
export async function PATCH(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);

  try {
    const result = await markNotificationRead(id, session.user.id);
    if (result.outcome === "not-found") return apiErrorCode("NOTIFICATION_NOT_FOUND", 404);

    return apiSuccess({ id, read: true });
  } catch (error) {
    console.error(`PATCH /api/notifications/${id}/read failed`, error);
    return apiErrorCode("FAILED_UPDATE_NOTIFICATION", 500);
  }
}
