import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validation/account";

export type ChangePasswordResult = { success: true } | { success: false; error: string; status: 400 | 401 };

/**
 * `userId` always comes from the caller's authenticated session — never
 * from `input` — so only ever the caller's own password can be changed.
 * Shape validation runs before any database access; the current-password
 * check runs before the new hash is ever computed, so a wrong current
 * password never touches `passwordHash`.
 */
export async function changePassword(userId: string, input: unknown): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid password data",
      status: 400,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return { success: false, error: "Account not found", status: 401 };

  const isCurrentPasswordValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    return { success: false, error: "Current password is incorrect", status: 401 };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { success: true };
}
