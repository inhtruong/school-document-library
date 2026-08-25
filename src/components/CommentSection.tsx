"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CommentForm } from "@/components/CommentForm";
import { CommentItem } from "@/components/CommentItem";
import { Button } from "@/components/ui/button";
import { documentLoginHref } from "@/lib/auth/document-login-href";
import type { DocumentCommentRecord } from "@/types/comment";

type CommentSectionProps = {
  documentId: string;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  initialComments: DocumentCommentRecord[];
  initialTotal: number;
  initialTotalPages: number;
};

/**
 * Guests get a plain link to `/login?callbackUrl=...` (via the shared
 * `documentLoginHref()` helper — same one Download/Rating use) instead of a
 * form; nothing is ever submitted before login. Authenticated users get a
 * plain textarea form. Create/edit/delete all follow "submit → response →
 * update local state" — no optimistic UI, no client cache library.
 */
export function CommentSection({
  documentId,
  isAuthenticated,
  currentUserId,
  isAdmin,
  initialComments,
  initialTotal,
  initialTotalPages,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loadingPage, setLoadingPage] = useState(false);

  async function loadPage(nextPage: number) {
    setLoadingPage(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/comments?page=${nextPage}`);
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to load comments");

      setComments(body.data as DocumentCommentRecord[]);
      setTotal(body.meta?.total ?? body.data.length);
      setTotalPages(body.meta?.totalPages ?? 1);
      setPage(nextPage);
    } catch {
      toast.error("Unable to load comments");
    } finally {
      setLoadingPage(false);
    }
  }

  async function handlePost(content: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to save comment");

      if (page === 1) {
        setComments((prev) => [body.data as DocumentCommentRecord, ...prev]);
      }
      setTotal((prev) => prev + 1);
      toast.success("Comment posted successfully");
      return true;
    } catch {
      toast.error("Unable to save comment");
      return false;
    }
  }

  function handleUpdated(updated: DocumentCommentRecord) {
    setComments((prev) => prev.map((comment) => (comment.id === updated.id ? updated : comment)));
  }

  function handleDeleted(commentId: string) {
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Comments</h2>
      <p className="mt-0.5 text-sm text-muted">{total === 0 ? "No comments yet" : `${total} ${total === 1 ? "comment" : "comments"}`}</p>

      <div className="mt-4">
        {isAuthenticated ? (
          <CommentForm onSubmit={handlePost} />
        ) : (
          <p className="text-sm text-muted">
            <a
              href={documentLoginHref(documentId)}
              className="font-medium text-ink underline underline-offset-2 hover:text-accent"
            >
              Log in
            </a>{" "}
            to leave a comment.
          </p>
        )}
      </div>

      <div className="mt-2 border-t border-line">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              documentId={documentId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))
        ) : (
          <p className="py-4 text-sm text-muted">Be the first to comment.</p>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loadingPage}
            onClick={() => loadPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loadingPage}
            onClick={() => loadPage(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
