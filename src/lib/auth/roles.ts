import type { Role } from "@prisma/client";

/** Single source of truth for the 3 Role values — the role-filter dropdown, the role-change select, and updateUserRoleSchema all read from this one list. */
export const ROLE_VALUES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];

/** Maps a Role to its `common.roles.*` message key — the display copy already exists there (used by the profile page), reused here instead of a second labels map. */
export function roleMessageKey(role: Role): "student" | "teacher" | "admin" {
  if (role === "STUDENT") return "student";
  if (role === "TEACHER") return "teacher";
  return "admin";
}
