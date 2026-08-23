"use client";

import { useState } from "react";
import { toast } from "sonner";
import { commentTextareaClassName } from "@/components/CommentForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function formatCommentDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
      toast.success("Comment updated successfully");
    } catch {
      toast.error("Unable to save comment");
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
      toast.success("Comment deleted successfully");
    } catch {
      toast.error("Unable to delete comment");
      setSubmitting(false);
      setMode("view");
    }
  }

  return (
    <div className="border-b border-line py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">{comment.author.name}</span>
        <Badge variant="outline">{comment.author.role}</Badge>
        <span className="text-xs text-muted">{formatCommentDate(comment.createdAt)}</span>
      </div>

      {mode === "edit" ? (
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor={`edit-comment-${comment.id}`} className="sr-only">
            Edit comment
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
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!canSaveEdit} onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink/90">{comment.content}</p>
      )}

      {mode === "confirm-delete" ? (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted">Delete this comment?</span>
          <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setMode("view")}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={submitting} onClick={handleDelete}>
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      ) : mode === "view" && (isOwner || canDelete) ? (
        <div className="mt-2 flex gap-3 text-xs">
          {isOwner ? (
            <button type="button" className="text-muted transition-colors hover:text-ink" onClick={startEdit}>
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="text-muted transition-colors hover:text-red-600"
              onClick={() => setMode("confirm-delete")}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
