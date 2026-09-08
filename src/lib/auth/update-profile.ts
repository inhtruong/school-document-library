import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/audit";
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

  // FEAT-11 §18/§21: fetched first so a resubmission of the current name
  // (a true no-op) gets no audit row, mirroring the same rule already
  // established for Document edits.
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: parsed.data.name },
    select: { id: true, name: true },
  });

  if (before && before.name !== user.name) {
    // Best-effort (FEAT-11 §37) — profile update is not on the critical/
    // transactional list; a transient audit hiccup must not fail a
    // successful, low-risk name change.
    try {
      await writeAuditLog({
        actor: { id: userId, email: before.email, role: before.role },
        action: "PROFILE_UPDATED",
        entityType: "USER",
        entityId: userId,
        metadata: { changedFields: ["name"] },
      });
    } catch (error) {
      console.error("Audit log write failed for PROFILE_UPDATED", error);
    }
  }

  return { success: true, user };
}
