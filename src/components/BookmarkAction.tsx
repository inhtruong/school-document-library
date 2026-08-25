"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { documentLoginHref } from "@/lib/auth/document-login-href";
import { cn } from "@/lib/utils";

type BookmarkActionProps = {
  documentId: string;
  isAuthenticated: boolean;
  initialBookmarked: boolean;
};

// Same visual weight as Button's "outline" variant (secondary action —
// reuses the shared primitive's styling via buttonVariants rather than a
// second hand-rolled button style) — a saved state additionally tints the
// border/background so it's never signaled by icon fill color alone.
function actionClassName(active: boolean): string {
  return cn(
    buttonVariants({ variant: "outline" }),
    "w-full",
    active && "border-accent bg-accent-soft text-accent hover:bg-accent-soft"
  );
}

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
      <a href={documentLoginHref(documentId)} className={actionClassName(false)}>
        <Heart className="h-4 w-4" aria-hidden />
        Save
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
      className={actionClassName(bookmarked)}
    >
      <Heart className={cn("h-4 w-4", bookmarked && "fill-accent text-accent")} aria-hidden />
      {bookmarked ? "Saved" : "Save"}
    </button>
  );
}
