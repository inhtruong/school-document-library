import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { markAllNotificationsRead } from "@/lib/notifications/notification";

/** Requires authentication. Only ever marks the current user's own unread notifications — never another user's. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const updatedCount = await markAllNotificationsRead(session.user.id);
    return apiSuccess({ updatedCount });
  } catch (error) {
    console.error("POST /api/notifications/read-all failed", error);
    return apiError("Failed to update notifications", 500);
  }
}
