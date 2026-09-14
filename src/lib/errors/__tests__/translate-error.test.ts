import { afterEach, describe, expect, test } from "vitest";
import { __resetTestLocale, __setTestLocale } from "@test/next-intl-server-stub";
import { encodeErrorCode, translateErrorCode } from "@/lib/errors/translate-error";

afterEach(() => {
  __resetTestLocale();
});

describe("translateErrorCode — default locale", () => {
  test("resolves a plain validation code to Vietnamese by default", async () => {
    const message = await translateErrorCode("VALIDATION_NAME_REQUIRED");
    expect(message).toBe("Vui lòng nhập tên");
  });
});

describe("translateErrorCode — explicit locale", () => {
  test("resolves the same code to English once the request locale is en", async () => {
    __setTestLocale("en");
    const message = await translateErrorCode("VALIDATION_NAME_REQUIRED");
    expect(message).toBe("Name is required");
  });
});

describe("translateErrorCode — parameterized codes", () => {
  test("interpolates the {max} value in vi", async () => {
    const message = await translateErrorCode(encodeErrorCode("VALIDATION_COMMENT_TOO_LONG", 500));
    expect(message).toBe("Bình luận tối đa 500 ký tự");
  });

  test("interpolates the {max} value in en", async () => {
    __setTestLocale("en");
    const message = await translateErrorCode(encodeErrorCode("VALIDATION_COMMENT_TOO_LONG", 500));
    expect(message).toBe("Comment must be 500 characters or fewer");
  });

  test("interpolates the {size} value for an upload-too-large code", async () => {
    __setTestLocale("en");
    const message = await translateErrorCode(encodeErrorCode("UPLOAD_FILE_TOO_LARGE", 100));
    expect(message).toBe("File exceeds the 100 MB limit");
  });
});

describe("translateErrorCode — generic fallback for unrecognized input", () => {
  test("falls back to the generic unexpected-error message in vi and never returns the raw input", async () => {
    const message = await translateErrorCode("some legacy prose that is not a real code");
    expect(message).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
    expect(message).not.toBe("some legacy prose that is not a real code");
  });

  test("falls back to the generic unexpected-error message in en and never returns the raw input", async () => {
    __setTestLocale("en");
    const message = await translateErrorCode("some legacy prose that is not a real code");
    expect(message).toBe("Something went wrong. Please try again.");
    expect(message).not.toBe("some legacy prose that is not a real code");
  });
});

describe("translateErrorCode — security-sensitive parity", () => {
  test("AUTH_INVALID_CREDENTIALS never distinguishes unknown-email from wrong-password in either locale", async () => {
    const viMessage = await translateErrorCode("AUTH_INVALID_CREDENTIALS");
    __setTestLocale("en");
    const enMessage = await translateErrorCode("AUTH_INVALID_CREDENTIALS");

    // Exactly one shared code for both "no such account" and "wrong
    // password" (see authenticateCredentials, which returns null for
    // either case indistinguishably) — the resolved text in both locales
    // must mention email and password together as one generic pairing,
    // never naming just one of them (which would leak which was wrong).
    expect(viMessage.toLowerCase()).toMatch(/email/);
    expect(viMessage.toLowerCase()).toMatch(/mật khẩu/);
    expect(enMessage.toLowerCase()).toMatch(/email/);
    expect(enMessage.toLowerCase()).toMatch(/password/);
  });

  test("no raw error code ever survives as the resolved message, for every code in the registry", async () => {
    const { ERROR_CODE_MESSAGE_KEYS } = await import("@/lib/errors/error-codes");
    for (const code of Object.keys(ERROR_CODE_MESSAGE_KEYS)) {
      const message = await translateErrorCode(code);
      expect(message).not.toBe(code);
    }
  });
});
