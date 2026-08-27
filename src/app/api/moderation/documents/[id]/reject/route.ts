import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hasRole } from "@/lib/auth/authorize";
import { rejectDocument } from "@/lib/moderation/moderation";

type RouteContext = { params: Promise<{ id: string }> };

/** ADMIN only. Reviewer identity always comes from the session — client may only submit `reason`. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);
  if (!hasRole(session, "ADMIN")) return apiError("Admin access required", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  try {
    const result = await rejectDocument(id, session.user.id, body);

    if (result.outcome === "invalid") return apiError(result.error, 400);
    if (result.outcome === "not-found") return apiError("Document not found", 404);
    if (result.outcome === "not-pending") {
      return apiError("Document is no longer pending review", 409);
    }

    return apiSuccess({ id, moderationStatus: "REJECTED" as const });
  } catch (error) {
    console.error(`POST /api/moderation/documents/${id}/reject failed`, error);
    return apiError("Failed to reject document", 500);
  }
}
