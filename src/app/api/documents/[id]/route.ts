import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getDocumentChangeClassification } from "@/lib/documents/document-change";
import { getDocumentById } from "@/lib/documents/get-document";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { prisma } from "@/lib/prisma";
import { updateDocumentSchema } from "@/lib/validation/document";

type RouteContext = { params: Promise<{ id: string }> };

/** Matches getDocumentById's omission exactly — a document-returning response, even to the owner/ADMIN caller of PUT, must never carry internal moderation fields (FEAT-10A/10C's established boundary). */
const DOCUMENT_RESPONSE_OMIT = { fileKey: true, reviewedById: true, rejectionReason: true } as const;

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const document = await getDocumentById(id);
    if (!document) return apiError("Document not found", 404);

    const session = await auth();
    if (!isDocumentVisibleTo(document, session)) return apiError("Document not found", 404);

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
 *
 * FEAT-10E: a TEACHER-owned document that is currently APPROVED and gets a
 * *material* edit (documentType or the legacy `subject` field — see
 * document-change.ts for the full rationale) must go back to PENDING for
 * re-review; a minor-only edit (title/description/academicYear) or a no-op
 * resubmission of the same values stays APPROVED. ADMIN is the moderation
 * authority and never triggers this via an ordinary edit — an ADMIN's edit
 * of any document always leaves moderationStatus untouched. A PENDING or
 * REJECTED document is never auto-transitioned by an edit either way (a
 * REJECTED document only ever leaves that state through FEAT-10C's
 * explicit Resubmit action, never implicitly via editing).
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

    const requiresReReview =
      session.user.role !== "ADMIN" &&
      existing.moderationStatus === "APPROVED" &&
      getDocumentChangeClassification(existing, parsed.data).hasMaterialChange;

    if (!requiresReReview) {
      const document = await prisma.document.update({
        where: { id },
        data: parsed.data,
        omit: DOCUMENT_RESPONSE_OMIT,
      });
      return apiSuccess(document);
    }

    // Atomic conditional write, guarded by the moderationStatus snapshot we
    // just read: content fields and the APPROVED→PENDING transition land
    // in the SAME statement, so a public document can never briefly contain
    // material unreviewed changes (§23). The `moderationStatus: "APPROVED"`
    // guard also protects against a concurrent moderation action landing
    // between our read and this write (§24) — if the document is no longer
    // APPROVED by the time this runs, `count` is 0 and nothing is written;
    // we report a conflict rather than silently applying a stale-based
    // transition. No follower notification is generated (§11/§27) — this
    // is not a publication event.
    const result = await prisma.document.updateMany({
      where: { id, moderationStatus: "APPROVED" },
      data: { ...parsed.data, moderationStatus: "PENDING", reviewedAt: null, reviewedById: null, rejectionReason: null },
    });
    if (result.count !== 1) {
      return apiError("This document was changed by someone else. Please reload and try again.", 409);
    }

    const document = await prisma.document.findUnique({ where: { id }, omit: DOCUMENT_RESPONSE_OMIT });
    if (!document) return apiError("Failed to update document", 500);
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
