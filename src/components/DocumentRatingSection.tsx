"use client";

import { useState } from "react";
import { toast } from "sonner";
import { StarRating } from "@/components/StarRating";
import { documentLoginHref } from "@/lib/auth/document-login-href";
import type { RatingSummary } from "@/lib/documents/rating";

type DocumentRatingSectionProps = {
  documentId: string;
  isAuthenticated: boolean;
  initialSummary: RatingSummary;
};

function formatAverage(averageRating: number | null): string {
  return averageRating === null ? "No ratings yet" : averageRating.toFixed(1);
}

function formatCount(ratingCount: number): string {
  return `${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}`;
}

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

      toast.success(hadPreviousRating ? "Rating updated successfully" : "Rating submitted successfully");
    } catch {
      toast.error("Unable to save your rating.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Rating summary</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">
            {formatAverage(summary.averageRating)}
          </span>
          <StarRating value={Math.round(summary.averageRating ?? 0)} size="sm" />
        </div>
        <p className="mt-1 text-sm text-muted">{formatCount(summary.ratingCount)}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Your rating</p>
        <div className="mt-1.5">
          {isAuthenticated ? (
            <StarRating value={summary.currentUserRating ?? 0} onRate={handleRate} disabled={submitting} />
          ) : (
            <a
              href={documentLoginHref(documentId)}
              className="text-sm font-medium text-accent underline-offset-2 hover:underline"
            >
              Log in to rate
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
