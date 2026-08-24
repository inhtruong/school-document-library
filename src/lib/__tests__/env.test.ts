import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  getAppUrl,
  getMaxUploadSizeMB,
  getStorageRoot,
  isProduction,
  isProductionSeedBlocked,
  validateProductionEnv,
} from "@/lib/env";

// NODE_ENV is deliberately excluded — @types/node marks it read-only, so it's
// handled separately below via vi.stubEnv()/vi.unstubAllEnvs().
const ENV_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_TRUST_HOST",
  "STORAGE_ROOT",
  "MAX_UPLOAD_SIZE_MB",
  "APP_URL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

/** `process.env.NODE_ENV` is typed read-only by @types/node — vi.stubEnv() handles the assignment safely. */
function setNodeEnv(value: string) {
  vi.stubEnv("NODE_ENV", value);
}

describe("isProduction", () => {
  test("is false for the ambient (non-production) test NODE_ENV", () => {
    expect(isProduction()).toBe(false);
  });

  test("is false for development/test", () => {
    setNodeEnv("development");
    expect(isProduction()).toBe(false);
    setNodeEnv("test");
    expect(isProduction()).toBe(false);
  });

  test("is true only for NODE_ENV=production", () => {
    setNodeEnv("production");
    expect(isProduction()).toBe(true);
  });
});

describe("isProductionSeedBlocked", () => {
  test("mirrors isProduction()", () => {
    expect(isProductionSeedBlocked()).toBe(false);
    setNodeEnv("production");
    expect(isProductionSeedBlocked()).toBe(true);
  });
});

describe("getStorageRoot", () => {
  test("returns null when unset — callers fall back to their own dev default", () => {
    expect(getStorageRoot()).toBeNull();
  });

  test("returns the trimmed configured value when set", () => {
    process.env.STORAGE_ROOT = "  /var/lib/school-library/storage  ";
    expect(getStorageRoot()).toBe("/var/lib/school-library/storage");
  });

  test("treats an empty/whitespace-only value the same as unset", () => {
    process.env.STORAGE_ROOT = "   ";
    expect(getStorageRoot()).toBeNull();
  });
});

describe("getMaxUploadSizeMB", () => {
  test("defaults to 10 when unset", () => {
    expect(getMaxUploadSizeMB()).toBe(10);
  });

  test("uses the configured value when valid", () => {
    process.env.MAX_UPLOAD_SIZE_MB = "25";
    expect(getMaxUploadSizeMB()).toBe(25);
  });

  test.each(["0", "-5", "not-a-number", ""])("falls back to 10 for an invalid value (%s)", (value) => {
    process.env.MAX_UPLOAD_SIZE_MB = value;
    expect(getMaxUploadSizeMB()).toBe(10);
  });
});

describe("getAppUrl", () => {
  test("returns null when unset", () => {
    expect(getAppUrl()).toBeNull();
  });

  test("returns the trimmed configured value when set", () => {
    process.env.APP_URL = "  https://library.example.com  ";
    expect(getAppUrl()).toBe("https://library.example.com");
  });

  test.each(["not-a-url", "ftp://library.example.com", "//library.example.com"])(
    "returns null for an invalid value (%s) — validateProductionEnv() surfaces the error instead",
    (value) => {
      process.env.APP_URL = value;
      expect(getAppUrl()).toBeNull();
    }
  );
});

describe("validateProductionEnv", () => {
  function setValidProductionEnv() {
    setNodeEnv("production");
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    process.env.AUTH_SECRET = "a-real-secret";
    process.env.AUTH_TRUST_HOST = "true";
    process.env.STORAGE_ROOT = "/var/lib/school-library/storage";
  }

  test("is a no-op outside production, even with everything missing", () => {
    expect(() => validateProductionEnv()).not.toThrow();
  });

  test("does not throw when all required production config is present", () => {
    setValidProductionEnv();
    expect(() => validateProductionEnv()).not.toThrow();
  });

  test("throws when DATABASE_URL is missing", () => {
    setValidProductionEnv();
    delete process.env.DATABASE_URL;
    expect(() => validateProductionEnv()).toThrow(/DATABASE_URL/);
  });

  test("throws when AUTH_SECRET is missing", () => {
    setValidProductionEnv();
    delete process.env.AUTH_SECRET;
    expect(() => validateProductionEnv()).toThrow(/AUTH_SECRET/);
  });

  test("throws when AUTH_TRUST_HOST is missing", () => {
    setValidProductionEnv();
    delete process.env.AUTH_TRUST_HOST;
    expect(() => validateProductionEnv()).toThrow(/AUTH_TRUST_HOST/);
  });

  test("throws when STORAGE_ROOT is missing", () => {
    setValidProductionEnv();
    delete process.env.STORAGE_ROOT;
    expect(() => validateProductionEnv()).toThrow(/STORAGE_ROOT/);
  });

  test("lists every missing variable in a single combined error", () => {
    setNodeEnv("production");

    try {
      validateProductionEnv();
      expect.unreachable("expected validateProductionEnv to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("AUTH_SECRET");
      expect(message).toContain("AUTH_TRUST_HOST");
      expect(message).toContain("STORAGE_ROOT");
    }
  });

  test("never leaks the actual DATABASE_URL/AUTH_SECRET values in the error message", () => {
    setNodeEnv("production");
    process.env.DATABASE_URL = "postgresql://secret-user:secret-pass@10.0.0.5:5432/db";
    process.env.AUTH_SECRET = "super-secret-value";

    try {
      validateProductionEnv();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain("secret-pass");
      expect(message).not.toContain("super-secret-value");
      expect(message).not.toContain("10.0.0.5");
    }
  });

  test("throws when STORAGE_ROOT is a relative path, not just when it's missing", () => {
    setValidProductionEnv();
    process.env.STORAGE_ROOT = "storage_local";
    expect(() => validateProductionEnv()).toThrow(/STORAGE_ROOT must be an absolute path/);
  });

  test("does not require MAX_UPLOAD_SIZE_MB — unset uses the intentional 10 MB default", () => {
    setValidProductionEnv();
    expect(() => validateProductionEnv()).not.toThrow();
  });

  test.each(["0", "-5", "not-a-number"])(
    "throws when MAX_UPLOAD_SIZE_MB is set but invalid (%s)",
    (value) => {
      setValidProductionEnv();
      process.env.MAX_UPLOAD_SIZE_MB = value;
      expect(() => validateProductionEnv()).toThrow(/MAX_UPLOAD_SIZE_MB must be a positive number/);
    }
  );

  test("does not throw when MAX_UPLOAD_SIZE_MB is a valid positive number", () => {
    setValidProductionEnv();
    process.env.MAX_UPLOAD_SIZE_MB = "25";
    expect(() => validateProductionEnv()).not.toThrow();
  });

  test("does not require APP_URL — it stays optional in production", () => {
    setValidProductionEnv();
    expect(() => validateProductionEnv()).not.toThrow();
  });

  test("throws when APP_URL is set but not a valid http(s) URL", () => {
    setValidProductionEnv();
    process.env.APP_URL = "not-a-url";
    expect(() => validateProductionEnv()).toThrow(/APP_URL must be a valid absolute URL/);
  });

  test("throws when APP_URL uses a non-http(s) protocol", () => {
    setValidProductionEnv();
    process.env.APP_URL = "ftp://library.example.com";
    expect(() => validateProductionEnv()).toThrow(/APP_URL must use http:\/\/ or https:\/\//);
  });

  test("does not throw when APP_URL is a valid https URL", () => {
    setValidProductionEnv();
    process.env.APP_URL = "https://library.example.com";
    expect(() => validateProductionEnv()).not.toThrow();
  });
});
