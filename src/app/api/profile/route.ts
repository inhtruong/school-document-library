import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateProfileName } from "@/lib/auth/update-profile";

/** Updates the signed-in user's own name only — `session.user.id` is the sole source of the update target, never the request body. */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  try {
    const result = await updateProfileName(session.user.id, body);
    if (!result.success) return apiError(result.error, result.status);
    return apiSuccess(result.user);
  } catch (error) {
    console.error("PATCH /api/profile failed", error);
    return apiError("Failed to update profile", 500);
  }
}
