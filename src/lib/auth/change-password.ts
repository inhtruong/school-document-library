import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/audit";
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
      error: parsed.error.issues[0]?.message ?? "VALIDATION_GENERIC",
      status: 400,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, email: true, role: true },
  });
  if (!user) return { success: false, error: "AUTH_ACCOUNT_NOT_FOUND", status: 401 };

  const isCurrentPasswordValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    return { success: false, error: "AUTH_CURRENT_PASSWORD_INCORRECT", status: 401 };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  // FEAT-11 §20/§37: the update and its audit row now commit in the SAME
  // transaction — a failed audit write rolls back the password change
  // too, so a security-critical mutation is never left un-audited.
  // Incrementing sessionVersion here immediately invalidates every JWT
  // issued before this moment (including the one used to make this very
  // request), since attachUserToToken's per-request DB check will see the
  // new value on this token's next use.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await writeAuditLog(
      {
        actor: { id: userId, email: user.email, role: user.role },
        action: "PASSWORD_CHANGED",
        entityType: "USER",
        entityId: userId,
        metadata: { sessionsInvalidated: true },
      },
      tx
    );
  });

  return { success: true };
}
