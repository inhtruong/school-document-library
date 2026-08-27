import "server-only";
import type { DocumentModerationStatus, FileCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODERATION_PAGE_SIZE } from "@/lib/moderation/moderation-config";
import { createNewDocumentNotifications } from "@/lib/notifications/notification";
import { rejectDocumentSchema } from "@/lib/validation/moderation";

const MODERATION_SELECT = {
  id: true,
  title: true,
  moderationStatus: true,
  documentType: true,
  academicYear: true,
  fileName: true,
  fileSize: true,
  fileCategory: true,
  createdAt: true,
  reviewedAt: true,
  uploadedBy: { select: { id: true, name: true, role: true } },
  grade: { select: { name: true } },
  subjectRef: { select: { name: true } },
  lesson: { select: { name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

export type ModerationListItem = {
  id: string;
  title: string;
  moderationStatus: DocumentModerationStatus;
  documentType: string;
  academicYear: string;
  fileName: string | null;
  fileSize: number | null;
  fileCategory: FileCategory | null;
  createdAt: string;
  reviewedAt: string | null;
  uploadedBy: { id: string; name: string; role: string } | null;
  grade: { name: string } | null;
  subjectRef: { name: string } | null;
  lesson: { name: string } | null;
  /** null either because it hasn't been reviewed yet, or the reviewer account was later deleted (SetNull) — UI must handle both the same way. */
  reviewedBy: { id: string; name: string } | null;
};

export type ModerationListPage = {
  documents: ModerationListItem[];
  total: number;
  page: number;
  totalPages: number;
};

function toListItem(row: {
  id: string;
  title: string;
  moderationStatus: DocumentModerationStatus;
  documentType: string;
  academicYear: string;
  fileName: string | null;
  fileSize: number | null;
  fileCategory: FileCategory | null;
  createdAt: Date;
  reviewedAt: Date | null;
  uploadedBy: { id: string; name: string; role: string } | null;
  grade: { name: string } | null;
  subjectRef: { name: string } | null;
  lesson: { name: string } | null;
  reviewedBy: { id: string; name: string } | null;
}): ModerationListItem {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}

/**
 * Internal ADMIN surface — intentionally does NOT use the public
 * APPROVED-only visibility helpers (FEAT-10A). Filters explicitly by the
 * requested status only, in SQL (never fetch-all-then-filter). PENDING
 * sorts oldest-first — a fair review queue, so the longest-waiting upload
 * is reviewed first; APPROVED/REJECTED sort by reviewedAt desc — a
 * decision history where the most recent review matters most. Never
 * selects fileKey (the internal storage path) — nothing in this UI needs
 * it directly; preview/download already resolve it server-side by id.
 */
export async function listModerationDocuments(
  status: DocumentModerationStatus,
  page: number
): Promise<ModerationListPage> {
  const skip = (page - 1) * MODERATION_PAGE_SIZE;
  const orderBy = status === "PENDING" ? { createdAt: "asc" as const } : { reviewedAt: "desc" as const };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where: { moderationStatus: status },
      orderBy,
      skip,
      take: MODERATION_PAGE_SIZE,
      select: MODERATION_SELECT,
    }),
    prisma.document.count({ where: { moderationStatus: status } }),
  ]);

  return {
    documents: rows.map(toListItem),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / MODERATION_PAGE_SIZE)),
  };
}

export type ModerationDocumentDetail = ModerationListItem & {
  description: string | null;
  mimeType: string | null;
  /** Internal moderation data — never exposed through any public API (FEAT-10A already omits it there; this type is only ever consumed by the Admin-only moderation pages). */
  rejectionReason: string | null;
};

/**
 * Admin-only detail lookup — intentionally accesses PENDING/APPROVED/
 * REJECTED alike, unlike the public `getDocumentById()`. A separate query
 * on purpose (per FEAT-10A's own established pattern of not overloading
 * the public/shared query function) rather than weakening that one.
 */
export async function getModerationDocumentById(id: string): Promise<ModerationDocumentDetail | null> {
  const row = await prisma.document.findUnique({
    where: { id },
    select: { ...MODERATION_SELECT, description: true, mimeType: true, rejectionReason: true },
  });
  if (!row) return null;

  return { ...toListItem(row), description: row.description, mimeType: row.mimeType, rejectionReason: row.rejectionReason };
}

export type ModerationActionResult =
  | { outcome: "success" }
  | { outcome: "not-found" }
  | { outcome: "not-pending" }
  | { outcome: "invalid"; error: string };

/**
 * Atomic conditional update, PLUS the approval-triggered NEW_DOCUMENT
 * notification side effect (FEAT-10D) — both run inside one
 * `prisma.$transaction`, so a failure creating notifications rolls back
 * the moderation-status transition too: a document can never end up
 * publicly APPROVED with its followers silently un-notified. The `where`
 * clause requires `moderationStatus: "PENDING"` in the SAME statement as
 * the transition, so two concurrent Admins can never both "win": at most
 * one `updateMany` call ever matches a row and sets count to 1 — and since
 * notification generation only ever runs after that transition succeeds
 * (never for the loser, which returns not-pending below), a retried or
 * concurrent approve can never create a second batch of notifications for
 * the same document (`createNewDocumentNotifications`'s own
 * `skipDuplicates` against the `(userId, documentId, type)` unique
 * constraint is a second, independent layer of the same guarantee).
 * `reviewerId` always comes from the caller's authenticated session, never
 * from client input. The follow-up `findUnique` on the failure path (OUTSIDE
 * the transaction, since there is nothing to roll back on that path) is
 * purely to produce a friendlier 404-vs-409 distinction for the caller — it
 * plays no role in the atomicity/correctness guarantee itself.
 */
export async function approveDocument(documentId: string, reviewerId: string): Promise<ModerationActionResult> {
  const transitioned = await prisma.$transaction(async (tx) => {
    const result = await tx.document.updateMany({
      where: { id: documentId, moderationStatus: "PENDING" },
      data: { moderationStatus: "APPROVED", reviewedAt: new Date(), reviewedById: reviewerId, rejectionReason: null },
    });
    if (result.count !== 1) return false;

    // FEAT-10D §31: uploadedBy may be null (the uploader's account was
    // later deleted, onDelete: SetNull) — createNewDocumentNotifications
    // already handles a null uploader gracefully (skips Teacher followers,
    // still notifies Lesson followers). This document is guaranteed to
    // exist here — we just updated it in this same transaction.
    const document = await tx.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        lessonId: true,
        lesson: { select: { name: true } },
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
    });
    if (!document) throw new Error(`Document ${documentId} vanished mid-transaction after a successful transition`);

    await createNewDocumentNotifications(document, document.uploadedBy, tx);
    return true;
  });

  if (transitioned) return { outcome: "success" };

  const existing = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true } });
  return existing ? { outcome: "not-pending" } : { outcome: "not-found" };
}

/** Same atomic conditional-update guarantee as approveDocument() — see its doc comment. */
export async function rejectDocument(
  documentId: string,
  reviewerId: string,
  input: unknown
): Promise<ModerationActionResult> {
  const parsed = rejectDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { outcome: "invalid", error: parsed.error.issues[0]?.message ?? "Invalid rejection reason" };
  }

  const result = await prisma.document.updateMany({
    where: { id: documentId, moderationStatus: "PENDING" },
    data: {
      moderationStatus: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: reviewerId,
      rejectionReason: parsed.data.reason,
    },
  });
  if (result.count === 1) return { outcome: "success" };

  const existing = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true } });
  return existing ? { outcome: "not-pending" } : { outcome: "not-found" };
}
