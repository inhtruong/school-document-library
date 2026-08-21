import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/auth";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
};

/** Returns the matching user, or null for any invalid input/unknown email/wrong password — never throws for bad credentials. */
export async function authenticateCredentials(credentials: unknown): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return null;

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!isValid) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
