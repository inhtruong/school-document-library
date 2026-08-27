import "server-only";
import { NotificationType, Prisma, type Role } from "@prisma/client";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/notifications/notification-config";
import { prisma } from "@/lib/prisma";

export type NewDocumentNotificationDocument = {
  id: string;
  title: string;
  lessonId: string | null;
  lesson: { name: string } | null;
};

export type NewDocumentNotificationUploader = {
  id: string;
  name: string;
  role: Role;
};

function buildNewDocumentContent(
  document: NewDocumentNotificationDocument,
  uploader: NewDocumentNotificationUploader | null
): { title: string; message: string } {
  const title = "New document available";
  const lessonName = document.lesson?.name;
  const isTeacherUpload = uploader?.role === "TEACHER";

  if (isTeacherUpload) {
    // FEAT-10D: a Teacher's document is now only ever APPROVED via the
    // moderation approval transition (never at upload time — a Teacher
    // upload always starts PENDING), so this branch only ever fires at
    // actual publication time, which may be well after the original
    // upload. "published" is accurate here; "uploaded" would misleadingly
    // imply this just happened.
    const message = lessonName
      ? `Teacher ${uploader.name} published "${document.title}" for ${lessonName}.`
      : `Teacher ${uploader.name} published "${document.title}".`;
    return { title, message };
  }

  const message = lessonName
    ? `A new document "${document.title}" was added to ${lessonName}.`
    : `A new document "${document.title}" was added.`;
  return { title, message };
}

/**
 * The single source of NEW_DOCUMENT recipient resolution — called from two
 * places: `uploadDocument()` (an ADMIN's direct upload, already APPROVED at
 * creation) and `approveDocument()` (FEAT-10D: a TEACHER's upload becoming
 * APPROVED via moderation). Both call sites only invoke this once the
 * Document is already APPROVED — this function is never itself responsible
 * for visibility/publication, only for notifying about it.
 *
 * Recipients are the union of the uploader's Teacher followers (only when
 * the uploader is a TEACHER — Step 8B's rule that only TEACHER users are
 * followable Teacher targets; an ADMIN upload, or a document whose uploader
 * account was later deleted — `uploader: null`, FEAT-10D §31 — never
 * triggers this branch) and the Document's Lesson followers (only when the
 * Document has a structured Lesson). The uploader is always excluded, even
 * if they follow their own Teacher profile or Lesson. `skipDuplicates`
 * makes this idempotent against the `(userId, documentId, type)` unique
 * constraint — a user following both the Teacher and the Lesson still gets
 * only one row, and calling this twice for the same Document never
 * duplicates rows (this is what makes a retried/duplicate approval attempt
 * — which can never itself re-enter this function since the atomic
 * PENDING-only transition it's gated behind can only ever succeed once —
 * safe in the first place).
 *
 * `client` optionally accepts a Prisma transaction client so the caller can
 * run recipient resolution + notification insertion in the SAME atomic
 * transaction as the moderation-status transition (see `approveDocument()`)
 * — defaults to the module-level `prisma` singleton for the upload-time
 * call site, which has no such transaction to join.
 */
export async function createNewDocumentNotifications(
  document: NewDocumentNotificationDocument,
  uploader: NewDocumentNotificationUploader | null,
  client: Prisma.TransactionClient = prisma
): Promise<void> {
  const recipientIds = new Set<string>();

  if (uploader?.role === "TEACHER") {
    const teacherFollowers = await client.teacherFollow.findMany({
      where: { teacherId: uploader.id },
      select: { followerId: true },
    });
    for (const follow of teacherFollowers) recipientIds.add(follow.followerId);
  }

  if (document.lessonId) {
    const lessonFollowers = await client.lessonFollow.findMany({
      where: { lessonId: document.lessonId },
      select: { userId: true },
    });
    for (const follow of lessonFollowers) recipientIds.add(follow.userId);
  }

  if (uploader) recipientIds.delete(uploader.id);
  if (recipientIds.size === 0) return;

  const { title, message } = buildNewDocumentContent(document, uploader);

  await client.notification.createMany({
    data: Array.from(recipientIds).map((userId) => ({
      userId,
      documentId: document.id,
      type: NotificationType.NEW_DOCUMENT,
      title,
      message,
    })),
    skipDuplicates: true,
  });
}

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  documentId: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationsPage = {
  notifications: NotificationRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unreadCount: number;
};

/** Newest first, always capped at NOTIFICATIONS_PAGE_SIZE, scoped to exactly one user — never another user's notifications. */
export async function listNotifications(userId: string, page: number): Promise<NotificationsPage> {
  const skip = (page - 1) * NOTIFICATIONS_PAGE_SIZE;

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: NOTIFICATIONS_PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      documentId: row.documentId,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt ? row.readAt.toISOString() : null,
    })),
    total,
    page,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE)),
    unreadCount,
  };
}

/** Used by the header bell — never exposes another user's count. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export type MarkNotificationReadOutcome = { outcome: "marked" } | { outcome: "not-found" };

/**
 * Ownership-enforced — a notification that doesn't belong to `userId` (or
 * doesn't exist at all) is reported identically as "not-found", never
 * revealing whether it exists for someone else. Idempotent: marking an
 * already-read notification again is a safe no-op, not an error.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<MarkNotificationReadOutcome> {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true, readAt: true },
  });
  if (!existing || existing.userId !== userId) return { outcome: "not-found" };

  if (!existing.readAt) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }
  return { outcome: "marked" };
}

/** Only ever touches the current user's own unread notifications; returns how many rows were updated. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
