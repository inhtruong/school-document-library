import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { changePassword } from "@/lib/auth/change-password";
import { PASSWORD_CHANGE_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { checkRateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";

/** Changes the signed-in user's own password only — `session.user.id` is the sole source of the update target, never the request body. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  const rateLimit = checkRateLimit({
    scope: "password-change",
    identity: session.user.id,
    ...PASSWORD_CHANGE_RATE_LIMIT,
  });
  if (rateLimit.limited) return tooManyRequestsResponse(rateLimit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  try {
    const result = await changePassword(session.user.id, body);
    if (!result.success) return apiError(result.error, result.status);
    return apiSuccess({ changed: true });
  } catch (error) {
    console.error("POST /api/profile/password failed", error);
    return apiError("Failed to change password", 500);
  }
}
