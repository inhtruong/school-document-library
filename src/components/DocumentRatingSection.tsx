"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { StarRating } from "@/components/StarRating";
import { documentLoginHref } from "@/lib/auth/document-login-href";
import type { RatingSummary } from "@/lib/documents/rating";

type DocumentRatingSectionProps = {
  documentId: string;
  isAuthenticated: boolean;
  initialSummary: RatingSummary;
};

/**
 * Guests get a read-only star cluster (rounded average) wrapped in a plain
 * link to `/login?callbackUrl=...` — clicking never submits anything before
 * login, it just navigates there, same as `DownloadButton`'s guest flow.
 * Authenticated users get real interactive stars that PUT straight to
 * `/api/documents/:id/rating`, then re-fetch the summary (the simplest
 * "submit → response → revalidate" approach, no optimistic-update/cache
 * library needed for this).
 */
export function DocumentRatingSection({ documentId, isAuthenticated, initialSummary }: DocumentRatingSectionProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [submitting, setSubmitting] = useState(false);
  const tRating = useTranslations("rating");
  const tToast = useTranslations("toast");
  const tErrors = useTranslations("errors.codes");

  async function handleRate(value: number) {
    if (submitting) return;
    setSubmitting(true);
    const hadPreviousRating = summary.currentUserRating !== null;

    try {
      const response = await fetch(`/api/documents/${documentId}/rating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to save rating");

      const summaryResponse = await fetch(`/api/documents/${documentId}/ratings`);
      const summaryBody = await summaryResponse.json();
      if (summaryResponse.ok && summaryBody.success) {
        setSummary(summaryBody.data as RatingSummary);
      }

      toast.success(hadPreviousRating ? tToast("ratingUpdated") : tToast("ratingSubmitted"));
    } catch {
      toast.error(tErrors("unableSaveRating"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{tRating("ratingSummary")}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">
            {summary.averageRating === null ? tRating("noRatingsYet") : summary.averageRating.toFixed(1)}
          </span>
          <StarRating value={Math.round(summary.averageRating ?? 0)} size="sm" />
        </div>
        <p className="mt-1 text-sm text-muted">{tRating("ratingCount", { count: summary.ratingCount })}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{tRating("yourRating")}</p>
        <div className="mt-1.5">
          {isAuthenticated ? (
            <StarRating value={summary.currentUserRating ?? 0} onRate={handleRate} disabled={submitting} />
          ) : (
            <a
              href={documentLoginHref(documentId)}
              className="text-sm font-medium text-accent underline-offset-2 hover:underline"
            >
              {tRating("loginToRate")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
