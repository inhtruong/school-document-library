import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/auth";

/** Pure role check — no redirect side effect, safe to unit test directly. */
export function hasRole(session: Session | null, role: Role | Role[]): boolean {
  if (!session?.user) return false;
  const allowed = Array.isArray(role) ? role : [role];
  return allowed.includes(session.user.role);
}

/** Redirects guests to /login. Use in Server Components/Route Handlers that require any signed-in user. */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/** Redirects unauthenticated users to /login and users with the wrong role to /. */
export async function requireRole(role: Role | Role[]): Promise<Session> {
  const session = await requireAuth();
  if (!hasRole(session, role)) redirect("/");
  return session;
}
