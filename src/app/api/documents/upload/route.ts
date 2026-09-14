import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { hasRole } from "@/lib/auth/authorize";
import { uploadDocument } from "@/lib/documents/upload";
import { UPLOAD_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { checkRateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorCode("SIGNIN_REQUIRED_UPLOAD", 401);
  }
  if (!hasRole(session, ["TEACHER", "ADMIN"])) {
    return apiErrorCode("FORBIDDEN_UPLOAD_ROLE", 403);
  }

  const rateLimit = checkRateLimit({ scope: "upload", identity: session.user.id, ...UPLOAD_RATE_LIMIT });
  if (rateLimit.limited) return await tooManyRequestsResponse(rateLimit.retryAfterSeconds);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiErrorCode("VALIDATION_MULTIPART_REQUIRED", 400);
  }

  const result = await uploadDocument({
    uploaderId: session.user.id,
    uploaderRole: session.user.role,
    uploaderEmail: session.user.email ?? null,
    formData,
  });
  if (!result.success) return apiErrorCode(result.error, result.status);

  return apiSuccess(result.document, { status: 201 });
}
