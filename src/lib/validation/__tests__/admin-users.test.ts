import { describe, expect, test } from "vitest";
import { updateUserRoleSchema } from "@/lib/validation/admin-users";

describe("updateUserRoleSchema", () => {
  test.each(["STUDENT", "TEACHER", "ADMIN"] as const)("accepts role %s", (role) => {
    const result = updateUserRoleSchema.safeParse({ role });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ role });
  });

  test("rejects an invalid role", () => {
    const result = updateUserRoleSchema.safeParse({ role: "SUPERADMIN" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("VALIDATION_ROLE_INVALID");
  });

  test("rejects a missing role", () => {
    const result = updateUserRoleSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
