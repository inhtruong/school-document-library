"use client";

import { useState } from "react";
import { Bell, BellPlus } from "lucide-react";
import { toast } from "sonner";
import { loginHrefFor } from "@/lib/auth/document-login-href";

type LessonFollowActionProps = {
  lessonId: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  /** Where a guest is sent to log in and returned to (the page this action is rendered on). */
  callbackPath: string;
};

const actionClassName =
  "inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Same guest-link / authenticated-toggle pattern as
 * `TeacherFollowAction`/`BookmarkAction`. Only ever rendered by the caller
 * when the Document has a structured Lesson — legacy Documents with no
 * Lesson relation never get this action at all.
 */
export function LessonFollowAction({ lessonId, isAuthenticated, initialFollowing, callbackPath }: LessonFollowActionProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthenticated) {
    return (
      <a href={loginHrefFor(callbackPath)} className={actionClassName}>
        <BellPlus className="h-4 w-4" aria-hidden />
        Follow lesson
      </a>
    );
  }

  async function handleToggle() {
    if (submitting) return;
    const nextFollowing = !following;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/lessons/${lessonId}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update follow status");

      setFollowing(nextFollowing);
      toast.success(nextFollowing ? "Lesson followed" : "Lesson unfollowed");
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
      className={actionClassName}
    >
      {following ? <Bell className="h-4 w-4 fill-current" aria-hidden /> : <BellPlus className="h-4 w-4" aria-hidden />}
      {following ? "Following" : "Follow lesson"}
    </button>
  );
}
