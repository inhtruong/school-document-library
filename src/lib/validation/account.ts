import { z } from "zod";
import { registerSchema } from "@/lib/validation/auth";

export const updateProfileSchema = z.object({
  name: registerSchema.shape.name,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    // Same rule as registration — bcrypt's 72-byte cap and the 8-char
    // minimum must never drift between the two flows.
    newPassword: registerSchema.shape.password,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
