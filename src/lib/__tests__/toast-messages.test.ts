import { describe, expect, test } from "vitest";
import {
  TOAST_KEYS,
  TOAST_VARIANT_STYLES,
  isToastKey,
  resolveFeedback,
  type ToastMessages,
} from "@/lib/toast-messages";

/** A fake, locale-independent messages map — mirrors what ToastListener builds from `useTranslations("toast")` in the real app, keeping this file free of any next-intl/React dependency. */
const FAKE_MESSAGES: ToastMessages = {
  [TOAST_KEYS.accountCreated]: "account created",
  [TOAST_KEYS.loggedIn]: "logged in",
  [TOAST_KEYS.loggedOut]: "logged out",
  [TOAST_KEYS.uploadSuccess]: "upload success",
  [TOAST_KEYS.uploadPendingReview]: "upload pending review",
  [TOAST_KEYS.passwordChanged]: "password changed",
};

describe("isToastKey", () => {
  test("returns true only for known keys", () => {
    expect(isToastKey(TOAST_KEYS.accountCreated)).toBe(true);
    expect(isToastKey(TOAST_KEYS.loggedIn)).toBe(true);
    expect(isToastKey(TOAST_KEYS.loggedOut)).toBe(true);
    expect(isToastKey(TOAST_KEYS.uploadSuccess)).toBe(true);
    expect(isToastKey(TOAST_KEYS.uploadPendingReview)).toBe(true);
  });

  test("rejects unknown or missing values", () => {
    expect(isToastKey("not-a-real-key")).toBe(false);
    expect(isToastKey(null)).toBe(false);
    expect(isToastKey("")).toBe(false);
  });
});

describe("resolveFeedback", () => {
  test("a known toast key resolves to a success message from the injected messages map", () => {
    const actions = resolveFeedback({ toast: TOAST_KEYS.loggedIn, error: null, notify: null }, FAKE_MESSAGES);
    expect(actions).toEqual([{ variant: "success", message: FAKE_MESSAGES[TOAST_KEYS.loggedIn] }]);
  });

  test("error text with notify resolves to an error message (action-level failure)", () => {
    const actions = resolveFeedback(
      { toast: null, error: "An account with this email already exists", notify: "1" },
      FAKE_MESSAGES
    );
    expect(actions).toEqual([{ variant: "error", message: "An account with this email already exists" }]);
  });

  test("error text without notify resolves to no toast (validation stays inline-only)", () => {
    const actions = resolveFeedback({ toast: null, error: "Unsupported file type", notify: null }, FAKE_MESSAGES);
    expect(actions).toEqual([]);
  });

  test("an unknown toast key is ignored", () => {
    const actions = resolveFeedback({ toast: "not-a-real-key", error: null, notify: null }, FAKE_MESSAGES);
    expect(actions).toEqual([]);
  });

  test("no params resolves to no toasts", () => {
    expect(resolveFeedback({ toast: null, error: null, notify: null }, FAKE_MESSAGES)).toEqual([]);
  });
});

describe("TOAST_VARIANT_STYLES", () => {
  test("defines a distinct, non-empty style for success, warning, and error", () => {
    const variants = ["success", "warning", "error"] as const;
    for (const variant of variants) {
      expect(TOAST_VARIANT_STYLES[variant]).toBeTypeOf("string");
      expect(TOAST_VARIANT_STYLES[variant].length).toBeGreaterThan(0);
    }
    const values = variants.map((v) => TOAST_VARIANT_STYLES[v]);
    expect(new Set(values).size).toBe(values.length);
  });

  test("each variant's color family matches its semantic meaning", () => {
    expect(TOAST_VARIANT_STYLES.success).toMatch(/green/);
    expect(TOAST_VARIANT_STYLES.warning).toMatch(/amber|yellow|orange/);
    expect(TOAST_VARIANT_STYLES.error).toMatch(/red/);
  });
});
