import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createReport } from "@/lib/documents/report";
import { prisma } from "@/lib/prisma";
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
  if (!session?.user) return apiError("Authentication required", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid report", 400);
  }

  try {
    const document = await prisma.document.findUnique({ where: { id }, select: { id: true } });
    if (!document) return apiError("Document not found", 404);

    const result = await createReport(id, session.user.id, parsed.data.reason, parsed.data.description);
    if (result.outcome === "duplicate") {
      return apiError("You have already reported this issue.", 409);
    }

    return apiSuccess(result.report, { status: 201 });
  } catch (error) {
    console.error(`POST /api/documents/${id}/reports failed`, error);
    return apiError("Failed to submit report", 500);
  }
}
