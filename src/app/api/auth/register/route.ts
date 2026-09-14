import type { NextRequest } from "next/server";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { registerStudent } from "@/lib/auth/register";
import { REGISTER_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit({
    scope: "register",
    identity: getClientIp(request),
    ...REGISTER_RATE_LIMIT,
  });
  if (rateLimit.limited) return await tooManyRequestsResponse(rateLimit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  try {
    const result = await registerStudent(body);
    if (!result.success) return apiErrorCode(result.error, result.status);
    return apiSuccess(result.user, { status: 201 });
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return apiErrorCode("FAILED_REGISTER", 500);
  }
}
