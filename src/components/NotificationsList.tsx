"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NotificationItem } from "@/components/NotificationItem";
import { Button } from "@/components/ui/button";
import type { NotificationRecord } from "@/lib/notifications/notification";

type NotificationsListProps = {
  initialNotifications: NotificationRecord[];
  initialUnreadCount: number;
};

/**
 * `/notifications` always renders this only for the signed-in user's own
 * list (the page itself redirects guests away first), so there's no guest
 * branch here. `router.refresh()` after "Mark all as read" keeps the
 * (server-rendered) header bell count in sync without any global client
 * state — matching the fire-and-forget refresh pattern used by
 * `NotificationItem`.
 */
export function NotificationsList({ initialNotifications, initialUnreadCount }: NotificationsListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markingAll, setMarkingAll] = useState(false);

  function handleItemRead(id: string) {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id && !notification.readAt
          ? { ...notification, readAt: new Date().toISOString() }
          : notification
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);

    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update notifications");

      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((notification) => (notification.readAt ? notification : { ...notification, readAt: now }))
      );
      setUnreadCount(0);
      router.refresh();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Unable to update notifications");
    } finally {
      setMarkingAll(false);
    }
  }

  if (notifications.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted">
        You don&apos;t have any notifications yet. Follow a teacher or lesson to get notified about new
        documents.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {unreadCount > 0 ? (
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={markingAll} onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        </div>
      ) : null}

      <ul className="divide-y divide-line rounded-xl border border-line">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onRead={handleItemRead} />
        ))}
      </ul>
    </div>
  );
}
