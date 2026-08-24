import { describe, expect, test } from "vitest";
import { buildContentDisposition } from "@/lib/documents/content-disposition";

describe("buildContentDisposition", () => {
  test("builds a standard attachment header for a plain ASCII filename", () => {
    const header = buildContentDisposition("Database Final Exam 2026.pdf");
    expect(header).toBe(
      'attachment; filename="Database Final Exam 2026.pdf"; filename*=UTF-8\'\'Database%20Final%20Exam%202026.pdf'
    );
  });

  test("always starts with attachment (never inline)", () => {
    expect(buildContentDisposition("notes.docx").startsWith("attachment;")).toBe(true);
  });

  test("escapes double quotes and backslashes in the ASCII fallback", () => {
    const header = buildContentDisposition('evil".docx');
    expect(header).toContain('filename="evil_.docx"');
    expect(header).not.toContain('evil".docx"');
  });

  test("strips CR/LF and other control characters (header injection prevention)", () => {
    const header = buildContentDisposition("report.pdf\r\nX-Injected: evil");
    expect(header).not.toMatch(/\r|\n/);
  });

  test("falls back to a safe default name for empty/whitespace-only input", () => {
    expect(buildContentDisposition("")).toContain('filename="download"');
    expect(buildContentDisposition("   ")).toContain('filename="download"');
  });

  test("non-ASCII filenames get an underscore-sanitized ASCII fallback and a correct RFC 5987 filename*", () => {
    const header = buildContentDisposition("Đề thi.pdf");
    expect(header).toContain('filename="');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain(encodeURIComponent("Đề thi.pdf"));
  });

  test("never leaks a fileKey-shaped value as-is when passed a normal filename", () => {
    // Sanity check that this function only ever formats whatever string it's
    // given — the route is responsible for passing fileName, not fileKey.
    const header = buildContentDisposition("Lecture Notes.docx");
    expect(header).not.toContain("storage_local");
  });

  test("path-traversal-shaped filenames produce a well-formed header (Step 13C regression)", () => {
    // This function only formats a header value — it never touches the
    // filesystem (see resolveStoragePath in local-storage.ts, which is the
    // actual traversal guard, and never derives a path from this filename).
    // Still worth pinning: no header-injection or malformed output results.
    const header = buildContentDisposition("../../secret.pdf");
    expect(header.startsWith("attachment;")).toBe(true);
    expect(header).not.toMatch(/\r|\n/);
  });

  test("a very long filename still produces a single well-formed header line", () => {
    const longName = `${"a".repeat(500)}.pdf`;
    const header = buildContentDisposition(longName);
    expect(header.startsWith("attachment;")).toBe(true);
    expect(header).not.toMatch(/\r|\n/);
  });
});
