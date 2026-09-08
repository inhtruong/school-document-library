import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { actorFromSessionUser, writeAuditLog } from "@/lib/audit/audit";
import { COMMENT_SELECT, toCommentPayload } from "@/lib/documents/comment";
import { prisma } from "@/lib/prisma";
import { commentContentSchema } from "@/lib/validation/comment";

/** Best-effort (FEAT-11 §22/§37) — a transient audit-write hiccup must never fail an already-successful comment edit/delete. */
async function auditComment(
  action: "COMMENT_UPDATED" | "COMMENT_DELETED",
  commentId: string,
  documentId: string,
  session: Session
) {
  try {
    await writeAuditLog({
      actor: actorFromSessionUser(session.user),
      action,
      entityType: "COMMENT",
      entityId: commentId,
      metadata: { documentId },
    });
  } catch (error) {
    console.error(`Audit log write failed for ${action}`, error);
  }
}

type RouteContext = { params: Promise<{ id: string; commentId: string }> };

/**
 * Only the comment's own author may edit it — even ADMIN cannot edit
 * someone else's comment (moderation uses delete, not impersonated
 * editing). `existing.documentId !== documentId` (comment belongs to a
 * different Document than the route used) is treated the same as
 * not-found, not a separate error, so no route leaks cross-Document
 * comment existence.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id: documentId, commentId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }

  const parsed = commentContentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid comment", 400);
  }

  try {
    const existing = await prisma.documentComment.findUnique({ where: { id: commentId } });
    if (!existing || existing.documentId !== documentId) return apiError("Comment not found", 404);
    if (existing.userId !== session.user.id) return apiError("You can only edit your own comment", 403);

    const updated = await prisma.documentComment.update({
      where: { id: commentId },
      data: { content: parsed.data.content },
      select: COMMENT_SELECT,
    });

    await auditComment("COMMENT_UPDATED", commentId, documentId, session);
    return apiSuccess(toCommentPayload(updated));
  } catch (error) {
    console.error(`PUT /api/documents/${documentId}/comments/${commentId} failed`, error);
    return apiError("Failed to update comment", 500);
  }
}

/** Owner may delete their own comment; ADMIN may delete any comment. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id: documentId, commentId } = await params;

  const session = await auth();
  if (!session?.user) return apiError("Authentication required", 401);

  try {
    const existing = await prisma.documentComment.findUnique({ where: { id: commentId } });
    if (!existing || existing.documentId !== documentId) return apiError("Comment not found", 404);

    const isOwner = existing.userId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    if (!isOwner && !isAdmin) return apiError("You can only delete your own comment", 403);

    await prisma.documentComment.delete({ where: { id: commentId } });
    await auditComment("COMMENT_DELETED", commentId, documentId, session);
    return apiSuccess({ id: commentId });
  } catch (error) {
    console.error(`DELETE /api/documents/${documentId}/comments/${commentId} failed`, error);
    return apiError("Failed to delete comment", 500);
  }
}
