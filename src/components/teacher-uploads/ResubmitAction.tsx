"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

type ResubmitActionProps = {
  documentId: string;
  /** Compact trigger for the /my-uploads list row vs. the fuller button on the document detail page. */
  size?: "sm" | "default";
};

/**
 * Shared by /my-uploads (list row) and /documents/[id] (owner status
 * section) — one implementation, per FEAT-10C's "reuse, don't duplicate"
 * guidance. Only ever rendered for the owner's own REJECTED document; the
 * server-side atomic update in resubmitDocument() is the real enforcement,
 * this is just the confirmation UI. router.refresh() re-fetches the Server
 * Component page afterward — no client-side moderation-state duplication.
 */
export function ResubmitAction({ documentId, size = "default" }: ResubmitActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleResubmit() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/resubmit`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to resubmit document");

      setOpen(false);
      toast.success("Document resubmitted for review.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resubmit document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={size}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Resubmit for review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resubmit document?</DialogTitle>
          <DialogDescription>This will send the document back to the moderation queue.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleResubmit} disabled={submitting}>
            {submitting ? "Resubmitting…" : "Resubmit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
