import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/authorize";

export default async function ProfilePage() {
  const session = await requireAuth();

  return (
    <div className="mx-auto max-w-lg px-5 py-8 sm:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Profile</h1>

      <Card className="mt-6 divide-y divide-line">
        <div className="p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Name</p>
          <p className="mt-1 text-base">{session.user.name}</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Email</p>
          <p className="mt-1 text-base">{session.user.email}</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Role</p>
          <Badge variant="soft" className="mt-1">
            {session.user.role}
          </Badge>
        </div>
      </Card>
    </div>
  );
}
