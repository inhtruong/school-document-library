"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const REJECTION_REASON_MAX_LENGTH = 1000;

type ModerationActionsProps = {
  documentId: string;
  documentTitle: string;
};

/**
 * Only ever rendered for a PENDING document (the review detail page hides
 * this entirely once reviewed — FEAT-10B doesn't allow re-review). Both
 * actions require a deliberate confirmation (Dialog) rather than a single
 * click, and use router.refresh() after success so the Server Component
 * page re-fetches the now-updated status — no client-side state duplication
 * of the moderation record itself.
 */
export function ModerationActions({ documentId, documentTitle }: ModerationActionsProps) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/moderation/documents/${documentId}/approve`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to approve document");

      setApproveOpen(false);
      toast.success("Document approved — it is now publicly visible");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setReasonError("A rejection reason is required");
      return;
    }

    setSubmitting(true);
    setReasonError(null);
    try {
      const response = await fetch(`/api/moderation/documents/${documentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to reject document");

      setRejectOpen(false);
      setReason("");
      toast.success("Document rejected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row">
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogTrigger asChild>
          <Button type="button" className="w-full sm:w-auto">
            <Check className="h-4 w-4" aria-hidden />
            Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve document?</DialogTitle>
            <DialogDescription>
              &ldquo;{documentTitle}&rdquo; will become publicly visible immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleApprove} disabled={submitting}>
              {submitting ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) {
            setReason("");
            setReasonError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full text-destructive hover:bg-destructive-soft sm:w-auto"
          >
            <X className="h-4 w-4" aria-hidden />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleReject}>
            <DialogHeader>
              <DialogTitle>Reject document</DialogTitle>
              <DialogDescription>Explain why &ldquo;{documentTitle}&rdquo; is being rejected.</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <label htmlFor="rejection-reason" className="text-sm font-medium text-ink">
                Reason
              </label>
              <textarea
                id="rejection-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(null);
                }}
                maxLength={REJECTION_REASON_MAX_LENGTH}
                rows={4}
                placeholder="e.g. Wrong grade/subject, unreadable scan, duplicate upload"
                disabled={submitting}
                aria-invalid={reasonError ? true : undefined}
                aria-describedby={reasonError ? "rejection-reason-error" : undefined}
                className="mt-1.5 w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              />
              {reasonError ? (
                <p id="rejection-reason-error" role="alert" className="mt-1.5 text-xs text-destructive">
                  {reasonError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant="outline"
                className="text-destructive hover:bg-destructive-soft"
                disabled={submitting || reason.trim().length === 0}
              >
                {submitting ? "Rejecting…" : "Reject"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
