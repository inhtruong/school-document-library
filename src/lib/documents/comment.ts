import "server-only";
import { prisma } from "@/lib/prisma";
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

/** Newest-first, always capped at COMMENTS_PAGE_SIZE — never an unbounded query, and the total comes from a DB `count()`, never `.length` on a partial page. */
export async function listComments(documentId: string, page: number): Promise<CommentsPageResult> {
  const skip = (page - 1) * COMMENTS_PAGE_SIZE;

  const [rows, total] = await Promise.all([
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

export async function createComment(
  documentId: string,
  userId: string,
  content: string
): Promise<DocumentCommentPayload> {
  const row = await prisma.documentComment.create({
    data: { documentId, userId, content },
    select: COMMENT_SELECT,
  });
  return toCommentPayload(row);
}
