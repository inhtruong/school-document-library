"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { documentLoginHref } from "@/lib/auth/document-login-href";
import { REPORT_DESCRIPTION_MAX_LENGTH } from "@/lib/documents/report-config";
import { REPORT_REASON_LABELS, REPORT_REASON_VALUES, type ReportReasonValue } from "@/lib/documents/report-reason";

type ReportDocumentActionProps = {
  documentId: string;
  isAuthenticated: boolean;
};

const selectClassName =
  "h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";
const textareaClassName =
  "w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";
const linkClassName = "text-xs text-muted underline underline-offset-2 transition-colors hover:text-ink";

/**
 * A small, secondary action — styled as a plain text link, not a Button,
 * so it never competes visually with Preview/Download. Guests get a plain
 * link to `/login?callbackUrl=...` (the same `documentLoginHref()` helper
 * Download/Rating/Comments use) — nothing is ever submitted before login.
 * Authenticated users get an inline expandable form (no modal/dialog
 * dependency, matching the rest of this app's hand-rolled shadcn-style
 * primitives) rather than a separate dialog component.
 */
export function ReportDocumentAction({ documentId, isAuthenticated }: ReportDocumentActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReasonValue | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reportedReasons, setReportedReasons] = useState<Set<ReportReasonValue>>(new Set());
  const [loadedReportedReasons, setLoadedReportedReasons] = useState(false);

  async function openForm() {
    setIsOpen(true);
    if (loadedReportedReasons) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/reports/mine`);
      const body = await response.json();
      if (response.ok && body.success) {
        setReportedReasons(new Set(body.data.reportedReasons as ReportReasonValue[]));
      }
    } catch {
      // Non-critical — the form still works without this "already reported" hint.
    } finally {
      setLoadedReportedReasons(true);
    }
  }

  function closeForm() {
    setIsOpen(false);
    setReason("");
    setDescription("");
  }

  const trimmedDescription = description.trim();
  const requiresDescription = reason === "OTHER";
  const canSubmit =
    reason !== "" &&
    (!requiresDescription || trimmedDescription.length > 0) &&
    description.length <= REPORT_DESCRIPTION_MAX_LENGTH &&
    !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description: trimmedDescription || undefined }),
      });

      if (response.status === 409) {
        toast.error("You have already reported this issue");
        setReportedReasons((prev) => new Set(prev).add(reason));
        return;
      }

      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to submit report");

      setReportedReasons((prev) => new Set(prev).add(reason));
      toast.success("Report submitted successfully");
      closeForm();
    } catch {
      toast.error("Unable to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <a href={documentLoginHref(documentId)} className={linkClassName}>
        Report document
      </a>
    );
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={openForm} className={linkClassName}>
        Report document
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex max-w-sm flex-col gap-2 rounded-lg border border-line bg-surface p-3"
    >
      <label htmlFor="report-reason" className="text-xs font-medium text-ink">
        Reason
      </label>
      <select
        id="report-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value as ReportReasonValue)}
        disabled={submitting}
        className={selectClassName}
      >
        <option value="" disabled>
          Select a reason
        </option>
        {REPORT_REASON_VALUES.map((value) => (
          <option key={value} value={value}>
            {REPORT_REASON_LABELS[value]}
            {reportedReasons.has(value) ? " (already reported)" : ""}
          </option>
        ))}
      </select>

      <label htmlFor="report-description" className="text-xs font-medium text-ink">
        Description {requiresDescription ? "(required)" : "(optional)"}
      </label>
      <textarea
        id="report-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Describe the problem..."
        rows={3}
        disabled={submitting}
        className={textareaClassName}
      />
      <span className="text-xs text-muted">
        {description.length}/{REPORT_DESCRIPTION_MAX_LENGTH}
      </span>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={closeForm}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {submitting ? "Submitting…" : "Submit report"}
        </Button>
      </div>
    </form>
  );
}
