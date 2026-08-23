import { describe, expect, test } from "vitest";
import { documentLoginHref } from "@/lib/auth/document-login-href";

describe("documentLoginHref", () => {
  test("builds a login href with a safe, URL-encoded callback back to the document", () => {
    const href = documentLoginHref("doc_1");
    expect(href).toBe(`/login?callbackUrl=${encodeURIComponent("/documents/doc_1")}`);
  });

  test("the decoded callback always points at the given document id, never a different one", () => {
    const href = documentLoginHref("doc_2");
    expect(decodeURIComponent(href.split("callbackUrl=")[1])).toBe("/documents/doc_2");
  });
});
