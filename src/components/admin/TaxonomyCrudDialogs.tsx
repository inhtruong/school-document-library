"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";

type TaxonomyRow = { id: string; name: string; code: string };

/**
 * FEAT-15B: shared mutation runner for every Grade/Subject/Lesson dialog —
 * fetch + envelope check + toast + router.refresh(), the same recipe as
 * ModerationActions.tsx, factored out once since 3 entities need it
 * near-identically (create/edit/delete × Grade/Subject/Lesson).
 */
function useTaxonomyMutation() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(request: () => Promise<Response>, onSuccess: () => void) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await request();
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Request failed");
      onSuccess();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, error, setError, run };
}

type CreateTaxonomyDialogProps = {
  /** Translated singular entity name, e.g. "Grade" / "Subject" / "Lesson". */
  entityLabel: string;
  /** Collection endpoint to POST to, e.g. "/api/grades". */
  apiPath: string;
  /** Merged into the POST body — parent scoping (gradeId/subjectId) or Grade's sortOrder. */
  extraFields?: Record<string, string | number>;
};

export function CreateTaxonomyDialog({ entityLabel, apiPath, extraFields }: CreateTaxonomyDialogProps) {
  const t = useTranslations("admin.taxonomy");
  const tActions = useTranslations("actions");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const { submitting, error, setError, run } = useTaxonomyMutation();

  function resetAndClose() {
    setOpen(false);
    setName("");
    setCode("");
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () =>
        fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), code: code.trim(), ...extraFields }),
        }),
      () => {
        resetAndClose();
        toast.success(t("createSuccess", { entity: entityLabel }));
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          {t("addButton", { entity: entityLabel })}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("createTitle", { entity: entityLabel })}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              {t("nameLabel")}
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              {t("codeLabel")}
              <Input value={code} onChange={(event) => setCode(event.target.value)} disabled={submitting} required />
            </label>
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                {tActions("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting || !name.trim() || !code.trim()}>
              {submitting ? t("saving") : tActions("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type TaxonomyRowActionsProps = {
  entityLabel: string;
  /** Item endpoint, e.g. `/api/grades/${grade.id}`. */
  apiPath: string;
  row: TaxonomyRow;
};

/** Edit + Delete for one Grade/Subject/Lesson row — name/code only (re-parenting a Subject/Lesson isn't exposed by this MVP UI). */
export function TaxonomyRowActions({ entityLabel, apiPath, row }: TaxonomyRowActionsProps) {
  const t = useTranslations("admin.taxonomy");
  const tActions = useTranslations("actions");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(row.name);
  const [code, setCode] = useState(row.code);
  const edit = useTaxonomyMutation();
  const del = useTaxonomyMutation();

  function resetEditAndClose() {
    setEditOpen(false);
    setName(row.name);
    setCode(row.code);
    edit.setError(null);
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    edit.run(
      () =>
        fetch(apiPath, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), code: code.trim() }),
        }),
      () => {
        setEditOpen(false);
        toast.success(t("updateSuccess", { entity: entityLabel }));
      }
    );
  }

  function handleDelete() {
    del.run(
      () => fetch(apiPath, { method: "DELETE" }),
      () => {
        setDeleteOpen(false);
        toast.success(t("deleteSuccess", { entity: entityLabel }));
      }
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Dialog open={editOpen} onOpenChange={(next) => (next ? setEditOpen(true) : resetEditAndClose())}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" aria-label={tActions("edit")}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>{t("editTitle", { entity: entityLabel })}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                {t("nameLabel")}
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={edit.submitting}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                {t("codeLabel")}
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={edit.submitting}
                  required
                />
              </label>
              {edit.error ? (
                <p role="alert" className="text-xs text-destructive">
                  {edit.error}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={edit.submitting}>
                  {tActions("cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={edit.submitting || !name.trim() || !code.trim()}>
                {edit.submitting ? t("saving") : tActions("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => (next ? setDeleteOpen(true) : (setDeleteOpen(false), del.setError(null)))}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive-soft"
            aria-label={tActions("delete")}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle", { entity: entityLabel })}</DialogTitle>
            <DialogDescription>{t("deleteDescription", { name: row.name })}</DialogDescription>
          </DialogHeader>
          {del.error ? (
            <p role="alert" className="text-xs text-destructive">
              {del.error}
            </p>
          ) : null}
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={del.submitting}>
                {tActions("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:bg-destructive-soft"
              onClick={handleDelete}
              disabled={del.submitting}
            >
              {del.submitting ? t("saving") : tActions("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
