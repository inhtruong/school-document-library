import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { resubmitDocument } from "@/lib/documents/teacher-uploads";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Only the original uploader may resubmit their own REJECTED document —
 * enforced entirely by the atomic `uploadedById`-scoped update in
 * resubmitDocument(); the uploader id always comes from the session, never
 * the request body/URL. No explicit role check is needed: a Student's
 * session id can never match a Document's uploadedById (Students never
 * upload), so ownership alone is a sufficient and correct barrier.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const result = await resubmitDocument(session.user.id, id);

    if (result.outcome === "not-found") return apiError("Document not found", 404);
    if (result.outcome === "forbidden") {
      return apiError("You do not have permission to resubmit this document", 403);
    }
    if (result.outcome === "not-rejected") return apiError("Document is not currently rejected", 409);

    return apiSuccess({ id, moderationStatus: "PENDING" as const });
  } catch (error) {
    console.error(`POST /api/documents/${id}/resubmit failed`, error);
    return apiError("Failed to resubmit document", 500);
  }
}
