import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { ProfileForm } from "@/components/profile/ProfileForm";
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
        <ProfileForm
          initialName={user.name}
          email={user.email}
          roleLabel={ROLE_LABELS[user.role]}
          memberSince={formatMemberSince(user.createdAt)}
        />
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight">Change password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
