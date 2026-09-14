import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { updateProfileName } from "@/lib/auth/update-profile";

/** Updates the signed-in user's own name only — `session.user.id` is the sole source of the update target, never the request body. */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  try {
    const result = await updateProfileName(session.user.id, body);
    if (!result.success) return apiErrorCode(result.error, result.status);
    return apiSuccess(result.user);
  } catch (error) {
    console.error("PATCH /api/profile failed", error);
    return apiErrorCode("FAILED_UPDATE_PROFILE", 500);
  }
}
