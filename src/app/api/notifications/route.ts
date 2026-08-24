import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess, PRIVATE_NO_STORE_HEADERS } from "@/lib/api-response";
import { listNotifications } from "@/lib/notifications/notification";

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/** Requires authentication. `userId` always comes from the session — never accepted from the client — so this only ever returns the caller's own notifications. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  const page = parsePage(request.nextUrl.searchParams.get("page"));

  try {
    const result = await listNotifications(session.user.id, page);

    return apiSuccess(result.notifications, {
      meta: {
        total: result.total,
        take: result.pageSize,
        skip: (page - 1) * result.pageSize,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        unreadCount: result.unreadCount,
      },
      headers: PRIVATE_NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("GET /api/notifications failed", error);
    return apiError("Failed to load notifications", 500);
  }
}
