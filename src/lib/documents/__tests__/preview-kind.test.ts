import { describe, expect, test } from "vitest";
import { resolvePreviewKind, STREAMABLE_PREVIEW_KINDS } from "@/lib/documents/preview-kind";
import { DOCX_MIME_TYPE } from "@/lib/storage/local-storage";

const LEGACY_DOC_MIME = "application/msword";

describe("resolvePreviewKind", () => {
  test("PDF, IMAGE, and VIDEO pass through unchanged regardless of mimeType", () => {
    expect(resolvePreviewKind("FILE", "PDF", "application/pdf")).toBe("pdf");
    expect(resolvePreviewKind("FILE", "IMAGE", "image/png")).toBe("image");
    expect(resolvePreviewKind("FILE", "VIDEO", "video/mp4")).toBe("video");
  });

  test("EXCEL is never previewable", () => {
    expect(resolvePreviewKind("FILE", "EXCEL", "application/vnd.ms-excel")).toBe("excel");
    expect(
      resolvePreviewKind("FILE", "EXCEL", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).toBe("excel");
  });

  test("WORD + the real .docx mimeType is classified as docx (previewable)", () => {
    expect(resolvePreviewKind("FILE", "WORD", DOCX_MIME_TYPE)).toBe("docx");
  });

  test("WORD + the legacy .doc mimeType is classified as word-legacy (unsupported)", () => {
    expect(resolvePreviewKind("FILE", "WORD", LEGACY_DOC_MIME)).toBe("word-legacy");
  });

  test("WORD with a missing/unexpected mimeType falls back to word-legacy, not docx", () => {
    expect(resolvePreviewKind("FILE", "WORD", null)).toBe("word-legacy");
    expect(resolvePreviewKind("FILE", "WORD", "text/plain")).toBe("word-legacy");
  });

  test("no fileCategory (no file on the document) is none", () => {
    expect(resolvePreviewKind("FILE", null, null)).toBe("none");
  });

  test("POWERPOINT is classified as pdf (the generated preview), regardless of .ppt vs .pptx mimeType", () => {
    expect(resolvePreviewKind("FILE", "POWERPOINT", "application/vnd.ms-powerpoint")).toBe("pdf");
    expect(
      resolvePreviewKind(
        "FILE",
        "POWERPOINT",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
    ).toBe("pdf");
  });

  test("FEAT-12B: sourceType YOUTUBE is classified as youtube, regardless of (always-null) fileCategory/mimeType", () => {
    expect(resolvePreviewKind("YOUTUBE", null, null)).toBe("youtube");
  });
});

describe("STREAMABLE_PREVIEW_KINDS", () => {
  test("includes docx alongside the existing streamable kinds", () => {
    expect(STREAMABLE_PREVIEW_KINDS.has("docx")).toBe(true);
    expect(STREAMABLE_PREVIEW_KINDS.has("pdf")).toBe(true);
    expect(STREAMABLE_PREVIEW_KINDS.has("image")).toBe(true);
    expect(STREAMABLE_PREVIEW_KINDS.has("video")).toBe(true);
  });

  test("excludes word-legacy, excel, youtube, and none", () => {
    expect(STREAMABLE_PREVIEW_KINDS.has("word-legacy")).toBe(false);
    expect(STREAMABLE_PREVIEW_KINDS.has("excel")).toBe(false);
    expect(STREAMABLE_PREVIEW_KINDS.has("youtube")).toBe(false);
    expect(STREAMABLE_PREVIEW_KINDS.has("none")).toBe(false);
  });
});
