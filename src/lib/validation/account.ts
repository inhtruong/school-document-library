import { z } from "zod";
import { registerSchema } from "@/lib/validation/auth";

export const updateProfileSchema = z.object({
  name: registerSchema.shape.name,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "VALIDATION_CURRENT_PASSWORD_REQUIRED"),
    // Same rule as registration — bcrypt's 72-byte cap and the 8-char
    // minimum must never drift between the two flows.
    newPassword: registerSchema.shape.password,
    confirmPassword: z.string().min(1, "VALIDATION_CONFIRM_PASSWORD_REQUIRED"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "VALIDATION_PASSWORD_MISMATCH",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "VALIDATION_PASSWORD_SAME_AS_CURRENT",
    path: ["newPassword"],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
