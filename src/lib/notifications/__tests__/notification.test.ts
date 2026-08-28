import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teacherFollow: { findMany: vi.fn() },
    lessonFollow: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    notification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/notifications/notification-config";
import {
  createDocumentPendingReviewNotifications,
  createModerationResultNotification,
  createNewDocumentNotifications,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/notification";

type NotificationCreateManyCall = {
  data: Array<{ userId: string; documentId: string; type: string; title: string; message: string }>;
  skipDuplicates: boolean;
};

const TEACHER_UPLOADER = { id: "teacher_1", name: "Tara Teacher", role: "TEACHER" as const };
const ADMIN_UPLOADER = { id: "admin_1", name: "Alan Admin", role: "ADMIN" as const };

const DOCUMENT_WITH_LESSON = {
  id: "doc_1",
  title: "Derivative Exercises",
  lessonId: "lesson_1",
  lesson: { name: "Derivatives" },
};

const DOCUMENT_NO_LESSON = {
  id: "doc_2",
  title: "General Notes",
  lessonId: null,
  lesson: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([]);
  vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([]);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 } as never);
});

describe("createNewDocumentNotifications — recipient calculation", () => {
  test("a Teacher follower is notified when the uploader is that Teacher", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data).toEqual([
      {
        userId: "student_1",
        documentId: "doc_1",
        type: "NEW_DOCUMENT",
        title: "New document available",
        message: 'Teacher Tara Teacher published "Derivative Exercises" for Derivatives.',
      },
    ]);
  });

  test("an unrelated user (not following the Teacher or the Lesson) receives no notification", async () => {
    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  test("a Lesson follower is notified", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([{ userId: "student_2" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data.map((row) => row.userId)).toEqual(["student_2"]);
  });

  test("a user following both the Teacher and the Lesson receives exactly ONE notification row", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_3" }] as never);
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([{ userId: "student_3" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data.filter((row) => row.userId === "student_3")).toHaveLength(1);
  });

  test("the uploader is excluded even when they follow their own Teacher profile and Lesson", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: TEACHER_UPLOADER.id }] as never);
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([{ userId: TEACHER_UPLOADER.id }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  test("an ADMIN upload never queries Teacher followers, but still notifies Lesson followers", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([{ userId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, ADMIN_UPLOADER);

    expect(prisma.teacherFollow.findMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data).toEqual([
      {
        userId: "student_1",
        documentId: "doc_1",
        type: "NEW_DOCUMENT",
        title: "New document available",
        message: 'A new document "Derivative Exercises" was added to Derivatives.',
      },
    ]);
  });

  test("a Document with no Lesson never queries Lesson followers; only Teacher followers are notified", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_NO_LESSON, TEACHER_UPLOADER);

    expect(prisma.lessonFollow.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  test("zero followers produces zero notification rows", async () => {
    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("createNewDocumentNotifications — idempotency", () => {
  test("always passes skipDuplicates so repeated generation for the same document never creates duplicate rows", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);
    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(prisma.notification.createMany).mock.calls) {
      expect((call[0] as NotificationCreateManyCall).skipDuplicates).toBe(true);
    }
  });
});

describe("createNewDocumentNotifications — null uploader (FEAT-10D §31, deleted-account case)", () => {
  test("skips Teacher-follower resolution entirely when uploader is null", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([{ userId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, null);

    expect(prisma.teacherFollow.findMany).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data.map((row) => row.userId)).toEqual(["student_1"]);
  });

  test("uses the generic (non-Teacher) message wording when uploader is null", async () => {
    vi.mocked(prisma.lessonFollow.findMany).mockResolvedValue([{ userId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, null);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data[0].message).toBe('A new document "Derivative Exercises" was added to Derivatives.');
  });

  test("a document with no Lesson and a null uploader produces zero recipients without crashing", async () => {
    await expect(createNewDocumentNotifications(DOCUMENT_NO_LESSON, null)).resolves.toBeUndefined();

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("createNewDocumentNotifications — Teacher-upload wording (FEAT-10D)", () => {
  test("uses 'published', not 'uploaded' — this only ever fires at actual publication (approval) time now", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data[0].message).toBe('Teacher Tara Teacher published "Derivative Exercises" for Derivatives.');
  });
});

describe("createNewDocumentNotifications — optional transaction client", () => {
  test("defaults to the module-level prisma client when no client is passed", async () => {
    vi.mocked(prisma.teacherFollow.findMany).mockResolvedValue([{ followerId: "student_1" }] as never);

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER);

    expect(prisma.teacherFollow.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  test("uses the passed client (e.g. a transaction handle) instead of the module-level prisma client", async () => {
    const txTeacherFollow = vi.fn().mockResolvedValue([{ followerId: "student_1" }]);
    const txNotificationCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const fakeTx = {
      teacherFollow: { findMany: txTeacherFollow },
      lessonFollow: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany: txNotificationCreateMany },
    } as never;

    await createNewDocumentNotifications(DOCUMENT_WITH_LESSON, TEACHER_UPLOADER, fakeTx);

    expect(txTeacherFollow).toHaveBeenCalledTimes(1);
    expect(txNotificationCreateMany).toHaveBeenCalledTimes(1);
    expect(prisma.teacherFollow.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("createDocumentPendingReviewNotifications — recipients", () => {
  const DOCUMENT = { id: "doc_1", title: "Derivative Exercises" };
  const UPLOADER = { id: "teacher_1", name: "Tara Teacher" };

  test("notifies every ADMIN user, not a follower list", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }, { id: "admin_2" }] as never);

    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER);

    expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { role: "ADMIN" }, select: { id: true } });
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data.map((row) => row.userId).sort()).toEqual(["admin_1", "admin_2"]);
    expect(call.data.every((row) => row.type === "DOCUMENT_PENDING_REVIEW")).toBe(true);
  });

  test("zero Admins produces zero notification rows, without erroring", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    await expect(createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER)).resolves.toBeUndefined();

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  test("excludes the uploader defensively, even if they somehow appear in the Admin list", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "teacher_1" }, { id: "admin_1" }] as never);

    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data.map((row) => row.userId)).toEqual(["admin_1"]);
  });

  test("always passes skipDuplicates", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }] as never);

    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.skipDuplicates).toBe(true);
  });
});

describe("createDocumentPendingReviewNotifications — repeat pending events (bug fix)", () => {
  const DOCUMENT = { id: "doc_1", title: "Derivative Exercises" };
  const UPLOADER = { id: "teacher_1", name: "Tara Teacher" };

  test("clears any previous pending-review notification for this document before creating the new one", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }] as never);

    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER, { isResubmit: true });

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { documentId: "doc_1", type: "DOCUMENT_PENDING_REVIEW" },
    });
    const deleteOrder = vi.mocked(prisma.notification.deleteMany).mock.invocationCallOrder[0];
    const createOrder = vi.mocked(prisma.notification.createMany).mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  test("a resubmit after a prior (already-read) upload notification still produces a fresh unread row — this is the exact bug reported live", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }] as never);

    // First event: fresh upload.
    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER, { isResubmit: false });
    // Second event, same document + same recipient: a resubmit after reject.
    // Without the deleteMany fix, skipDuplicates would silently drop this
    // second insert because a row for (admin_1, doc_1, DOCUMENT_PENDING_REVIEW)
    // already exists — reproducing the reported bug.
    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER, { isResubmit: true });

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2);
    expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(2);
  });
});

describe("createDocumentPendingReviewNotifications — content", () => {
  const DOCUMENT = { id: "doc_1", title: "Derivative Exercises" };
  const UPLOADER = { id: "teacher_1", name: "Tara Teacher" };

  test("a fresh upload says 'uploaded'", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }] as never);

    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data[0].message).toBe('Tara Teacher uploaded "Derivative Exercises" — it\'s waiting for your review.');
  });

  test("a resubmit says 'resubmitted', not 'uploaded'", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }] as never);

    await createDocumentPendingReviewNotifications(DOCUMENT, UPLOADER, { isResubmit: true });

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data[0].message).toBe('Tara Teacher resubmitted "Derivative Exercises" — it\'s waiting for your review.');
  });

  test("a null uploader (deleted account) still produces a sensible message", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "admin_1" }] as never);

    await createDocumentPendingReviewNotifications(DOCUMENT, null);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data[0].message).toBe('"Derivative Exercises" was uploaded and is waiting for your review.');
  });
});

describe("listNotifications", () => {
  test("orders newest first, caps take at NOTIFICATIONS_PAGE_SIZE, and computes skip from the page", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    await listNotifications("user_1", 2);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        orderBy: { createdAt: "desc" },
        skip: NOTIFICATIONS_PAGE_SIZE,
        take: NOTIFICATIONS_PAGE_SIZE,
      })
    );
  });

  test("is scoped to exactly one user", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    await listNotifications("user_1", 1);

    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "user_1" } });
  });

  test("returns unreadCount independent of the current page's total", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.count).mockImplementation(
      (args) => Promise.resolve(args?.where?.readAt === null ? 3 : 10) as never
    );

    const result = await listNotifications("user_1", 1);

    expect(result.unreadCount).toBe(3);
    expect(result.total).toBe(10);
  });
});

describe("getUnreadNotificationCount", () => {
  test("counts only unread (readAt = null) notifications for the given user", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(5);

    const result = await getUnreadNotificationCount("user_1");

    expect(result).toBe(5);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "user_1", readAt: null } });
  });
});

describe("markNotificationRead", () => {
  test("marks the caller's own unread notification as read", async () => {
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "n1",
      userId: "user_1",
      readAt: null,
    } as never);
    vi.mocked(prisma.notification.update).mockResolvedValue({} as never);

    const result = await markNotificationRead("n1", "user_1");

    expect(result).toEqual({ outcome: "marked" });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { readAt: expect.any(Date) },
    });
  });

  test("repeated mark-read on an already-read notification is a safe no-op", async () => {
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "n1",
      userId: "user_1",
      readAt: new Date("2026-01-01T00:00:00.000Z"),
    } as never);

    const result = await markNotificationRead("n1", "user_1");

    expect(result).toEqual({ outcome: "marked" });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  test("cannot mark another user's notification as read", async () => {
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "n1",
      userId: "user_2",
      readAt: null,
    } as never);

    const result = await markNotificationRead("n1", "user_1");

    expect(result).toEqual({ outcome: "not-found" });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  test("a missing notification is reported as not-found", async () => {
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

    const result = await markNotificationRead("does-not-exist", "user_1");

    expect(result).toEqual({ outcome: "not-found" });
  });
});

describe("markAllNotificationsRead", () => {
  test("marks all of the given user's unread notifications and returns the updated count", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 4 } as never);

    const result = await markAllNotificationsRead("user_1");

    expect(result).toBe(4);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  test("scopes the update to only the given user, never another user's notifications", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 } as never);

    await markAllNotificationsRead("user_1");

    const call = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as { where: { userId: string } };
    expect(call.where.userId).toBe("user_1");
  });
});

describe("createModerationResultNotification — content and recipient (FEAT-10F)", () => {
  const DOCUMENT = { id: "doc_1", title: "Derivative Exercises" };

  test("APPROVED: notifies only the uploader, correct type/title/message", async () => {
    await createModerationResultNotification(DOCUMENT, "teacher_1", "APPROVED");

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data).toEqual([
      {
        userId: "teacher_1",
        documentId: "doc_1",
        type: "DOCUMENT_APPROVED",
        title: "Document approved",
        message: 'Your document "Derivative Exercises" was approved.',
      },
    ]);
  });

  test("REJECTED: notifies only the uploader, correct type/title/message, no rejection reason embedded", async () => {
    await createModerationResultNotification(DOCUMENT, "teacher_1", "REJECTED");

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as NotificationCreateManyCall;
    expect(call.data).toEqual([
      {
        userId: "teacher_1",
        documentId: "doc_1",
        type: "DOCUMENT_REJECTED",
        title: "Document rejected",
        message:
          'Your document "Derivative Exercises" was rejected. View the reason and make changes before resubmitting.',
      },
    ]);
  });
});

describe("createModerationResultNotification — replacement semantics (FEAT-10F §15)", () => {
  const DOCUMENT = { id: "doc_1", title: "Derivative Exercises" };

  test("deletes any prior DOCUMENT_APPROVED or DOCUMENT_REJECTED for this uploader/document before creating the fresh one", async () => {
    await createModerationResultNotification(DOCUMENT, "teacher_1", "REJECTED");

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "teacher_1",
        documentId: "doc_1",
        type: { in: ["DOCUMENT_APPROVED", "DOCUMENT_REJECTED"] },
      },
    });
    const deleteOrder = vi.mocked(prisma.notification.deleteMany).mock.invocationCallOrder[0];
    const createOrder = vi.mocked(prisma.notification.createMany).mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  test("a re-approval after an earlier rejection still produces a fresh unread DOCUMENT_APPROVED — this is the current-result-inbox behavior, distinct from NEW_DOCUMENT's one-time semantics", async () => {
    await createModerationResultNotification(DOCUMENT, "teacher_1", "REJECTED");
    await createModerationResultNotification(DOCUMENT, "teacher_1", "APPROVED");

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2);
    expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(2);
    const lastCall = vi.mocked(prisma.notification.createMany).mock.calls[1][0] as NotificationCreateManyCall;
    expect(lastCall.data[0].type).toBe("DOCUMENT_APPROVED");
  });
});
