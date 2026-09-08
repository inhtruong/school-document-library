import "server-only";
import type { AuditAction, AuditEntityType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Server-derived only — never accepted from a request body. Every call
 * site builds this from `session.user` (or `null` for an unauthenticated
 * action, none of which currently exist in FEAT-11's action list, but the
 * type stays honest about the possibility rather than forcing a fake
 * actor). Clients must never be able to choose `actorUserId`/`actorEmail`/
 * `actorRole` — see this file's `writeAuditLog` doc comment.
 *
 * `role` is nullable, matching the DB column — a caller that knows the
 * actor's id but not (yet) their role passes `null` rather than a
 * fabricated guess (FEAT-11 §29: "Do not fabricate an actor").
 */
export type AuditActor = { id: string; email: string | null; role: Role | null };

export type WriteAuditLogInput = {
  actor: AuditActor | null;
  action: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  /** Defaults to SUCCESS — only USER_LOGIN_FAILED currently ever passes FAILURE. */
  status?: "SUCCESS" | "FAILURE";
  /**
   * Safe, compact JSON only. NEVER pass a password, password hash, JWT,
   * session cookie, reset token, Authorization header, or a raw request
   * body — this helper does not scan for those, so every call site is
   * responsible for only ever constructing a small, purpose-built object
   * (e.g. `{ changedFields, moderationTransition }`), never forwarding
   * arbitrary input through untouched.
   */
  metadata?: Prisma.InputJsonValue;
};

/**
 * The ONLY place allowed to insert an AuditLog row (FEAT-11 §36) — every
 * business action calls this rather than touching `prisma.auditLog.create`
 * directly, so the actor-snapshot shape and the "never log secrets"
 * discipline live in exactly one function instead of being re-implemented
 * at every call site.
 *
 * Accepts an optional Prisma transaction client so a critical business
 * mutation (approve/reject/resubmit/password change/document update or
 * delete/upload) can commit its audit row in the SAME transaction as the
 * mutation itself — see each call site for why. Defaults to the module
 * singleton for best-effort call sites (login, comments, reports, profile
 * update) where the audit write is intentionally non-transactional.
 *
 * Never edits, never deletes — append-only by construction, since this is
 * the only write path this model has (FEAT-11 §6).
 */
export async function writeAuditLog(
  input: WriteAuditLogInput,
  client: Prisma.TransactionClient = prisma
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorUserId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      actorRole: input.actor?.role ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      status: input.status ?? "SUCCESS",
      metadata: input.metadata ?? undefined,
    },
  });
}

/** Builds the actor snapshot from an authenticated session's user — the one place call sites should read `session.user` into an `AuditActor`, so the `email ?? null` normalization isn't repeated at every call site. */
export function actorFromSessionUser(user: { id: string; email?: string | null; role: Role }): AuditActor {
  return { id: user.id, email: user.email ?? null, role: user.role };
}
