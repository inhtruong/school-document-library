export type CommentAuthorSummary = { id: string; name: string; role: "STUDENT" | "TEACHER" | "ADMIN" };

export type DocumentCommentRecord = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthorSummary;
};
