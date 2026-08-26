import "server-only";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { getUserForSessionValidation } from "@/lib/auth/session-validation";

/**
 * jwt() callback body.
 *
 * - Sign-in (`user` present): seed id/role/sessionVersion straight from
 *   the just-authenticated DB user (authenticateCredentials's return
 *   value) — never trust anything else for these.
 * - Every later request (`user` absent): re-validate against the CURRENT
 *   DB row. A sessionVersion mismatch (password changed since this token
 *   was issued) or a deleted user invalidates the token by returning
 *   null — Auth.js then treats `auth()` as fully unauthenticated, so
 *   every existing guest code path (requireAuth's redirect, API 401s,
 *   etc.) handles it automatically with no special "session expired"
 *   branch anywhere else in the app.
 *
 *   Role and name are refreshed from that same DB row on every request:
 *   it's already loaded for the sessionVersion check, so keeping both
 *   current costs nothing extra. This is what fixes the staleness FEAT-9
 *   observed (Header showing the pre-change name, and — had an
 *   Admin role-management feature existed — a stale role) for the rest
 *   of the token's lifetime.
 */
export async function attachUserToToken(token: JWT, user?: User | null): Promise<JWT | null> {
  if (user) {
    token.id = user.id;
    token.role = user.role;
    token.sessionVersion = user.sessionVersion;
    return token;
  }

  if (!token.id) return null;

  const dbUser = await getUserForSessionValidation(token.id);
  if (!dbUser || dbUser.sessionVersion !== token.sessionVersion) return null;

  token.role = dbUser.role;
  token.name = dbUser.name;
  return token;
}

/** session() callback body: exposes id/role from the token on the client-facing session. */
export function attachTokenToSession(session: Session, token: JWT): Session {
  session.user.id = token.id;
  session.user.role = token.role;
  return session;
}
