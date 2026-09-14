import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
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
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);

  try {
    const result = await resubmitDocument(actorFromSessionUser(session.user), id);

    if (result.outcome === "not-found") return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
    if (result.outcome === "forbidden") {
      return apiErrorCode("FORBIDDEN_RESUBMIT_DOCUMENT", 403);
    }
    if (result.outcome === "not-rejected") return apiErrorCode("DOCUMENT_NOT_REJECTED", 409);

    return apiSuccess({ id, moderationStatus: "PENDING" as const });
  } catch (error) {
    console.error(`POST /api/documents/${id}/resubmit failed`, error);
    return apiErrorCode("FAILED_RESUBMIT_DOCUMENT", 500);
  }
}
