import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess, PRIVATE_NO_STORE_HEADERS } from "@/lib/api-response";
import { getMyOpenReportReasons } from "@/lib/documents/report";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Small, authenticated-only helper — no general report list exists (and
 * won't, until Admin moderation). Tells the caller which reasons they
 * already have an OPEN report for on this Document, so the UI can hint
 * "already reported" per reason; never exposes other users' reports.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const reasons = await getMyOpenReportReasons(id, session.user.id);
    return apiSuccess({ reportedReasons: reasons }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    console.error(`GET /api/documents/${id}/reports/mine failed`, error);
    return apiError("Failed to load report status", 500);
  }
}
