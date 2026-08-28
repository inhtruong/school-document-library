"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { NotificationItem } from "@/components/NotificationItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationRecord } from "@/lib/notifications/notification";

type NotificationBellProps = {
  initialNotifications: NotificationRecord[];
  initialUnreadCount: number;
};

/**
 * Header bell trigger + popover preview (most-recent 5), replacing the old
 * plain link-to-/notifications button. Keeps its own small local copy of
 * read/unread state — same pattern as NotificationsList, not shared with it,
 * since the two only overlap on ~15 lines of straightforward state logic and
 * this component's data is a capped preview rather than a paginated list.
 * `setOpen(false)` on every notification click and on "View all" is what
 * actually closes the popover: SiteHeader is a Server Component that never
 * remounts across client-side navigation, so Radix's own outside-click/Link
 * behavior alone wouldn't dismiss it on a same-page click-through.
 */
export function NotificationBell({ initialNotifications, initialUnreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
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
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Unable to update notifications");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-ink outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium leading-none text-paper">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <span className="text-sm font-semibold text-ink">Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={markingAll}
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-accent outline-none transition-colors hover:text-accent-strong focus-visible:underline disabled:opacity-50"
            >
              Mark all as read
            </button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="h-5 w-5 text-muted" aria-hidden />
            <p className="text-sm text-muted">You&apos;re all caught up.</p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleItemRead}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ul>
        )}

        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-accent outline-none transition-colors hover:bg-surface hover:text-accent-strong focus-visible:bg-surface"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
