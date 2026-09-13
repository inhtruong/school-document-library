import { beforeEach, describe, expect, test, vi } from "vitest";

const mockSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mockSet })),
}));

import { setLocaleAction } from "@/lib/i18n/set-locale-action";
import { LOCALE_COOKIE_NAME } from "@/i18n/locales";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setLocaleAction", () => {
  test("writes the locale cookie under the shared LOCALE_COOKIE_NAME", async () => {
    await setLocaleAction("en");

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [name, value] = mockSet.mock.calls[0];
    expect(name).toBe(LOCALE_COOKIE_NAME);
    expect(value).toBe("en");
  });

  test("persists for a long time (a preference, not a session) and applies site-wide", async () => {
    await setLocaleAction("vi");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.path).toBe("/");
    expect(options.maxAge).toBeGreaterThan(60 * 60 * 24 * 30); // well over 30 days
  });

  test("never touches any auth/session cookie name", async () => {
    await setLocaleAction("en");

    const [name] = mockSet.mock.calls[0];
    expect(name).not.toMatch(/session|auth/i);
  });
});
