import { DOCX_MIME_TYPE } from "@/lib/storage/local-storage";
import type { DocumentRecord } from "@/types/document";

export type PreviewKind = "pdf" | "image" | "video" | "docx" | "word-legacy" | "excel" | "none";

/** Preview kinds the backend actually streams bytes for; everything else gets a placeholder. */
export const STREAMABLE_PREVIEW_KINDS: ReadonlySet<PreviewKind> = new Set([
  "pdf",
  "image",
  "video",
  "docx",
]);

/**
 * Single source of truth for "what kind of preview does this file get" —
 * used by both the preview API route (to decide what to stream vs. reject)
 * and `FilePreview` (to decide what to render). `.doc` and `.docx` share the
 * WORD `fileCategory`, so this distinguishes them by `mimeType` rather than
 * filename, per the existing upload allowlist's own MIME mapping.
 */
export function resolvePreviewKind(
  fileCategory: DocumentRecord["fileCategory"],
  mimeType: string | null
): PreviewKind {
  switch (fileCategory) {
    case "PDF":
      return "pdf";
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "EXCEL":
      return "excel";
    case "WORD":
      return mimeType === DOCX_MIME_TYPE ? "docx" : "word-legacy";
    default:
      return "none";
  }
}
