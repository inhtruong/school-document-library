import { describe, expect, test } from "vitest";
import { isMutatingMethod, isSameOriginRequest } from "@/lib/security/origin-check";

describe("isMutatingMethod", () => {
  test.each(["POST", "PUT", "PATCH", "DELETE", "post", "put"])("treats %s as mutating", (method) => {
    expect(isMutatingMethod(method)).toBe(true);
  });

  test.each(["GET", "HEAD", "OPTIONS", "get"])("treats %s as non-mutating", (method) => {
    expect(isMutatingMethod(method)).toBe(false);
  });
});

describe("isSameOriginRequest", () => {
  test("allows a matching Origin/Host pair", () => {
    const request = new Request("http://example.com/api/documents", {
      method: "POST",
      headers: { origin: "https://example.com", host: "example.com" },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  test("allows a matching Origin/Host pair that includes a port", () => {
    const request = new Request("http://localhost:3000/api/documents", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  test("rejects a cross-site Origin", () => {
    const request = new Request("http://example.com/api/documents", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "example.com" },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  test("allows a request with no Origin header at all", () => {
    const request = new Request("http://example.com/api/documents", {
      method: "POST",
      headers: { host: "example.com" },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  test("rejects when Origin is present but Host is missing", () => {
    const request = new Request("http://example.com/api/documents", {
      method: "POST",
      headers: { origin: "https://example.com" },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  test("rejects a malformed Origin header", () => {
    const request = new Request("http://example.com/api/documents", {
      method: "POST",
      headers: { origin: "not-a-valid-url", host: "example.com" },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  test("does not trust X-Forwarded-Host as a substitute for Host", () => {
    const request = new Request("http://example.com/api/documents", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "example.com",
        "x-forwarded-host": "evil.example",
      },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });
});
