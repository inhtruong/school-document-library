import { describe, expect, test } from "vitest";
import { decode, encode } from "next-auth/jwt";

/**
 * Expiry itself is enforced by Auth.js's own JWT decode step, before our
 * jwt() callback (attachUserToToken) is ever invoked — an expired cookie
 * never reaches our code at all. `decode()` in isolation actually THROWS
 * (jose's `JWTExpired`) rather than returning null for an expired token —
 * confirmed directly against @auth/core's source. In the real request
 * flow, Auth.js's own session() action handler
 * (@auth/core/lib/actions/session.js) wraps the whole decode+jwt-callback
 * sequence in a try/catch and, on ANY error, cleans the session cookie and
 * leaves the response body unset — so `auth()` still correctly resolves
 * to "no session" end-to-end. This test verifies the throw directly
 * (the actual, verified behavior of the primitive we depend on) rather
 * than assuming decode() itself returns null.
 */
describe("expired JWTs", () => {
  test("decode() throws for a token encoded with a negative maxAge (caught upstream by Auth.js's session handler, which cleans the cookie and returns no session)", async () => {
    const salt = "test-salt";
    const secret = "test-secret-at-least-32-bytes-long!!";

    const token = await encode({
      salt,
      secret,
      maxAge: -60, // already expired the moment it was issued
      token: { id: "user_1", role: "STUDENT", sessionVersion: 0 },
    });

    await expect(decode({ salt, secret, token })).rejects.toThrow(/exp.*claim|expired/i);
  });

  test("decode() returns the payload for a token still within its maxAge", async () => {
    const salt = "test-salt";
    const secret = "test-secret-at-least-32-bytes-long!!";

    const token = await encode({
      salt,
      secret,
      maxAge: 60 * 60,
      token: { id: "user_1", role: "STUDENT", sessionVersion: 0 },
    });

    const decoded = await decode({ salt, secret, token });

    expect(decoded?.id).toBe("user_1");
  });
});
