import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  TEACHER: "Teacher",
  ADMIN: "Admin",
};

function formatMemberSince(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

/**
 * Reads the User row fresh from the database rather than the session — the
 * JWT's name/email claims are set once at sign-in and never refreshed (see
 * attachUserToToken/attachTokenToSession), so they'd go stale as soon as
 * profile fields become editable.
 */
export default async function ProfilePage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Account</h1>
      <p className="mt-1 text-sm text-muted">Manage your personal information and password.</p>

      <div className="mt-8 border-t border-line pt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight">Profile information</h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Name</span>
            <p className="text-sm text-ink">{user.name}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
            <p className="text-sm text-ink">{user.email}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Role</span>
            <Badge variant="soft" className="w-fit">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Member since</span>
            <p className="text-sm text-ink">{formatMemberSince(user.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
