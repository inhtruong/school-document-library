"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { documentLoginHref } from "@/lib/auth/document-login-href";

type BookmarkActionProps = {
  documentId: string;
  isAuthenticated: boolean;
  initialBookmarked: boolean;
};

const actionClassName =
  "inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Guests get a plain link to `/login?callbackUrl=...` (same
 * `documentLoginHref()` helper Download/Rating/Comments/Reports use) —
 * nothing is ever saved before login. Authenticated users get a toggle:
 * click saves or removes, then updates local state from the response —
 * no optimistic UI, matching this app's other lightweight interactions.
 */
export function BookmarkAction({ documentId, isAuthenticated, initialBookmarked }: BookmarkActionProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthenticated) {
    return (
      <a href={documentLoginHref(documentId)} className={actionClassName}>
        <Heart className="h-4 w-4" aria-hidden />
        Save document
      </a>
    );
  }

  async function handleToggle() {
    if (submitting) return;
    const nextBookmarked = !bookmarked;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/bookmark`, {
        method: nextBookmarked ? "POST" : "DELETE",
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update saved document");

      setBookmarked(nextBookmarked);
      toast.success(nextBookmarked ? "Document saved" : "Document removed from saved items");
    } catch {
      toast.error("Unable to update saved document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={submitting}
      aria-pressed={bookmarked}
      className={actionClassName}
    >
      <Heart className={`h-4 w-4 ${bookmarked ? "fill-red-500 text-red-500" : ""}`} aria-hidden />
      {bookmarked ? "Saved" : "Save document"}
    </button>
  );
}
