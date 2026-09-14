import { auth } from "@/auth";
import { apiErrorCode, apiSuccess, PRIVATE_NO_STORE_HEADERS } from "@/lib/api-response";
import { getUnreadNotificationCount } from "@/lib/notifications/notification";

/** Requires authentication. Never exposes another user's unread count — always scoped to the session. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);

  try {
    const unreadCount = await getUnreadNotificationCount(session.user.id);
    return apiSuccess({ unreadCount }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    console.error("GET /api/notifications/unread-count failed", error);
    return apiErrorCode("FAILED_LOAD_UNREAD_COUNT", 500);
  }
}
