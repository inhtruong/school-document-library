import { describe, expect, test } from "vitest";
import {
  TOAST_KEYS,
  TOAST_MESSAGES,
  TOAST_VARIANT_STYLES,
  isToastKey,
  resolveFeedback,
} from "@/lib/toast-messages";

describe("toast-messages", () => {
  test("every TOAST_KEYS value has a matching message", () => {
    for (const key of Object.values(TOAST_KEYS)) {
      expect(TOAST_MESSAGES[key]).toBeTypeOf("string");
      expect(TOAST_MESSAGES[key].length).toBeGreaterThan(0);
    }
  });

  test("isToastKey returns true only for known keys", () => {
    expect(isToastKey(TOAST_KEYS.accountCreated)).toBe(true);
    expect(isToastKey(TOAST_KEYS.loggedIn)).toBe(true);
    expect(isToastKey(TOAST_KEYS.loggedOut)).toBe(true);
    expect(isToastKey(TOAST_KEYS.uploadSuccess)).toBe(true);
  });

  test("isToastKey rejects unknown or missing values", () => {
    expect(isToastKey("not-a-real-key")).toBe(false);
    expect(isToastKey(null)).toBe(false);
    expect(isToastKey("")).toBe(false);
  });
});

describe("resolveFeedback", () => {
  test("a known toast key resolves to a success message", () => {
    const actions = resolveFeedback({
      toast: TOAST_KEYS.loggedIn,
      error: null,
      notify: null,
    });
    expect(actions).toEqual([
      { variant: "success", message: TOAST_MESSAGES[TOAST_KEYS.loggedIn] },
    ]);
  });

  test("error text with notify resolves to an error message (action-level failure)", () => {
    const actions = resolveFeedback({
      toast: null,
      error: "An account with this email already exists",
      notify: "1",
    });
    expect(actions).toEqual([
      { variant: "error", message: "An account with this email already exists" },
    ]);
  });

  test("error text without notify resolves to no toast (validation stays inline-only)", () => {
    const actions = resolveFeedback({
      toast: null,
      error: "Unsupported file type",
      notify: null,
    });
    expect(actions).toEqual([]);
  });

  test("an unknown toast key is ignored", () => {
    const actions = resolveFeedback({ toast: "not-a-real-key", error: null, notify: null });
    expect(actions).toEqual([]);
  });

  test("no params resolves to no toasts", () => {
    expect(resolveFeedback({ toast: null, error: null, notify: null })).toEqual([]);
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
