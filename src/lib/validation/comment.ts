import { z } from "zod";
import { COMMENT_MAX_LENGTH } from "@/lib/documents/comment-config";

/** Plain text only — comments are never parsed/rendered as HTML. Shared by create and edit, since both accept exactly one field. */
export const commentContentSchema = z.object({
  content: z
    .string({ error: "Comment is required" })
    .trim()
    .min(1, "Comment cannot be empty")
    .max(COMMENT_MAX_LENGTH, `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer`),
});

export type CommentContentInput = z.infer<typeof commentContentSchema>;
