import { z } from "zod";
import { ROLE_VALUES } from "@/lib/auth/roles";

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLE_VALUES, { error: "VALIDATION_ROLE_INVALID" }),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
