import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/audit";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/auth";

/** Never fails the caller — a transient audit-write hiccup must never block sign-in either direction (FEAT-11 §8/§37, best-effort). */
async function auditLogin(outcome: "success" | "failure", email: string, user?: { id: string; role: Role }) {
  try {
    if (outcome === "success" && user) {
      await writeAuditLog({
        actor: { id: user.id, email, role: user.role },
        action: "USER_LOGGED_IN",
        entityType: "USER",
        entityId: user.id,
      });
    } else {
      // No `actor` — the attempt never resolved to a real, authenticated
      // user (wrong password or unknown email are deliberately NOT
      // distinguished here, even internally, to avoid the audit log
      // itself becoming an account-enumeration oracle). `attemptedEmail`
      // is the input as typed — never the password.
      await writeAuditLog({
        actor: null,
        action: "USER_LOGIN_FAILED",
        entityType: "USER",
        status: "FAILURE",
        metadata: { attemptedEmail: email },
      });
    }
  } catch (error) {
    console.error(`Audit log write failed for login ${outcome}`, error);
  }
}

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  sessionVersion: number;
};

/**
 * Returns the matching user, or null for any invalid input/unknown
 * email/wrong password — never throws for bad credentials.
 *
 * FEAT-11 §8: a malformed submission (failed `loginSchema` parse — e.g. an
 * empty form post) is NOT audited as a login failure — there was no real
 * email to attribute the attempt to, and auditing every malformed request
 * would just be noise (§37: "avoid enormous noisy logs"). Only a
 * well-formed attempt (a real email + password shape) that then fails to
 * authenticate produces a USER_LOGIN_FAILED row.
 */
export async function authenticateCredentials(credentials: unknown): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    await auditLogin("failure", parsed.data.email);
    return null;
  }

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!isValid) {
    await auditLogin("failure", parsed.data.email);
    return null;
  }

  await auditLogin("success", user.email, { id: user.id, role: user.role });
  return { id: user.id, name: user.name, email: user.email, role: user.role, sessionVersion: user.sessionVersion };
}
