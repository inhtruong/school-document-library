import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditActor } from "@/lib/audit/audit";
import { writeAuditLog } from "@/lib/audit/audit";
import { ADMIN_USERS_PAGE_SIZE } from "@/lib/admin/admin-users-config";

const SAFE_USER_SELECT = { id: true, name: true, email: true, role: true, createdAt: true } as const;

export type AdminUserListItem = { id: string; name: string; email: string; role: Role; createdAt: Date };

export type AdminUserFilter = { search?: string; role?: Role };

export type AdminUserListPage = {
  users: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * Admin-only browse — never selects passwordHash/sessionVersion. Same
 * skip/take + Promise.all([findMany, count]) shape as listAuditLogs(), same
 * case-insensitive `contains` search as its actorEmail filter.
 */
export async function listAdminUsers(filter: AdminUserFilter, page: number): Promise<AdminUserListPage> {
  const skip = (page - 1) * ADMIN_USERS_PAGE_SIZE;
  const where: Prisma.UserWhereInput = {
    ...(filter.search
      ? {
          OR: [
            { name: { contains: filter.search, mode: "insensitive" } },
            { email: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filter.role ? { role: filter.role } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_USERS_PAGE_SIZE,
      select: SAFE_USER_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, totalPages: Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE)) };
}

export type AdminUserDetail = AdminUserListItem & {
  counts: { uploadedDocuments: number; comments: number; ratings: number; reports: number };
};

/** One query, no N+1 — the 4 counts come from the same `_count` select as the row itself. */
export async function getAdminUserById(id: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...SAFE_USER_SELECT,
      _count: { select: { uploadedDocuments: true, comments: true, ratings: true, reports: true } },
    },
  });
  if (!user) return null;

  const { _count, ...rest } = user;
  return { ...rest, counts: _count };
}

export type UpdateUserRoleOutcome =
  | { outcome: "success"; user: AdminUserListItem }
  | { outcome: "not-found" }
  | { outcome: "last-admin" }
  | { outcome: "conflict" };

function isSerializationFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

/**
 * ADMIN-only, security-sensitive. Self-role-change is rejected by the
 * caller (the route) before this is ever invoked — this function only
 * enforces the "last admin" guard, which is an aggregate count over *other*
 * rows and can't be folded into the updated row's own WHERE clause the way
 * moderation's single-row `updateMany` guard does. Run at Serializable
 * isolation so two concurrent demotions of the last two admins can't both
 * succeed — Postgres aborts one with a P2034 write-conflict error, mapped
 * below to a safe "please retry" outcome (this codebase has no precedent
 * for Serializable transactions yet; documented here as new, deliberate,
 * and scoped to only this one transaction).
 */
export async function updateUserRole(
  targetId: string,
  newRole: Role,
  actor: AuditActor
): Promise<UpdateUserRoleOutcome> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({ where: { id: targetId }, select: SAFE_USER_SELECT });
        if (!existing) return { outcome: "not-found" };

        if (existing.role === newRole) return { outcome: "success", user: existing };

        if (existing.role === "ADMIN") {
          const otherAdmins = await tx.user.count({ where: { role: "ADMIN", id: { not: targetId } } });
          if (otherAdmins === 0) return { outcome: "last-admin" };
        }

        const updated = await tx.user.update({
          where: { id: targetId },
          data: { role: newRole, sessionVersion: { increment: 1 } },
          select: SAFE_USER_SELECT,
        });

        await writeAuditLog(
          {
            actor,
            action: "USER_ROLE_CHANGED",
            entityType: "USER",
            entityId: targetId,
            metadata: { oldRole: existing.role, newRole, sessionsInvalidated: true },
          },
          tx
        );

        return { outcome: "success", user: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (isSerializationFailure(error)) return { outcome: "conflict" };
    throw error;
  }
}
