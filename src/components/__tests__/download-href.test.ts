import { describe, expect, test } from "vitest";
import { resolveDownloadHref } from "@/components/download-href";

describe("resolveDownloadHref", () => {
  test("a document with no file is always null (disabled), regardless of auth", () => {
    expect(resolveDownloadHref("doc_1", false, false)).toBeNull();
    expect(resolveDownloadHref("doc_1", false, true)).toBeNull();
  });

  test("a guest with a downloadable file gets a login link with a safe callback", () => {
    const href = resolveDownloadHref("doc_1", true, false);
    expect(href).toBe(`/login?callbackUrl=${encodeURIComponent("/documents/doc_1")}`);
  });

  test("an authenticated user with a downloadable file gets the protected download endpoint", () => {
    expect(resolveDownloadHref("doc_1", true, true)).toBe("/api/documents/doc_1/download");
  });

  test("the login callback URL never resolves off the documents path for a different id", () => {
    const href = resolveDownloadHref("doc_2", true, false)!;
    expect(decodeURIComponent(href.split("callbackUrl=")[1])).toBe("/documents/doc_2");
  });
});
