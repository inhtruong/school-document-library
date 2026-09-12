import { DOCX_MIME_TYPE } from "@/lib/storage/local-storage";
import type { DocumentRecord } from "@/types/document";

export type PreviewKind = "pdf" | "image" | "video" | "docx" | "word-legacy" | "excel" | "youtube" | "none";

/**
 * Preview kinds the backend actually streams bytes for; everything else gets
 * a placeholder (or, for "youtube", a client-rendered iframe pointed
 * directly at youtube-nocookie.com — the backend never proxies/streams
 * video bytes for it, so it's deliberately excluded from this set).
 */
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
 *
 * FEAT-12B: `sourceType` is checked first — a YOUTUBE document has no
 * `fileCategory` at all (it's null, like any other fileless document), so
 * this can't be expressed as a `fileCategory` case; it's a separate axis.
 */
export function resolvePreviewKind(
  sourceType: DocumentRecord["sourceType"],
  fileCategory: DocumentRecord["fileCategory"],
  mimeType: string | null
): PreviewKind {
  if (sourceType === "YOUTUBE") return "youtube";

  switch (fileCategory) {
    case "PDF":
      return "pdf";
    // FEAT-12A: a PowerPoint document's preview is a server-generated PDF
    // (see previewFileKey) — reuses the existing "pdf" kind/UI rather than
    // inventing a second viewer. mimeType is irrelevant here (unlike WORD's
    // docx/doc split): both .ppt and .pptx get converted identically.
    case "POWERPOINT":
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
