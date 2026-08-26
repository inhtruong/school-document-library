import type { Role } from "@prisma/client";

declare module "next-auth" {
  // Deliberately NOT `& DefaultSession["user"]` — in @auth/core,
  // `DefaultSession["user"]` is itself typed as the full (augmentable)
  // `User` interface below, which would silently pull sessionVersion back
  // onto Session.user despite attachTokenToSession never setting it there.
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    role: Role;
    /** Never surfaced on Session.user — internal-only, see session.ts. */
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    sessionVersion: number;
  }
}
