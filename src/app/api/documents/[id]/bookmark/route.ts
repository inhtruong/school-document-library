import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiError, apiSuccess, PRIVATE_NO_STORE_HEADERS } from "@/lib/api-response";
import { addBookmark, isBookmarked, removeBookmark } from "@/lib/documents/bookmark";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Requires any signed-in user. Never exposes other users' bookmark data — only the caller's own state. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, moderationStatus: true, uploadedById: true },
    });
    if (!document) return apiError("Document not found", 404);
    if (!isDocumentVisibleTo(document, session)) return apiError("Document not found", 404);

    const bookmarked = await isBookmarked(id, session.user.id);
    return apiSuccess({ bookmarked }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    console.error(`GET /api/documents/${id}/bookmark failed`, error);
    return apiError("Failed to load saved state", 500);
  }
}

/**
 * Idempotent — no body is read (there is nothing for the client to submit;
 * `documentId` comes from the route, `userId` from the session), and a
 * repeat POST is a safe no-op rather than a conflict.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, moderationStatus: true, uploadedById: true },
    });
    if (!document) return apiError("Document not found", 404);
    if (!isDocumentVisibleTo(document, session)) return apiError("Document not found", 404);

    await addBookmark(id, session.user.id);
    return apiSuccess({ bookmarked: true });
  } catch (error) {
    console.error(`POST /api/documents/${id}/bookmark failed`, error);
    return apiError("Failed to save document", 500);
  }
}

/** Safe to call even with no existing bookmark — never crashes on a missing row. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    await removeBookmark(id, session.user.id);
    return apiSuccess({ bookmarked: false });
  } catch (error) {
    console.error(`DELETE /api/documents/${id}/bookmark failed`, error);
    return apiError("Failed to remove saved document", 500);
  }
}
