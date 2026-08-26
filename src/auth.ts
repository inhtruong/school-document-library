import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateCredentials } from "@/lib/auth/authenticate";
import { attachTokenToSession, attachUserToToken } from "@/lib/auth/session";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-config";

// `jwt.maxAge` is not set separately — Auth.js defaults it to
// `session.maxAge` when omitted (verified in @auth/core/lib/init.js:
// `maxAge: config.session?.maxAge ?? maxAge // default to same as
// session.maxAge`), so setting it again here would just be a redundant
// duplicate of this same constant.
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authenticateCredentials,
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => attachUserToToken(token, user),
    session: ({ session, token }) => attachTokenToSession(session, token),
  },
});
