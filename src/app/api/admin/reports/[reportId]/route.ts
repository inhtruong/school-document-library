import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser } from "@/lib/audit/audit";
import { hasRole } from "@/lib/auth/authorize";
import { dismissReport, resolveReport } from "@/lib/admin/reports";
import { updateReportStatusSchema } from "@/lib/validation/admin-reports";

type RouteContext = { params: Promise<{ reportId: string }> };

/** ADMIN only (FEAT-15E). OPEN -> RESOLVED/DISMISSED only — never touches the reported Document. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { reportId } = await params;

  const session = await auth();
  if (!session?.user) return apiErrorCode("AUTH_REQUIRED", 401);
  if (!hasRole(session, "ADMIN")) return apiErrorCode("ADMIN_REQUIRED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  const parsed = updateReportStatusSchema.safeParse(body);
  if (!parsed.success) return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);

  try {
    const actor = actorFromSessionUser(session.user);
    const result =
      parsed.data.status === "RESOLVED" ? await resolveReport(reportId, actor) : await dismissReport(reportId, actor);

    if (result.outcome === "not-found") return apiErrorCode("REPORT_NOT_FOUND", 404);
    if (result.outcome === "already-handled") return apiErrorCode("REPORT_ALREADY_HANDLED", 409);

    return apiSuccess({ id: reportId, status: parsed.data.status });
  } catch (error) {
    console.error(`PATCH /api/admin/reports/${reportId} failed`, error);
    return apiErrorCode("FAILED_UPDATE_REPORT", 500);
  }
}
