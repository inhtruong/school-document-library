import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hasRole } from "@/lib/auth/authorize";
import { uploadDocument } from "@/lib/documents/upload";
import { UPLOAD_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { checkRateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in to upload documents", 401);
  }
  if (!hasRole(session, ["TEACHER", "ADMIN"])) {
    return apiError("Only teachers and admins can upload documents", 403);
  }

  const rateLimit = checkRateLimit({ scope: "upload", identity: session.user.id, ...UPLOAD_RATE_LIMIT });
  if (rateLimit.limited) return tooManyRequestsResponse(rateLimit.retryAfterSeconds);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Request body must be multipart form data", 400);
  }

  const result = await uploadDocument({ uploaderId: session.user.id, formData });
  if (!result.success) return apiError(result.error, result.status);

  return apiSuccess(result.document, { status: 201 });
}
