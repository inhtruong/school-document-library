import { z } from "zod";
import { COMMENT_MAX_LENGTH } from "@/lib/documents/comment-config";

/** Plain text only — comments are never parsed/rendered as HTML. Shared by create and edit, since both accept exactly one field. */
export const commentContentSchema = z.object({
  content: z
    .string({ error: "VALIDATION_COMMENT_REQUIRED" })
    .trim()
    .min(1, "VALIDATION_COMMENT_EMPTY")
    .max(COMMENT_MAX_LENGTH, `VALIDATION_COMMENT_TOO_LONG|${COMMENT_MAX_LENGTH}`),
});

export type CommentContentInput = z.infer<typeof commentContentSchema>;
