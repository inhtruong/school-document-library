import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "VALIDATION_NAME_REQUIRED").max(100, "VALIDATION_NAME_TOO_LONG"),
  email: z.string().trim().toLowerCase().email("VALIDATION_EMAIL_INVALID"),
  // bcrypt silently ignores bytes past 72; capping length keeps hashing behavior well-defined.
  password: z.string().min(8, "VALIDATION_PASSWORD_TOO_SHORT").max(72, "VALIDATION_PASSWORD_TOO_LONG"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("VALIDATION_EMAIL_INVALID"),
  password: z.string().min(1, "VALIDATION_PASSWORD_REQUIRED"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
