"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NotificationRecord } from "@/lib/notifications/notification";

type NotificationItemProps = {
  notification: NotificationRecord;
  onRead: (id: string) => void;
};

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Clicking navigates to the linked Document via the normal `<Link>`
 * navigation; if the notification is still unread, this also fires a
 * fire-and-forget mark-as-read request and calls `router.refresh()` so the
 * (server-rendered) header bell count is fresh on the next render. No
 * global notification state — the parent list's local state and the
 * header's own server-side query are the only two sources of truth.
 */
export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter();
  const isUnread = notification.readAt === null;

  function handleClick() {
    if (!isUnread) return;
    onRead(notification.id);
    fetch(`/api/notifications/${notification.id}/read`, { method: "PATCH" }).catch(() => {});
    router.refresh();
  }

  return (
    <li>
      <Link
        href={`/documents/${notification.documentId}`}
        onClick={handleClick}
        className={`flex items-start gap-2 px-3 py-3 transition-colors hover:bg-surface ${
          isUnread ? "bg-accent/5" : ""
        }`}
      >
        <span
          aria-hidden
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isUnread ? "bg-accent" : "bg-transparent"}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${isUnread ? "font-semibold text-ink" : "font-medium text-ink"}`}>
            {notification.title}
          </p>
          <p className="mt-0.5 text-sm text-muted">{notification.message}</p>
          <p className="mt-1 text-xs text-muted">{formatNotificationDate(notification.createdAt)}</p>
        </div>
      </Link>
    </li>
  );
}
