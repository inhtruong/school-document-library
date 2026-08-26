import "server-only";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validation/account";

export type UpdatedProfile = { id: string; name: string };

export type ProfileUpdateResult =
  | { success: true; user: UpdatedProfile }
  | { success: false; error: string; status: 400 };

/** `userId` always comes from the caller's authenticated session — never from `input` — so only ever the caller's own row can be targeted. */
export async function updateProfileName(userId: string, input: unknown): Promise<ProfileUpdateResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid profile data",
      status: 400,
    };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: parsed.data.name },
    select: { id: true, name: true },
  });

  return { success: true, user };
}
