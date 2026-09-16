"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

type AdminReportActionsProps = {
  reportId: string;
  documentTitle: string;
  reasonLabel: string;
};

/** Same fetch + toast + router.refresh() recipe as every other admin dialog this session, calling PATCH /api/admin/reports/[reportId]. Only ever rendered for an OPEN report (the detail page hides this entirely once handled). */
export function AdminReportActions({ reportId, documentTitle, reasonLabel }: AdminReportActionsProps) {
  const router = useRouter();
  const t = useTranslations("admin.reports.detail");
  const tActions = useTranslations("actions");
  const tErrors = useTranslations("errors.codes");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleUpdate(status: "RESOLVED" | "DISMISSED") {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update report");

      setResolveOpen(false);
      setDismissOpen(false);
      toast.success(status === "RESOLVED" ? t("resolveSuccess") : t("dismissSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors("failedUpdateReport"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <Check className="h-4 w-4" aria-hidden />
            {t("resolve")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resolveDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("resolveDialogDescription", { title: documentTitle, reason: reasonLabel })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                {tActions("cancel")}
              </Button>
            </DialogClose>
            <Button type="button" onClick={() => handleUpdate("RESOLVED")} disabled={submitting}>
              {submitting ? t("saving") : t("resolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <X className="h-4 w-4" aria-hidden />
            {t("dismiss")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dismissDialogTitle")}</DialogTitle>
            <DialogDescription>{t("dismissDialogDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                {tActions("cancel")}
              </Button>
            </DialogClose>
            <Button type="button" variant="outline" onClick={() => handleUpdate("DISMISSED")} disabled={submitting}>
              {submitting ? t("saving") : t("dismiss")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
