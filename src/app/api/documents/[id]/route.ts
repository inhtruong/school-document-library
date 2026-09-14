import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser, writeAuditLog } from "@/lib/audit/audit";
import { getDocumentChangeClassification } from "@/lib/documents/document-change";
import { getDocumentById } from "@/lib/documents/get-document";
import { isDocumentVisibleTo } from "@/lib/documents/visibility";
import { prisma } from "@/lib/prisma";
import { deleteLocalFile } from "@/lib/storage/local-storage";
import { updateDocumentSchema } from "@/lib/validation/document";

type RouteContext = { params: Promise<{ id: string }> };

/** Matches getDocumentById's omission exactly — a document-returning response, even to the owner/ADMIN caller of PUT, must never carry internal moderation fields (FEAT-10A/10C's established boundary). */
const DOCUMENT_RESPONSE_OMIT = {
  fileKey: true,
  previewFileKey: true,
  reviewedById: true,
  rejectionReason: true,
} as const;

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const document = await getDocumentById(id);
    if (!document) return apiErrorCode("DOCUMENT_NOT_FOUND", 404);

    const session = await auth();
    if (!isDocumentVisibleTo(document, session)) return apiErrorCode("DOCUMENT_NOT_FOUND", 404);

    return apiSuccess(document);
  } catch (error) {
    console.error(`GET /api/documents/${id} failed`, error);
    return apiErrorCode("FAILED_LOAD_DOCUMENT", 500);
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
    return apiErrorCode("SIGNIN_REQUIRED_UPDATE", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorCode("VALIDATION_INVALID_JSON", 400);
  }

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorCode(parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC", 400);
  }

  try {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
    if (!canModifyDocument(session, existing.uploadedById)) {
      return apiErrorCode("FORBIDDEN_UPDATE_DOCUMENT", 403);
    }

    // Computed unconditionally now (FEAT-11 §18), not only for the
    // material-change gate below — `changedFields` also drives the
    // DOCUMENT_UPDATED audit metadata, and a genuinely empty result (a
    // resubmission of identical values) is the one case that gets NO audit
    // row at all, matching the no-op rule.
    const classification = getDocumentChangeClassification(existing, parsed.data);
    const requiresReReview =
      session.user.role !== "ADMIN" && existing.moderationStatus === "APPROVED" && classification.hasMaterialChange;
    const actor = actorFromSessionUser(session.user);

    if (!requiresReReview) {
      if (classification.changedFields.length === 0) {
        const document = await prisma.document.update({
          where: { id },
          data: parsed.data,
          omit: DOCUMENT_RESPONSE_OMIT,
        });
        return apiSuccess(document);
      }

      // FEAT-11 §15/§37: the mutation and its audit row commit together —
      // a failed audit write rolls back the (otherwise harmless) edit too,
      // matching document delete/moderation's atomicity guarantee.
      const document = await prisma.$transaction(async (tx) => {
        const updated = await tx.document.update({ where: { id }, data: parsed.data, omit: DOCUMENT_RESPONSE_OMIT });
        await writeAuditLog(
          {
            actor,
            action: "DOCUMENT_UPDATED",
            entityType: "DOCUMENT",
            entityId: id,
            metadata: { documentTitle: updated.title, changedFields: classification.changedFields },
          },
          tx
        );
        return updated;
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
    const document = await prisma.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id, moderationStatus: "APPROVED" },
        data: { ...parsed.data, moderationStatus: "PENDING", reviewedAt: null, reviewedById: null, rejectionReason: null },
      });
      if (result.count !== 1) return null;

      const updated = await tx.document.findUnique({ where: { id }, omit: DOCUMENT_RESPONSE_OMIT });
      if (!updated) throw new Error(`Document ${id} vanished mid-transaction after a successful edit`);

      await writeAuditLog(
        {
          actor,
          action: "DOCUMENT_UPDATED",
          entityType: "DOCUMENT",
          entityId: id,
          metadata: {
            documentTitle: updated.title,
            changedFields: classification.changedFields,
            moderationTransition: { from: "APPROVED", to: "PENDING" },
          },
        },
        tx
      );

      return updated;
    });

    if (document === null) {
      return apiErrorCode("DOCUMENT_CONFLICT_STALE", 409);
    }
    return apiSuccess(document);
  } catch (error) {
    console.error(`PUT /api/documents/${id} failed`, error);
    return apiErrorCode("FAILED_UPDATE_DOCUMENT", 500);
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
    return apiErrorCode("SIGNIN_REQUIRED_DELETE", 401);
  }

  try {
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return apiErrorCode("DOCUMENT_NOT_FOUND", 404);
    if (!canModifyDocument(session, existing.uploadedById)) {
      return apiErrorCode("FORBIDDEN_DELETE_DOCUMENT", 403);
    }

    // FEAT-11 §19: title/moderationStatus are snapshotted from `existing`
    // (already fetched above) BEFORE the row is gone — entityId is a
    // logical reference, not a live FK, so this AuditLog row is the only
    // place that history survives once the Document itself no longer
    // exists. Delete + audit insert commit in the same transaction
    // (§15/§37): a failed audit write rolls back the deletion too.
    await prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id } });
      await writeAuditLog(
        {
          actor: actorFromSessionUser(session.user),
          action: "DOCUMENT_DELETED",
          entityType: "DOCUMENT",
          entityId: id,
          metadata: { documentTitle: existing.title, moderationStatus: existing.moderationStatus },
        },
        tx
      );
    });

    // FEAT-12A: physical cleanup runs AFTER the DB transaction commits —
    // best-effort, matching the same philosophy as upload's notification
    // step (a storage-layer hiccup here must never roll back an already-
    // committed deletion the caller has been told succeeded). Only ever
    // targets this exact document's own two keys (never a filename/pattern
    // match), so no unrelated file can be affected. `previewFileKey` is
    // only ever non-null for a PowerPoint document; every other category
    // simply has nothing extra to remove here.
    if (existing.fileKey) await deleteLocalFile(existing.fileKey);
    if (existing.previewFileKey) await deleteLocalFile(existing.previewFileKey);

    return apiSuccess({ id });
  } catch (error) {
    console.error(`DELETE /api/documents/${id} failed`, error);
    return apiErrorCode("FAILED_DELETE_DOCUMENT", 500);
  }
}
