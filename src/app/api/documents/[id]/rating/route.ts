import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { rateDocumentSchema } from "@/lib/validation/rating";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Requires any signed-in user (STUDENT/TEACHER/ADMIN — no role restriction).
 * `userId` always comes from the session, never the request body; the
 * client can only submit `value`. One rating per user per document is
 * enforced by the `@@unique([documentId, userId])` constraint — `upsert`
 * creates on first submission, updates in place on every one after.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  const parsed = rateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid rating value", 400);
  }

  try {
    const document = await prisma.document.findUnique({ where: { id }, select: { id: true } });
    if (!document) return apiError("Document not found", 404);

    const rating = await prisma.documentRating.upsert({
      where: { documentId_userId: { documentId: id, userId: session.user.id } },
      create: { documentId: id, userId: session.user.id, value: parsed.data.value },
      update: { value: parsed.data.value },
      select: { value: true },
    });

    return apiSuccess(rating);
  } catch (error) {
    console.error(`PUT /api/documents/${id}/rating failed`, error);
    return apiError("Failed to save rating", 500);
  }
}
