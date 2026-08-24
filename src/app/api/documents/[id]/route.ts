import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getDocumentById } from "@/lib/documents/get-document";
import { prisma } from "@/lib/prisma";
import { updateDocumentSchema } from "@/lib/validation/document";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const document = await getDocumentById(id);
    if (!document) return apiError("Document not found", 404);
    return apiSuccess(document);
  } catch (error) {
    console.error(`GET /api/documents/${id} failed`, error);
    return apiError("Failed to load document", 500);
  }
}

/**
 * Owner (the TEACHER/ADMIN who uploaded it) or ADMIN may modify a document.
 * A legacy document with no `uploadedById` (created before Step 6A, or via
 * the metadata-only POST at /api/documents) has no owner to match against,
 * so only ADMIN may touch it — never "whoever gets there first".
 */
function canModifyDocument(session: Session, uploadedById: string | null): boolean {
  if (session.user.role === "ADMIN") return true;
  return uploadedById !== null && uploadedById === session.user.id;
}

/**
 * Legacy metadata-only update path — had no authorization check at all
 * until Step 13C, which is a bug (any caller could edit any document), not
 * intended behavior. Now enforces the same owner-or-ADMIN boundary as
 * comment edit/delete.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in to update documents", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid document data", 400);
  }

  try {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return apiError("Document not found", 404);
    if (!canModifyDocument(session, existing.uploadedById)) {
      return apiError("You do not have permission to update this document", 403);
    }

    const document = await prisma.document.update({
      where: { id },
      data: parsed.data,
      omit: { fileKey: true },
    });
    return apiSuccess(document);
  } catch (error) {
    console.error(`PUT /api/documents/${id} failed`, error);
    return apiError("Failed to update document", 500);
  }
}

/**
 * Same owner-or-ADMIN boundary as PUT above — had no authorization check
 * at all until Step 13C.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in to delete documents", 401);
  }

  try {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return apiError("Document not found", 404);
    if (!canModifyDocument(session, existing.uploadedById)) {
      return apiError("You do not have permission to delete this document", 403);
    }

    await prisma.document.delete({ where: { id } });
    return apiSuccess({ id });
  } catch (error) {
    console.error(`DELETE /api/documents/${id} failed`, error);
    return apiError("Failed to delete document", 500);
  }
}
