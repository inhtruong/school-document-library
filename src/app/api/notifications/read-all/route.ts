import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { markAllNotificationsRead } from "@/lib/notifications/notification";

/** Requires authentication. Only ever marks the current user's own unread notifications — never another user's. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);

  try {
    const updatedCount = await markAllNotificationsRead(session.user.id);
    return apiSuccess({ updatedCount });
  } catch (error) {
    console.error("POST /api/notifications/read-all failed", error);
    return apiErrorCode("FAILED_UPDATE_NOTIFICATIONS_ALL", 500);
  }
}
