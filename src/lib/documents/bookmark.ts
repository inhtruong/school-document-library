import "server-only";
import type { Document, Grade, Lesson, Subject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SAVED_PAGE_SIZE } from "@/lib/documents/bookmark-config";
import { APPROVED_DOCUMENT_WHERE } from "@/lib/documents/visibility";
import type { DocumentRecord } from "@/types/document";

type DocumentWithTaxonomy = Omit<Document, "fileKey" | "reviewedById" | "rejectionReason"> & {
  grade: Grade | null;
  subjectRef: Subject | null;
  lesson: Lesson | null;
};

function toDocumentRecord(document: DocumentWithTaxonomy): DocumentRecord {
  return {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function isBookmarked(documentId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;

  const bookmark = await prisma.documentBookmark.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: { id: true },
  });
  return bookmark !== null;
}

/** Idempotent — a repeat bookmark of the same Document by the same user never creates a second row. */
export async function addBookmark(documentId: string, userId: string): Promise<void> {
  await prisma.documentBookmark.upsert({
    where: { documentId_userId: { documentId, userId } },
    create: { documentId, userId },
    update: {},
  });
}

/** Safe on a missing bookmark — `deleteMany` matches zero rows instead of throwing. */
export async function removeBookmark(documentId: string, userId: string): Promise<void> {
  await prisma.documentBookmark.deleteMany({ where: { documentId, userId } });
}

export type SavedDocumentsPage = {
  documents: DocumentRecord[];
  total: number;
  page: number;
  totalPages: number;
};

/** Newest saved first (Bookmark.createdAt, not Document.createdAt), always capped at SAVED_PAGE_SIZE, scoped to exactly one user — never another user's saved list. */
export async function listUserBookmarks(userId: string, page: number): Promise<SavedDocumentsPage> {
  const skip = (page - 1) * SAVED_PAGE_SIZE;

  // A bookmarked document that later becomes non-APPROVED (a future
  // Admin action, not yet possible in FEAT-10A) must not remain exposed
  // through /saved to an unrelated user — filtered via the relation, not
  // fetched-then-filtered in JS.
  const where = { userId, document: APPROVED_DOCUMENT_WHERE };

  const [bookmarks, total] = await Promise.all([
    prisma.documentBookmark.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: SAVED_PAGE_SIZE,
      include: {
        document: {
          omit: { fileKey: true, reviewedById: true, rejectionReason: true },
          include: { grade: true, subjectRef: true, lesson: true },
        },
      },
    }),
    prisma.documentBookmark.count({ where }),
  ]);

  return {
    documents: bookmarks.map((bookmark) => toDocumentRecord(bookmark.document)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / SAVED_PAGE_SIZE)),
  };
}
