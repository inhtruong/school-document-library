import { describe, expect, test } from "vitest";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-config";

describe("SESSION_MAX_AGE_SECONDS", () => {
  test("is configured to approximately 1 hour, not the Auth.js 30-day default", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60);
  });

  test("is well under a single day", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBeLessThan(24 * 60 * 60);
  });
});
