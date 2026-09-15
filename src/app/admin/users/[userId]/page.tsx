import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { UserRoleChangeDialog } from "@/components/admin/UserRoleChangeDialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminUserById } from "@/lib/admin/users";
import { requireRole } from "@/lib/auth/authorize";
import { roleMessageKey } from "@/lib/auth/roles";

type AdminUserDetailPageProps = { params: Promise<{ userId: string }> };

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const session = await requireRole("ADMIN");
  const { userId } = await params;

  const user = await getAdminUserById(userId);
  if (!user) notFound();

  const [tDetail, tRoles, format] = await Promise.all([
    getTranslations("admin.users.detail"),
    getTranslations("common.roles"),
    getFormatter(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/users" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
        {tDetail("backToUsers")}
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{user.name}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <UserRoleChangeDialog user={user} isSelf={user.id === session.user.id} />
      </div>

      <Card className="mt-6 p-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">{tDetail("role")}</dt>
            <dd className="mt-1">
              <Badge variant="outline">{tRoles(roleMessageKey(user.role))}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("createdAt")}</dt>
            <dd className="mt-1 font-medium text-ink">{format.dateTime(user.createdAt, "dateTimeShort")}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{tDetail("activity")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">{tDetail("uploadedDocuments")}</dt>
            <dd className="mt-1 font-medium text-ink">{user.counts.uploadedDocuments}</dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("comments")}</dt>
            <dd className="mt-1 font-medium text-ink">{user.counts.comments}</dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("ratings")}</dt>
            <dd className="mt-1 font-medium text-ink">{user.counts.ratings}</dd>
          </div>
          <div>
            <dt className="text-muted">{tDetail("reports")}</dt>
            <dd className="mt-1 font-medium text-ink">{user.counts.reports}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
