import { describe, expect, test } from "vitest";
import { resolvePreviewKind, STREAMABLE_PREVIEW_KINDS } from "@/lib/documents/preview-kind";
import { DOCX_MIME_TYPE } from "@/lib/storage/local-storage";

const LEGACY_DOC_MIME = "application/msword";

describe("resolvePreviewKind", () => {
  test("PDF, IMAGE, and VIDEO pass through unchanged regardless of mimeType", () => {
    expect(resolvePreviewKind("PDF", "application/pdf")).toBe("pdf");
    expect(resolvePreviewKind("IMAGE", "image/png")).toBe("image");
    expect(resolvePreviewKind("VIDEO", "video/mp4")).toBe("video");
  });

  test("EXCEL is never previewable", () => {
    expect(resolvePreviewKind("EXCEL", "application/vnd.ms-excel")).toBe("excel");
    expect(
      resolvePreviewKind("EXCEL", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).toBe("excel");
  });

  test("WORD + the real .docx mimeType is classified as docx (previewable)", () => {
    expect(resolvePreviewKind("WORD", DOCX_MIME_TYPE)).toBe("docx");
  });

  test("WORD + the legacy .doc mimeType is classified as word-legacy (unsupported)", () => {
    expect(resolvePreviewKind("WORD", LEGACY_DOC_MIME)).toBe("word-legacy");
  });

  test("WORD with a missing/unexpected mimeType falls back to word-legacy, not docx", () => {
    expect(resolvePreviewKind("WORD", null)).toBe("word-legacy");
    expect(resolvePreviewKind("WORD", "text/plain")).toBe("word-legacy");
  });

  test("no fileCategory (no file on the document) is none", () => {
    expect(resolvePreviewKind(null, null)).toBe("none");
  });
});

describe("STREAMABLE_PREVIEW_KINDS", () => {
  test("includes docx alongside the existing streamable kinds", () => {
    expect(STREAMABLE_PREVIEW_KINDS.has("docx")).toBe(true);
    expect(STREAMABLE_PREVIEW_KINDS.has("pdf")).toBe(true);
    expect(STREAMABLE_PREVIEW_KINDS.has("image")).toBe(true);
    expect(STREAMABLE_PREVIEW_KINDS.has("video")).toBe(true);
  });

  test("excludes word-legacy, excel, and none", () => {
    expect(STREAMABLE_PREVIEW_KINDS.has("word-legacy")).toBe(false);
    expect(STREAMABLE_PREVIEW_KINDS.has("excel")).toBe(false);
    expect(STREAMABLE_PREVIEW_KINDS.has("none")).toBe(false);
  });
});
