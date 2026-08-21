import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { registerStudent } from "@/lib/auth/register";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  try {
    const result = await registerStudent(body);
    if (!result.success) return apiError(result.error, result.status);
    return apiSuccess(result.user, { status: 201 });
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return apiError("Failed to register", 500);
  }
}
