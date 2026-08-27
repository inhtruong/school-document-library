import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hasRole } from "@/lib/auth/authorize";
import { approveDocument } from "@/lib/moderation/moderation";

type RouteContext = { params: Promise<{ id: string }> };

/** ADMIN only. Reviewer identity always comes from the session — never accepted from the client. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);
  if (!hasRole(session, "ADMIN")) return apiError("Admin access required", 403);

  try {
    const result = await approveDocument(id, session.user.id);

    if (result.outcome === "not-found") return apiError("Document not found", 404);
    if (result.outcome === "not-pending") {
      return apiError("Document is no longer pending review", 409);
    }

    return apiSuccess({ id, moderationStatus: "APPROVED" as const });
  } catch (error) {
    console.error(`POST /api/moderation/documents/${id}/approve failed`, error);
    return apiError("Failed to approve document", 500);
  }
}
