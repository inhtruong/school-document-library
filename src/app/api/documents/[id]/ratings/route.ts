import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getRatingSummary } from "@/lib/documents/rating";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Public — no auth required to read. Returns averageRating (null when
 * ratingCount is 0), ratingCount, and the caller's own rating if they're
 * signed in (otherwise null).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const document = await prisma.document.findUnique({ where: { id }, select: { id: true } });
    if (!document) return apiError("Document not found", 404);

    const session = await auth();
    const summary = await getRatingSummary(id, session?.user?.id ?? null);

    return apiSuccess(summary);
  } catch (error) {
    console.error(`GET /api/documents/${id}/ratings failed`, error);
    return apiError("Failed to load rating summary", 500);
  }
}
