"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { documentLoginHref } from "@/lib/auth/document-login-href";
import { cn } from "@/lib/utils";

type BookmarkActionProps = {
  documentId: string;
  isAuthenticated: boolean;
  initialBookmarked: boolean;
  /**
   * UI-7A: compact icon-only treatment for card grids (search results) —
   * same toggle/fetch/toast/state logic below, just a smaller square
   * button instead of the full-width text+icon button used on the
   * document detail page. Defaults to `false` so the existing document
   * detail page call site (the only one before this task) renders
   * byte-identical to before.
   */
  compact?: boolean;
};

// Same visual weight as Button's "outline" variant (secondary action —
// reuses the shared primitive's styling via buttonVariants rather than a
// second hand-rolled button style) — a saved state additionally tints the
// border/background so it's never signaled by icon fill color alone.
function actionClassName(active: boolean, compact: boolean): string {
  return cn(
    buttonVariants({ variant: "outline", size: compact ? "sm" : "default" }),
    compact ? "px-2.5" : "w-full",
    active && "border-accent bg-accent-soft text-accent-strong hover:bg-accent-soft"
  );
}

/**
 * Guests get a plain link to `/login?callbackUrl=...` (same
 * `documentLoginHref()` helper Download/Rating/Comments/Reports use) —
 * nothing is ever saved before login. Authenticated users get a toggle:
 * click saves or removes, then updates local state from the response —
 * no optimistic UI, matching this app's other lightweight interactions.
 */
export function BookmarkAction({ documentId, isAuthenticated, initialBookmarked, compact = false }: BookmarkActionProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [submitting, setSubmitting] = useState(false);
  const tDocumentActions = useTranslations("documentActions");
  const tToast = useTranslations("toast");
  const tErrors = useTranslations("errors.codes");

  const label = bookmarked ? tDocumentActions("saved") : tDocumentActions("save");

  if (!isAuthenticated) {
    return (
      <a
        href={documentLoginHref(documentId)}
        className={actionClassName(false, compact)}
        aria-label={compact ? label : undefined}
      >
        <Heart className="h-4 w-4" aria-hidden />
        {compact ? null : label}
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
      toast.success(nextBookmarked ? tToast("documentSaved") : tToast("documentRemovedFromSaved"));
    } catch {
      toast.error(tErrors("unableUpdateSavedDocument"));
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
      aria-label={compact ? label : undefined}
      className={actionClassName(bookmarked, compact)}
    >
      <Heart className={cn("h-4 w-4", bookmarked && "fill-accent text-accent")} aria-hidden />
      {compact ? null : label}
    </button>
  );
}
