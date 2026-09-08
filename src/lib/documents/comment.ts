import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuditActor } from "@/lib/audit/audit";
import { writeAuditLog } from "@/lib/audit/audit";
import { COMMENTS_PAGE_SIZE } from "@/lib/documents/comment-config";

export type CommentAuthor = { id: string; name: string; role: "STUDENT" | "TEACHER" | "ADMIN" };

export type DocumentCommentPayload = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthor;
};

/**
 * Shared Prisma select shape for every comment read/write — only ever
 * exposes the author's id/name/role, never email or passwordHash.
 */
export const COMMENT_SELECT = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, role: true } },
} as const;

type CommentRow = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: CommentAuthor;
};

/** Renames the Prisma `user` relation to `author` in the API-facing shape. */
export function toCommentPayload(row: CommentRow): DocumentCommentPayload {
  const { user, ...rest } = row;
  return { ...rest, author: user };
}

export type CommentsPageResult = {
  comments: DocumentCommentPayload[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * Newest-first, always capped at COMMENTS_PAGE_SIZE — never an unbounded
 * query, and the total comes from a DB `count()`, never `.length` on a
 * partial page. `$transaction([...])` runs both reads over one connection
 * instead of two — see the same reasoning in `getRatingSummary()`.
 */
export async function listComments(documentId: string, page: number): Promise<CommentsPageResult> {
  const skip = (page - 1) * COMMENTS_PAGE_SIZE;

  const [rows, total] = await prisma.$transaction([
    prisma.documentComment.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      skip,
      take: COMMENTS_PAGE_SIZE,
      select: COMMENT_SELECT,
    }),
    prisma.documentComment.count({ where: { documentId } }),
  ]);

  return {
    comments: rows.map(toCommentPayload),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / COMMENTS_PAGE_SIZE)),
  };
}

/** `actor` is optional only so existing tests that don't care about auditing keep compiling (matches `uploadDocument`'s established convention) — the real caller always passes it. */
export async function createComment(
  documentId: string,
  userId: string,
  content: string,
  actor?: AuditActor
): Promise<DocumentCommentPayload> {
  const row = await prisma.documentComment.create({
    data: { documentId, userId, content },
    select: COMMENT_SELECT,
  });

  // Best-effort (FEAT-11 §22/§37) — comments are a SHOULD-tier action, not
  // wrapped in a transaction with the create above.
  if (actor) {
    try {
      await writeAuditLog({
        actor,
        action: "COMMENT_CREATED",
        entityType: "COMMENT",
        entityId: row.id,
        metadata: { documentId },
      });
    } catch (error) {
      console.error("Audit log write failed for COMMENT_CREATED", error);
    }
  }

  return toCommentPayload(row);
}
