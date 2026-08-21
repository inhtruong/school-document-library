import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/validation/auth";

export type RegisteredUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT";
};

export type RegisterResult =
  | { success: true; user: RegisteredUser }
  | { success: false; error: string; status: 400 | 409 };

/** Public registration always creates a STUDENT — role is never accepted from the caller. */
export async function registerStudent(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid registration data",
      status: 400,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists", status: 409 };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: "STUDENT",
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return { success: true, user: user as RegisteredUser };
}
