"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { commentTextareaClassName } from "@/components/CommentForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DateTimeFormatter } from "@/i18n/formats";
import { COMMENT_MAX_LENGTH } from "@/lib/documents/comment-config";
import type { DocumentCommentRecord } from "@/types/comment";

type CommentItemProps = {
  comment: DocumentCommentRecord;
  documentId: string;
  currentUserId: string | null;
  isAdmin: boolean;
  onUpdated: (comment: DocumentCommentRecord) => void;
  onDeleted: (commentId: string) => void;
};

type Mode = "view" | "edit" | "confirm-delete";

function formatCommentDate(value: string, format: DateTimeFormatter): string {
  return format.dateTime(new Date(value), "dateTimeShort");
}

/**
 * Content is always rendered as plain React text (`{comment.content}`),
 * never `dangerouslySetInnerHTML` — comments are untrusted user input and
 * are never parsed as HTML. `whitespace-pre-wrap` preserves line breaks
 * without needing to render markup.
 */
export function CommentItem({ comment, documentId, currentUserId, isAdmin, onUpdated, onDeleted }: CommentItemProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [editContent, setEditContent] = useState(comment.content);
  const [submitting, setSubmitting] = useState(false);
  const tComments = useTranslations("comments");
  const tRoles = useTranslations("common.roles");
  const tActions = useTranslations("actions");
  const tToast = useTranslations("toast");
  const tErrors = useTranslations("errors.codes");
  const format = useFormatter();

  const isOwner = currentUserId !== null && currentUserId === comment.author.id;
  const canDelete = isOwner || isAdmin;
  const canSaveEdit = editContent.trim().length > 0 && editContent.length <= COMMENT_MAX_LENGTH && !submitting;

  function startEdit() {
    setEditContent(comment.content);
    setMode("edit");
  }

  function cancelEdit() {
    setEditContent(comment.content);
    setMode("view");
  }

  async function handleSave() {
    if (!canSaveEdit) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/comments/${comment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to update comment");

      onUpdated(body.data as DocumentCommentRecord);
      setMode("view");
      toast.success(tToast("commentUpdated"));
    } catch {
      toast.error(tErrors("unableSaveComment"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/comments/${comment.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to delete comment");

      onDeleted(comment.id);
      toast.success(tToast("commentDeleted"));
    } catch {
      toast.error(tErrors("unableDeleteComment"));
      setSubmitting(false);
      setMode("view");
    }
  }

  return (
    <div className="border-b border-line py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">{comment.author.name}</span>
        <Badge variant="outline">{tRoles(comment.author.role.toLowerCase() as "student" | "teacher" | "admin")}</Badge>
        <span className="text-xs text-muted">{formatCommentDate(comment.createdAt, format)}</span>
      </div>

      {mode === "edit" ? (
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor={`edit-comment-${comment.id}`} className="sr-only">
            {tComments("editComment")}
          </label>
          <textarea
            id={`edit-comment-${comment.id}`}
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            rows={3}
            disabled={submitting}
            className={commentTextareaClassName}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {editContent.length}/{COMMENT_MAX_LENGTH}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={cancelEdit}>
                {tActions("cancel")}
              </Button>
              <Button type="button" size="sm" disabled={!canSaveEdit} onClick={handleSave}>
                {tComments("save")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink/90">{comment.content}</p>
      )}

      {mode === "confirm-delete" ? (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted">{tComments("deleteConfirm")}</span>
          <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setMode("view")}>
            {tActions("cancel")}
          </Button>
          <Button type="button" size="sm" disabled={submitting} onClick={handleDelete}>
            {submitting ? tComments("deleting") : tComments("delete")}
          </Button>
        </div>
      ) : mode === "view" && (isOwner || canDelete) ? (
        <div className="mt-2 flex gap-3 text-xs">
          {isOwner ? (
            <button type="button" className="text-muted transition-colors hover:text-ink" onClick={startEdit}>
              {tComments("edit")}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="text-muted transition-colors hover:text-destructive"
              onClick={() => setMode("confirm-delete")}
            >
              {tComments("delete")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
