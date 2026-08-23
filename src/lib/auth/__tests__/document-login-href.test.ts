import { describe, expect, test } from "vitest";
import { documentLoginHref, loginHrefFor } from "@/lib/auth/document-login-href";

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

describe("loginHrefFor", () => {
  test("builds a login href with a safe, URL-encoded callback back to an arbitrary path", () => {
    const href = loginHrefFor("/saved");
    expect(href).toBe(`/login?callbackUrl=${encodeURIComponent("/saved")}`);
  });

  test("the decoded callback always points at the given path, never a different one", () => {
    const href = loginHrefFor("/saved?page=2");
    expect(decodeURIComponent(href.split("callbackUrl=")[1])).toBe("/saved?page=2");
  });

  test("documentLoginHref is implemented in terms of loginHrefFor (same output for the equivalent path)", () => {
    expect(documentLoginHref("doc_1")).toBe(loginHrefFor("/documents/doc_1"));
  });
});
