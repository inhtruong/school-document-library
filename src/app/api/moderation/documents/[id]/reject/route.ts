import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { rejectDocument } from "@/lib/moderation/moderation";

type RouteContext = { params: Promise<{ id: string }> };

/** ADMIN only. Reviewer identity always comes from the session — client may only submit `reason`. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  try {
    const result = await rejectDocument(id, actorFromSessionUser(session.user), body);

    if (result.outcome === "invalid") return apiErrorCode(result.error, 400);
    if (result.outcome === "not-found") return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
    if (result.outcome === "not-pending") {
      return apiErrorCode("DOCUMENT_NOT_PENDING", 409);
    }

    return apiSuccess({ id, moderationStatus: "REJECTED" as const });
  } catch (error) {
    console.error(`POST /api/moderation/documents/${id}/reject failed`, error);
    return apiErrorCode("FAILED_REJECT_DOCUMENT", 500);
  }
}
