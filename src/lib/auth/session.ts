import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

/** jwt() callback body: copies id/role onto the token the first time (sign-in), when `user` is present. */
export function attachUserToToken(token: JWT, user?: User | null): JWT {
  if (user) {
    token.id = user.id;
    token.role = user.role;
  }
  return token;
}

/** session() callback body: exposes id/role from the token on the client-facing session. */
export function attachTokenToSession(session: Session, token: JWT): Session {
  session.user.id = token.id;
  session.user.role = token.role;
  return session;
}
