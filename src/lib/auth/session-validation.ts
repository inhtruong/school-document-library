import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type SessionValidationUser = { id: string; name: string; role: Role; sessionVersion: number };

/**
 * Request-memoized DB lookup backing the jwt() callback's per-request
 * sessionVersion validation (see session.ts). next-auth's `auth()` has no
 * built-in request memoization — verified directly against its installed
 * source (node_modules/next-auth/lib/index.js's initAuth()/getSession()
 * contain no cache()/dedup of any kind) — and several pages already call
 * auth() more than once per request (e.g. SiteHeader plus the page's own
 * requireAuth()). Without this, each of those calls would trigger its own
 * `findUnique`. React's cache() collapses same-argument calls within a
 * single request into one query, the standard Next.js pattern for this.
 */
export const getUserForSessionValidation = cache(
  async (userId: string): Promise<SessionValidationUser | null> => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, sessionVersion: true },
    });
  }
);
