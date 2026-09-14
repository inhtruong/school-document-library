import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { createReport } from "@/lib/documents/report";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { prisma } from "@/lib/prisma";
import { REPORT_RATE_LIMIT } from "@/lib/security/rate-limit-config";
import { checkRateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";
import { createReportSchema } from "@/lib/validation/report";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Requires any signed-in user — no role restriction. `documentId` always
 * comes from the route, `userId` always from the session, and `status` is
 * always `OPEN` on create — the client body may only contain
 * `reason`/`description` (anything else it sends is silently stripped by
 * zod's default object parsing, never read).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);

  const rateLimit = checkRateLimit({ scope: "report", identity: session.user.id, ...REPORT_RATE_LIMIT });
  if (rateLimit.limited) return await tooManyRequestsResponse(rateLimit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);
  }

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, moderationStatus: true, uploadedById: true },
    });
    if (!document) return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
    if (!isDocumentVisibleTo(document, session)) return apiErrorCode("DOCUMENT_NOT_FOUND", 404);

    const result = await createReport(
      id,
      session.user.id,
      parsed.data.reason,
      parsed.data.description,
      actorFromSessionUser(session.user)
    );
    if (result.outcome === "duplicate") {
      return apiErrorCode("REPORT_ALREADY_SUBMITTED", 409);
    }

    return apiSuccess(result.report, { status: 201 });
  } catch (error) {
    console.error(`POST /api/documents/${id}/reports failed`, error);
    return apiErrorCode("FAILED_SUBMIT_REPORT", 500);
  }
}
