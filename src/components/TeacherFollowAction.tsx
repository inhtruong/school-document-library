"use client";

import { useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { loginHrefFor } from "@/lib/auth/document-login-href";
import { cn } from "@/lib/utils";

type TeacherFollowActionProps = {
  teacherId: string;
  isAuthenticated: boolean;
  /** True when the viewer IS this teacher — the action is hidden entirely, since self-follow is rejected server-side too. */
  isSelf: boolean;
  initialFollowing: boolean;
  /** Where a guest is sent to log in and returned to (the page this action is rendered on). */
  callbackPath: string;
};

// A compact pill — contextual, so lighter than the outline-Button pill
// BookmarkAction uses, but still never just a bare color change: text
// switches Follow/Following and the fill toggles between outline/solid icon.
function actionClassName(active: boolean): string {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-line text-muted hover:border-ink/20 hover:text-ink"
  );
}

/**
 * Guests get a plain link to `/login?callbackUrl=...` — nothing is ever
 * followed before login. Authenticated users get a toggle: click follows
 * or unfollows, then updates local state from the response — no
 * optimistic UI, matching Bookmark/Rating's pattern.
 */
export function TeacherFollowAction({
  teacherId,
  isAuthenticated,
  isSelf,
  initialFollowing,
  callbackPath,
}: TeacherFollowActionProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [submitting, setSubmitting] = useState(false);

  if (isSelf) return null;

  if (!isAuthenticated) {
    return (
      <a href={loginHrefFor(callbackPath)} className={actionClassName(false)}>
        <UserPlus className="h-3.5 w-3.5" aria-hidden />
        Follow
      </a>
    );
  }

  async function handleToggle() {
    if (submitting) return;
    const nextFollowing = !following;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/teachers/${teacherId}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update follow status");

      setFollowing(nextFollowing);
      toast.success(nextFollowing ? "Teacher followed" : "Teacher unfollowed");
    } catch {
      toast.error("Unable to update follow status");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={submitting}
      aria-pressed={following}
      className={actionClassName(following)}
    >
      {following ? <UserCheck className="h-3.5 w-3.5" aria-hidden /> : <UserPlus className="h-3.5 w-3.5" aria-hidden />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
