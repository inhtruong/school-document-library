import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getUnreadNotificationCount } from "@/lib/notifications/notification";

/** Requires authentication. Never exposes another user's unread count — always scoped to the session. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const unreadCount = await getUnreadNotificationCount(session.user.id);
    return apiSuccess({ unreadCount });
  } catch (error) {
    console.error("GET /api/notifications/unread-count failed", error);
    return apiError("Failed to load unread count", 500);
  }
}
