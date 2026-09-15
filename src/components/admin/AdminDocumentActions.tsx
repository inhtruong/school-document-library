"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
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
import { DOCUMENT_TYPE_VALUES, documentTypeMessageKey, type DocumentTypeValue } from "@/lib/documents/document-type";

type Option = { id: string; name: string };

type AdminDocumentActionsProps = {
  document: {
    id: string;
    title: string;
    description: string | null;
    documentType: DocumentTypeValue;
    grade: Option | null;
    subjectRef: Option | null;
    lesson: Option | null;
  };
  grades: Option[];
};

/** Same fetch + toast + router.refresh() recipe as TaxonomyCrudDialogs.tsx/UserRoleChangeDialog.tsx, calling the EXISTING PUT/DELETE /api/documents/[id] endpoints — no new mutation route. */
export function AdminDocumentActions({ document, grades }: AdminDocumentActionsProps) {
  const router = useRouter();
  const t = useTranslations("admin.documents.edit");
  const tActions = useTranslations("actions");
  const tCommon = useTranslations("common");
  const tDocumentType = useTranslations("documentType");
  const tErrors = useTranslations("errors.codes");

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description ?? "");
  const [documentType, setDocumentType] = useState<DocumentTypeValue>(document.documentType);
  const [gradeId, setGradeId] = useState(document.grade?.id ?? "");
  const [subjectId, setSubjectId] = useState(document.subjectRef?.id ?? "");
  const [lessonId, setLessonId] = useState(document.lesson?.id ?? "");
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [lessons, setLessons] = useState<Option[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubjects([]);
    if (!gradeId) return;
    let cancelled = false;
    fetch(`/api/subjects?gradeId=${encodeURIComponent(gradeId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.success) setSubjects(body.data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [gradeId]);

  useEffect(() => {
    setLessons([]);
    if (!subjectId) return;
    let cancelled = false;
    fetch(`/api/lessons?subjectId=${encodeURIComponent(subjectId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.success) setLessons(body.data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  function resetEdit() {
    setEditOpen(false);
    setTitle(document.title);
    setDescription(document.description ?? "");
    setDocumentType(document.documentType);
    setGradeId(document.grade?.id ?? "");
    setSubjectId(document.subjectRef?.id ?? "");
    setLessonId(document.lesson?.id ?? "");
    setError(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        documentType,
      };
      if (gradeId && subjectId && lessonId) {
        body.gradeId = gradeId;
        body.subjectId = subjectId;
        body.lessonId = lessonId;
      }

      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json();
      if (!response.ok || !responseBody.success) throw new Error(responseBody.error ?? "Failed to update document");

      setEditOpen(false);
      toast.success(t("updateSuccess"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors("failedUpdateDocument"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to delete document");

      toast.success(t("deleteSuccess"));
      router.push("/admin/documents");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors("failedDeleteDocument"));
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={editOpen} onOpenChange={(next) => (next ? setEditOpen(true) : resetEdit())}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Pencil className="h-4 w-4" aria-hidden />
            {tActions("edit")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
              <label className="flex flex-col gap-1.5 text-sm">
                {t("titleLabel")}
                <Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={submitting} required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                {t("descriptionLabel")}
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={submitting}
                  rows={3}
                  className="rounded-lg border border-line bg-paper p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                {tCommon("documentType")}
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value as DocumentTypeValue)}
                  disabled={submitting}
                  className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {DOCUMENT_TYPE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {tDocumentType(documentTypeMessageKey(value))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                {tCommon("grade")}
                <select
                  value={gradeId}
                  onChange={(event) => {
                    setGradeId(event.target.value);
                    setSubjectId("");
                    setLessonId("");
                  }}
                  disabled={submitting}
                  className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">{t("noTaxonomy")}</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                {tCommon("subject")}
                <select
                  value={subjectId}
                  onChange={(event) => {
                    setSubjectId(event.target.value);
                    setLessonId("");
                  }}
                  disabled={submitting || !gradeId}
                  className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value=""></option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                {tCommon("lessonTopic")}
                <select
                  value={lessonId}
                  onChange={(event) => setLessonId(event.target.value)}
                  disabled={submitting || !subjectId}
                  className="h-10 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value=""></option>
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.name}
                    </option>
                  ))}
                </select>
              </label>
              {(gradeId || subjectId || lessonId) && !(gradeId && subjectId && lessonId) ? (
                <p className="text-xs text-muted">{t("taxonomyIncompleteHint")}</p>
              ) : null}
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
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting ? t("saving") : tActions("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="text-destructive hover:bg-destructive-soft">
            <Trash2 className="h-4 w-4" aria-hidden />
            {tActions("delete")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDescription", { title: document.title })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={deleting}>
                {tActions("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:bg-destructive-soft"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? t("saving") : tActions("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
