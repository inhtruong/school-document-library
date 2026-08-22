import { describe, expect, test } from "vitest";
import { isSafeCallbackUrl, resolveCallbackUrl } from "@/lib/auth/callback-url";

describe("isSafeCallbackUrl", () => {
  test.each([
    "/documents/abc123",
    "/",
    "/search?q=exam",
    "/documents/abc123?tab=preview",
  ])("accepts safe internal path: %s", (value) => {
    expect(isSafeCallbackUrl(value)).toBe(true);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["protocol-relative", "//evil.example.com"],
    ["absolute https", "https://evil.example.com"],
    ["absolute http", "http://evil.example.com/documents/1"],
    ["backslash trick", "/\\evil.example.com"],
    ["double backslash", "\\\\evil.example.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["no leading slash", "documents/abc123"],
    ["mailto scheme", "mailto:a@b.com"],
  ] as const)("rejects unsafe value (%s)", (_label, value) => {
    expect(isSafeCallbackUrl(value)).toBe(false);
  });
});

describe("resolveCallbackUrl", () => {
  test("returns the value when it's safe", () => {
    expect(resolveCallbackUrl("/documents/abc123", "/")).toBe("/documents/abc123");
  });

  test("returns the fallback when the value is unsafe", () => {
    expect(resolveCallbackUrl("https://evil.example.com", "/")).toBe("/");
    expect(resolveCallbackUrl(null, "/")).toBe("/");
    expect(resolveCallbackUrl(undefined, "/")).toBe("/");
  });
});
