import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { ProfileForm } from "@/components/profile/ProfileForm";
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
 * JWT's name/email claims are set once at sign-in and never refreshed
 * (see attachUserToToken/attachTokenToSession), so they'd go stale as soon
 * as this page's own Save changes form is used.
 */
export default async function ProfilePage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) redirect("/login");

  const initial = user.name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-xl px-5 py-8 sm:py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Account</p>

      {/* Identity band — the one deliberate color moment on this page; the
          two settings groups below stay quiet/neutral by design. */}
      <div className="mt-3 flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-accent"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {user.name}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>
        </div>
        <Badge variant="soft" className="shrink-0">
          {ROLE_LABELS[user.role]}
        </Badge>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold tracking-tight">Profile information</h2>
        <p className="mt-0.5 text-sm text-muted">
          Update your name — your email stays fixed as your account identity.
        </p>
        <ProfileForm
          initialName={user.name}
          email={user.email}
          roleLabel={ROLE_LABELS[user.role]}
          memberSince={formatMemberSince(user.createdAt)}
        />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold tracking-tight">Change password</h2>
        <p className="mt-0.5 text-sm text-muted">Choose a new password to keep your account secure.</p>
        <PasswordForm />
      </div>
    </div>
  );
}
