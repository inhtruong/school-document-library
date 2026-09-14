import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/audit";
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
      error: parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC",
      status: 400,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { success: false, error: "AUTH_EMAIL_ALREADY_EXISTS", status: 409 };
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

  // Best-effort (FEAT-11 §37) — the account already exists at this point;
  // a transient audit-write hiccup must never turn a successful
  // registration into a failed one.
  try {
    await writeAuditLog({
      actor: { id: user.id, email: user.email, role: user.role },
      action: "USER_REGISTERED",
      entityType: "USER",
      entityId: user.id,
    });
  } catch (error) {
    console.error("Audit log write failed for USER_REGISTERED", error);
  }

  return { success: true, user: user as RegisteredUser };
}
