import { describe, expect, test } from "vitest";
import { extractGoogleFormUrl } from "@/lib/documents/google-form";

describe("extractGoogleFormUrl — supported forms", () => {
  test("a docs.google.com forms viewform URL", () => {
    expect(extractGoogleFormUrl("https://docs.google.com/forms/d/e/1FAIpQLSc123/viewform")).toBe(
      "https://docs.google.com/forms/d/e/1FAIpQLSc123/viewform"
    );
  });

  test("a docs.google.com forms edit URL", () => {
    expect(extractGoogleFormUrl("https://docs.google.com/forms/d/1FAIpQLSc123/edit")).toBe(
      "https://docs.google.com/forms/d/1FAIpQLSc123/edit"
    );
  });

  test("a forms.gle short URL", () => {
    expect(extractGoogleFormUrl("https://forms.gle/AbCd1234")).toBe("https://forms.gle/AbCd1234");
  });

  test("a URL pasted without a scheme still works", () => {
    expect(extractGoogleFormUrl("docs.google.com/forms/d/e/1FAIpQLSc123/viewform")).toBe(
      "https://docs.google.com/forms/d/e/1FAIpQLSc123/viewform"
    );
  });

  test("preserves a pre-filled-link query string", () => {
    expect(
      extractGoogleFormUrl("https://docs.google.com/forms/d/e/1FAIpQLSc123/viewform?usp=pp_url&entry.1=hello")
    ).toBe("https://docs.google.com/forms/d/e/1FAIpQLSc123/viewform?usp=pp_url&entry.1=hello");
  });

  test("drops a hash fragment", () => {
    expect(extractGoogleFormUrl("https://docs.google.com/forms/d/e/1FAIpQLSc123/viewform#responses")).toBe(
      "https://docs.google.com/forms/d/e/1FAIpQLSc123/viewform"
    );
  });

  test("trims surrounding whitespace", () => {
    expect(extractGoogleFormUrl("  https://forms.gle/AbCd1234  ")).toBe("https://forms.gle/AbCd1234");
  });
});

describe("extractGoogleFormUrl — rejections", () => {
  test("an empty string", () => {
    expect(extractGoogleFormUrl("")).toBeNull();
  });

  test("whitespace only", () => {
    expect(extractGoogleFormUrl("   ")).toBeNull();
  });

  test("a completely malformed string", () => {
    expect(extractGoogleFormUrl("not a url at all")).toBeNull();
  });

  test("an HTTP (non-HTTPS) URL", () => {
    expect(extractGoogleFormUrl("http://docs.google.com/forms/d/e/1FAIpQLSc123/viewform")).toBeNull();
  });

  test("an arbitrary external domain", () => {
    expect(extractGoogleFormUrl("https://evil.example.com/forms/d/e/123/viewform")).toBeNull();
  });

  test("a host-spoofing attempt using docs.google.com as a subdomain of an attacker domain", () => {
    expect(extractGoogleFormUrl("https://docs.google.com.evil.com/forms/d/e/123/viewform")).toBeNull();
  });

  test("a host-spoofing attempt embedding docs.google.com in the path, not the host", () => {
    expect(extractGoogleFormUrl("https://evil.com/docs.google.com/forms/d/e/123/viewform")).toBeNull();
  });

  test("a docs.google.com URL that is NOT a Forms path (a Google Doc)", () => {
    expect(extractGoogleFormUrl("https://docs.google.com/document/d/1abc/edit")).toBeNull();
  });

  test("a docs.google.com URL that is NOT a Forms path (a Google Sheet)", () => {
    expect(extractGoogleFormUrl("https://docs.google.com/spreadsheets/d/1abc/edit")).toBeNull();
  });

  test("a bare docs.google.com host with no path", () => {
    expect(extractGoogleFormUrl("https://docs.google.com/")).toBeNull();
  });

  test("a forms.gle URL with an empty path", () => {
    expect(extractGoogleFormUrl("https://forms.gle/")).toBeNull();
  });

  test("a forms.gle URL with no path at all", () => {
    expect(extractGoogleFormUrl("https://forms.gle")).toBeNull();
  });

  test("a non-http(s) scheme (javascript:)", () => {
    expect(extractGoogleFormUrl("javascript://docs.google.com/forms/d/e/123/viewform")).toBeNull();
  });

  test("a data: URL", () => {
    expect(extractGoogleFormUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  test("a file: URL", () => {
    expect(extractGoogleFormUrl("file:///etc/passwd")).toBeNull();
  });
});
