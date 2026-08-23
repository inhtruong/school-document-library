"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COMMENT_MAX_LENGTH } from "@/lib/documents/comment-config";

type CommentFormProps = {
  /** Returns true on success — the form only clears itself when the caller confirms the post actually saved. */
  onSubmit: (content: string) => Promise<boolean>;
};

export const commentTextareaClassName =
  "w-full rounded-lg border border-line bg-paper p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

/** Plain textarea + submit — no rich text editor. */
export function CommentForm({ onSubmit }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedLength = content.trim().length;
  const canSubmit = trimmedLength > 0 && content.length <= COMMENT_MAX_LENGTH && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    const success = await onSubmit(content.trim());
    setSubmitting(false);
    if (success) setContent("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="new-comment" className="sr-only">
        Write a comment
      </label>
      <textarea
        id="new-comment"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Write a comment..."
        rows={3}
        disabled={submitting}
        className={commentTextareaClassName}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {content.length}/{COMMENT_MAX_LENGTH}
        </span>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {submitting ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
