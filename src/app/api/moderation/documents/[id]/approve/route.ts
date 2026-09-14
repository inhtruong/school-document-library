import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { approveDocument } from "@/lib/moderation/moderation";

type RouteContext = { params: Promise<{ id: string }> };

/** ADMIN only. Reviewer identity always comes from the session — never accepted from the client. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  try {
    const result = await approveDocument(id, actorFromSessionUser(session.user));

    if (result.outcome === "not-found") return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
    if (result.outcome === "not-pending") {
      return apiErrorCode("DOCUMENT_NOT_PENDING", 409);
    }

    return apiSuccess({ id, moderationStatus: "APPROVED" as const });
  } catch (error) {
    console.error(`POST /api/moderation/documents/${id}/approve failed`, error);
    return apiErrorCode("FAILED_APPROVE_DOCUMENT", 500);
  }
}
