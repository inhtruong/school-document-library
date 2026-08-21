import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateCredentials } from "@/lib/auth/authenticate";
import { attachTokenToSession, attachUserToToken } from "@/lib/auth/session";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
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
