// No "server-only" guard — this module is invoked by prisma/create-admin.ts
// via plain `tsx` (not through Next's server/client bundler), which is
// incompatible with the "server-only" package (confirmed via a real
// runtime failure). See the same note in src/lib/env.ts.
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";

export type CreateAdminInput = { name: string; email: string; password: string };

export type CreateAdminResult =
  | { success: true; user: { id: string; name: string; email: string } }
  | { success: false; error: string };

/**
 * The one supported way to create an ADMIN account outside of manual DB
 * access — there is no Admin registration page. Reuses the same
 * name/email/password validation as public registration (`registerSchema`)
 * so an admin account can never be created with a weaker password than a
 * normal one; only `role: "ADMIN"` differs from `registerStudent()`. Meant
 * to be run once per deployment via `npm run create-admin`
 * (`prisma/create-admin.ts`), not exposed as an API route.
 */
export async function createAdminUser(input: CreateAdminInput): Promise<CreateAdminResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid admin account details" };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: "ADMIN" },
    select: { id: true, name: true, email: true },
  });

  return { success: true, user };
}
