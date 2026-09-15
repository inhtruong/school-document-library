import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { updateUserRole } from "@/lib/admin/users";
import { updateUserRoleSchema } from "@/lib/validation/admin-users";

type RouteContext = { params: Promise<{ userId: string }> };

/** ADMIN only (FEAT-15C). Self-role-change is rejected here, before any DB access — never delegated to updateUserRole(). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { userId } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);
  if (session.user.id === userId) return apiErrorCode("USER_SELF_ROLE_CHANGE_FORBIDDEN", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  const parsed = updateUserRoleSchema.safeParse(body);
  if (!parsed.success) return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);

  try {
    const result = await updateUserRole(userId, parsed.data.role, actorFromSessionUser(session.user));

    if (result.outcome === "not-found") return apiErrorCode("USER_NOT_FOUND", 404);
    if (result.outcome === "last-admin") return apiErrorCode("LAST_ADMIN_ROLE_CHANGE_FORBIDDEN", 409);
    if (result.outcome === "conflict") return apiErrorCode("USER_ROLE_CHANGE_CONFLICT", 409);

    return apiSuccess(result.user);
  } catch (error) {
    console.error(`PATCH /api/admin/users/${userId}/role failed`, error);
    return apiErrorCode("FAILED_UPDATE_USER_ROLE", 500);
  }
}
