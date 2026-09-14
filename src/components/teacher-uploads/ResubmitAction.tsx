"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const tDocumentActions = useTranslations("documentActions");
  const tActions = useTranslations("actions");
  const tToast = useTranslations("toast");
  const tErrors = useTranslations("errors.codes");

  async function handleResubmit() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/resubmit`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to resubmit document");

      setOpen(false);
      toast.success(tToast("documentResubmitted"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors("failedResubmitDocument"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={size}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {tDocumentActions("resubmitForReview")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tDocumentActions("resubmitDocumentTitle")}</DialogTitle>
          <DialogDescription>{tDocumentActions("resubmitDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>
              {tActions("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleResubmit} disabled={submitting}>
            {submitting ? tDocumentActions("resubmitting") : tDocumentActions("resubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
