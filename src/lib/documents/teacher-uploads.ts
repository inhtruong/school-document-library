import "server-only";
import type { DocumentModerationStatus, FileCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TEACHER_UPLOADS_PAGE_SIZE } from "@/lib/documents/teacher-uploads-config";

export type TeacherUploadStatusFilter = "ALL" | DocumentModerationStatus;

const TEACHER_UPLOAD_SELECT = {
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
  // Own-document rejection reason — safe here ONLY because every row this
  // query returns is already scoped to `uploadedById: uploaderId` (see
  // listTeacherUploads below). Never reuse this select for a public/shared
  // document lookup — FEAT-10A's omission of rejectionReason from the
  // public API/detail query must stay intact.
  rejectionReason: true,
  grade: { select: { name: true } },
  subjectRef: { select: { name: true } },
  lesson: { select: { name: true } },
} as const;

export type TeacherUploadListItem = {
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
  rejectionReason: string | null;
  grade: { name: string } | null;
  subjectRef: { name: string } | null;
  lesson: { name: string } | null;
};

export type TeacherUploadsPage = {
  documents: TeacherUploadListItem[];
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
  rejectionReason: string | null;
  grade: { name: string } | null;
  subjectRef: { name: string } | null;
  lesson: { name: string } | null;
}): TeacherUploadListItem {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}

/**
 * A Teacher's own uploads, always scoped by `uploadedById` — the caller
 * must pass the authenticated session's own user id, never a client-
 * supplied id, so a Teacher can never see another Teacher's uploads even
 * by editing the URL. Sorted newest-upload-first regardless of filter
 * (unlike the Admin moderation queue's status-dependent fairness sort —
 * this is a personal list, not a review queue, so "most recent" is the
 * natural default). One paginated query + one count, taxonomy resolved via
 * the same select (no N+1).
 */
export async function listTeacherUploads(
  uploaderId: string,
  filter: TeacherUploadStatusFilter,
  page: number
): Promise<TeacherUploadsPage> {
  const where = filter === "ALL" ? { uploadedById: uploaderId } : { uploadedById: uploaderId, moderationStatus: filter };
  const skip = (page - 1) * TEACHER_UPLOADS_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: TEACHER_UPLOADS_PAGE_SIZE,
      select: TEACHER_UPLOAD_SELECT,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents: rows.map(toListItem),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / TEACHER_UPLOADS_PAGE_SIZE)),
  };
}

/**
 * Owner-safe rejection-reason lookup for the public document detail page
 * (`/documents/[id]`). Callers MUST already have verified the requester is
 * the document's owner or an ADMIN (see isDocumentVisibleTo) before calling
 * this — the function itself performs no authorization, matching
 * getModerationDocumentById's established contract. Never called from a
 * public API route; FEAT-10A's omission of rejectionReason there is
 * unaffected.
 */
export async function getRejectionReasonForViewer(documentId: string): Promise<string | null> {
  const row = await prisma.document.findUnique({ where: { id: documentId }, select: { rejectionReason: true } });
  return row?.rejectionReason ?? null;
}

export type ResubmitResult =
  | { outcome: "success" }
  | { outcome: "not-found" }
  | { outcome: "forbidden" }
  | { outcome: "not-rejected" };

/**
 * REJECTED → PENDING, the only transition FEAT-10C adds. Same atomic
 * conditional-update guarantee as FEAT-10B's approveDocument/rejectDocument:
 * the `where` clause requires `uploadedById` AND `moderationStatus:
 * "REJECTED"` in the SAME statement as the transition, so exactly one
 * concurrent resubmit attempt can ever win. `uploaderId` always comes from
 * the caller's authenticated session, never from client input — there is no
 * "resubmit on someone else's behalf" path, not even for ADMIN. The
 * follow-up `findUnique` on the failure path exists only to distinguish
 * not-found vs forbidden vs not-rejected for a friendlier error — it plays
 * no role in the atomicity guarantee itself.
 */
export async function resubmitDocument(uploaderId: string, documentId: string): Promise<ResubmitResult> {
  const result = await prisma.document.updateMany({
    where: { id: documentId, uploadedById: uploaderId, moderationStatus: "REJECTED" },
    data: { moderationStatus: "PENDING", reviewedAt: null, reviewedById: null, rejectionReason: null },
  });
  if (result.count === 1) return { outcome: "success" };

  const existing = await prisma.document.findUnique({
    where: { id: documentId },
    select: { uploadedById: true, moderationStatus: true },
  });
  if (!existing) return { outcome: "not-found" };
  if (existing.uploadedById !== uploaderId) return { outcome: "forbidden" };
  return { outcome: "not-rejected" };
}
