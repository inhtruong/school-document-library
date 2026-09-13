import { describe, expect, test } from "vitest";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE_NAME, isLocale, resolveLocale } from "@/i18n/locales";

describe("FEAT-13: locale constants", () => {
  test("supports exactly vi and en", () => {
    expect(LOCALES).toEqual(["vi", "en"]);
  });

  test("default locale is vi", () => {
    expect(DEFAULT_LOCALE).toBe("vi");
  });

  test("locale cookie has a stable, non-empty name", () => {
    expect(LOCALE_COOKIE_NAME).toBe("NEXT_LOCALE");
  });
});

describe("isLocale", () => {
  test("accepts vi and en", () => {
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  test("rejects anything else, including null/undefined/empty", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("VI")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("resolveLocale", () => {
  test("a valid cookie value passes through unchanged", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("vi")).toBe("vi");
  });

  test("a missing cookie (null/undefined) falls back to the default locale", () => {
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  test("an invalid/unsupported cookie value falls back to the default locale, never throws", () => {
    expect(resolveLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("<script>")).toBe(DEFAULT_LOCALE);
  });
});
