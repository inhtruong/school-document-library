import { describe, expect, test } from "vitest";
import { buildContentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/lib/security/security-headers";

function getDirective(csp: string, name: string): string | undefined {
  return csp.split("; ").find((directive) => directive.startsWith(`${name} `));
}

describe("buildContentSecurityPolicy", () => {
  test("frame-src allows this app's own origin plus exactly the YouTube privacy-enhanced embed domain (FEAT-12B)", () => {
    const csp = buildContentSecurityPolicy("test-nonce");
    expect(getDirective(csp, "frame-src")).toBe("frame-src 'self' https://www.youtube-nocookie.com");
  });

  test("frame-src never contains a wildcard", () => {
    const csp = buildContentSecurityPolicy("test-nonce");
    const frameSrc = getDirective(csp, "frame-src");
    expect(frameSrc).not.toContain("*");
  });

  test("no directive anywhere contains a blanket wildcard", () => {
    const csp = buildContentSecurityPolicy("test-nonce");
    expect(csp).not.toMatch(/[\s'"]\*/);
  });

  test("every other directive is unchanged by the FEAT-12B frame-src addition", () => {
    const csp = buildContentSecurityPolicy("test-nonce");
    expect(getDirective(csp, "default-src")).toBe("default-src 'self'");
    expect(getDirective(csp, "style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(getDirective(csp, "img-src")).toBe("img-src 'self' data: blob:");
    expect(getDirective(csp, "media-src")).toBe("media-src 'self'");
    expect(getDirective(csp, "font-src")).toBe("font-src 'self'");
    expect(getDirective(csp, "connect-src")).toBe("connect-src 'self'");
    expect(getDirective(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(getDirective(csp, "object-src")).toBe("object-src 'none'");
    expect(getDirective(csp, "base-uri")).toBe("base-uri 'self'");
    expect(getDirective(csp, "form-action")).toBe("form-action 'self'");
  });

  test("script-src still uses a nonce + strict-dynamic, never 'unsafe-inline'", () => {
    const csp = buildContentSecurityPolicy("test-nonce");
    const scriptSrc = getDirective(csp, "script-src");
    expect(scriptSrc).toContain("'nonce-test-nonce'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  test("is unaffected by the FEAT-12B CSP change (a separate, fixed header set)", () => {
    const keys = STATIC_SECURITY_HEADERS.map((header) => header.key);
    expect(keys).toEqual(["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"]);
  });
});
