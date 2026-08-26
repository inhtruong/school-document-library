import { z } from "zod";
import { registerSchema } from "@/lib/validation/auth";

export const updateProfileSchema = z.object({
  name: registerSchema.shape.name,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
