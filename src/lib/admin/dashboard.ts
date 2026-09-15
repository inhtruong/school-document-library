import "server-only";
import type { AuditAction, AuditEntityType, DocumentModerationStatus, FileCategory, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RECENT_PENDING_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 10;

export type ModerationCounts = { approved: number; pending: number; rejected: number };
export type RoleCounts = { students: number; teachers: number; admins: number };
/** `youtube` is a separate bucket, not a `FileCategory` value — a YOUTUBE-sourced Document has `fileCategory: null` (see Document's schema comment on `sourceType`). */
export type FileTypeCounts = Record<FileCategory, number> & { youtube: number };

export type PendingAttentionItem = {
  id: string;
  title: string;
  createdAt: string;
  uploaderName: string | null;
  /** Grade/Subject/Lesson joined with " · ", or null when none apply (legacy or untagged document). */
  taxonomySummary: string | null;
};

export type RecentActivityItem = {
  id: string;
  action: AuditAction;
  actorEmail: string | null;
  entityType: AuditEntityType | null;
  createdAt: string;
};

export type AdminDashboardData = {
  documents: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    byFileType: FileTypeCounts;
  };
  users: {
    total: number;
    students: number;
    teachers: number;
    admins: number;
  };
  openReportCount: number;
  pendingAttention: PendingAttentionItem[];
  recentActivity: RecentActivityItem[];
};

function moderationStatusCounts(groups: { moderationStatus: DocumentModerationStatus; _count: number }[]): ModerationCounts {
  const counts: ModerationCounts = { approved: 0, pending: 0, rejected: 0 };
  for (const group of groups) {
    if (group.moderationStatus === "APPROVED") counts.approved = group._count;
    else if (group.moderationStatus === "PENDING") counts.pending = group._count;
    else if (group.moderationStatus === "REJECTED") counts.rejected = group._count;
  }
  return counts;
}

function roleCountsFrom(groups: { role: Role; _count: number }[]): RoleCounts {
  const counts: RoleCounts = { students: 0, teachers: 0, admins: 0 };
  for (const group of groups) {
    if (group.role === "STUDENT") counts.students = group._count;
    else if (group.role === "TEACHER") counts.teachers = group._count;
    else if (group.role === "ADMIN") counts.admins = group._count;
  }
  return counts;
}

function fileTypeCountsFrom(groups: { fileCategory: FileCategory | null; _count: number }[]): FileTypeCounts {
  const counts: FileTypeCounts = { PDF: 0, WORD: 0, EXCEL: 0, IMAGE: 0, VIDEO: 0, POWERPOINT: 0, youtube: 0 };
  for (const group of groups) {
    if (group.fileCategory === null) counts.youtube = group._count;
    else counts[group.fileCategory] = group._count;
  }
  return counts;
}

function taxonomySummaryFor(doc: {
  grade: { name: string } | null;
  subjectRef: { name: string } | null;
  lesson: { name: string } | null;
}): string | null {
  const parts = [doc.grade?.name, doc.subjectRef?.name, doc.lesson?.name].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * FEAT-15A: one call, six Prisma queries run in parallel (two `groupBy`s
 * covering all document/user counts — no separate `count()` needed since a
 * group's total is just the sum of its buckets — plus one more `count`
 * and two capped `findMany`s for the two small "recent" lists). Never
 * fetches full document/user/audit tables, never N+1s a per-row lookup.
 */
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [moderationGroups, fileTypeGroups, roleGroups, openReportCount, pendingRows, activityRows] = await Promise.all([
    prisma.document.groupBy({ by: ["moderationStatus"], _count: true }),
    prisma.document.groupBy({ by: ["fileCategory"], _count: true }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.documentReport.count({ where: { status: "OPEN" } }),
    prisma.document.findMany({
      where: { moderationStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: RECENT_PENDING_LIMIT,
      select: {
        id: true,
        title: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
        grade: { select: { name: true } },
        subjectRef: { select: { name: true } },
        lesson: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
      select: { id: true, action: true, actorEmail: true, entityType: true, createdAt: true },
    }),
  ]);

  const moderationCounts = moderationStatusCounts(moderationGroups);
  const roleCounts = roleCountsFrom(roleGroups);

  return {
    documents: {
      total: moderationCounts.approved + moderationCounts.pending + moderationCounts.rejected,
      ...moderationCounts,
      byFileType: fileTypeCountsFrom(fileTypeGroups),
    },
    users: {
      total: roleCounts.students + roleCounts.teachers + roleCounts.admins,
      ...roleCounts,
    },
    openReportCount,
    pendingAttention: pendingRows.map((doc) => ({
      id: doc.id,
      title: doc.title,
      createdAt: doc.createdAt.toISOString(),
      uploaderName: doc.uploadedBy?.name ?? null,
      taxonomySummary: taxonomySummaryFor(doc),
    })),
    recentActivity: activityRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  };
}
